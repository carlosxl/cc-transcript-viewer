// packages/ui/src/api.ts
import type {
  SessionsListResponse,
  SessionDetailResponse,
  SubagentDetailResponse,
  SearchResponse,
  SearchStatusResponse,
  SessionReport,
  ErrorResponse,
} from '@cc-viewer/shared'

/**
 * Thin, typed wrappers around the Phase 1 REST endpoints.
 * All requests go via Vite's /api proxy in dev, or are same-origin in prod.
 */

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, { ...init, headers: { 'Accept': 'application/json', ...(init?.headers ?? {}) } })
  } catch (err) {
    throw new ApiError(
      `Network error: ${err instanceof Error ? err.message : String(err)}`,
      0,
      'NETWORK_ERROR',
    )
  }

  if (!res.ok) {
    let code = 'HTTP_ERROR'
    let message = `HTTP ${res.status}`
    try {
      const body = await res.json() as ErrorResponse
      if (body.error) {
        code = body.error.code
        message = body.error.message
      }
    } catch {
      // non-JSON body; fall through with defaults
    }
    throw new ApiError(message, res.status, code)
  }

  return res.json() as Promise<T>
}

export function fetchSessions(): Promise<SessionsListResponse> {
  return request<SessionsListResponse>('/api/sessions')
}

export function fetchSession(sessionId: string): Promise<SessionDetailResponse> {
  const encoded = encodeURIComponent(sessionId)
  return request<SessionDetailResponse>(`/api/sessions/${encoded}`)
}

export function fetchSubagent(sessionId: string, agentId: string): Promise<SubagentDetailResponse> {
  const sid = encodeURIComponent(sessionId)
  const aid = encodeURIComponent(agentId)
  return request<SubagentDetailResponse>(`/api/sessions/${sid}/subagents/${aid}`)
}

export function fetchSessionReport(sessionId: string): Promise<SessionReport> {
  const encoded = encodeURIComponent(sessionId)
  return request<SessionReport>(`/api/sessions/${encoded}/report`)
}

export function searchSessions(query: string, limit = 50): Promise<SearchResponse> {
  const q = encodeURIComponent(query)
  return request<SearchResponse>(`/api/search?q=${q}&limit=${limit}`)
}

export function fetchSearchStatus(): Promise<SearchStatusResponse> {
  return request<SearchStatusResponse>('/api/search/status')
}
