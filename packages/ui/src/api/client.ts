import type { ErrorResponse } from '@/lib/types'

/**
 * Local-server HTTP client. Same-origin in prod; the Vite proxy handles
 * /api/* and /api/live/* in dev (see vite.config.ts).
 *
 * Privacy invariant (Constitution Principle I): all requests are relative
 * paths — no absolute URLs, no third-party hosts.
 */

export class ApiError extends Error {
  readonly code: string
  readonly status: number
  constructor(code: string, message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}

interface Options {
  signal?: AbortSignal
}

export async function apiGet<T>(path: string, opts: Options = {}): Promise<T> {
  if (!path.startsWith('/api/')) {
    throw new Error(`apiGet: refusing non-/api path ${path}`)
  }
  const res = await fetch(path, { method: 'GET', signal: opts.signal, headers: { Accept: 'application/json' } })
  if (!res.ok) {
    let code = 'http_error'
    let message = `${res.status} ${res.statusText}`
    try {
      const body = (await res.json()) as ErrorResponse
      code = body?.error?.code ?? code
      message = body?.error?.message ?? message
    } catch {
      // non-JSON body — keep generic message
    }
    throw new ApiError(code, message, res.status)
  }
  return res.json() as Promise<T>
}

/**
 * SSE subscription. Returns an unsubscribe function.
 *
 * The caller registers per-event listeners via the `on` map; unknown events
 * are ignored. The EventSource auto-reconnects on transient drops.
 */
export interface SseHandlers {
  events: Record<string, (data: unknown) => void>
  onError?: (e: Event) => void
}

export function apiEventSource(path: string, handlers: SseHandlers): () => void {
  if (!path.startsWith('/api/')) {
    throw new Error(`apiEventSource: refusing non-/api path ${path}`)
  }
  const es = new EventSource(path)
  const registered: { event: string; fn: (ev: MessageEvent) => void }[] = []
  for (const [event, handler] of Object.entries(handlers.events)) {
    const fn = (ev: MessageEvent) => {
      try {
        handler(ev.data ? JSON.parse(ev.data) : null)
      } catch (err) {
        handlers.onError?.(new Event(`parse-error: ${(err as Error).message}`))
      }
    }
    es.addEventListener(event, fn as EventListener)
    registered.push({ event, fn })
  }
  if (handlers.onError) {
    es.onerror = handlers.onError
  }
  return () => {
    for (const { event, fn } of registered) {
      es.removeEventListener(event, fn as EventListener)
    }
    es.close()
  }
}
