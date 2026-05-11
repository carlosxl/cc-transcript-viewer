// packages/server/test/setup-network-guard.ts
//
// D-12 / SYS-03 enforcement: any test that attempts to open a non-localhost
// network connection throws immediately. This runs at the process level via
// Vitest's setupFiles — the patches apply globally for every test file.
//
// The monkey-patches cover:
//   - globalThis.fetch
//   - node:http  request()
//   - node:https request()
//
// Localhost URLs (127.0.0.1, localhost, ::1) are allowed through unchanged.
//
// This file must NOT import anything from @cc-viewer/* — it patches before
// the tested modules load.

import * as http from 'node:http'
import * as https from 'node:https'

const LOCALHOST_RE = /^(?:https?:)?\/\/(?:127\.0\.0\.1|localhost|\[::1\])(?::\d+)?(?:\/|$)/

function isLocalhostUrl(url: string | URL): boolean {
  try {
    const s = url instanceof URL ? url.href : url
    return LOCALHOST_RE.test(s)
  } catch {
    return false
  }
}

function isLocalhostHostname(host: string | undefined | null): boolean {
  if (!host) return false
  return host === '127.0.0.1' || host === 'localhost' || host === '::1'
}

// ─── fetch patch ────────────────────────────────────────────────────────────

const originalFetch = globalThis.fetch
if (typeof originalFetch === 'function') {
  globalThis.fetch = ((input: Parameters<typeof originalFetch>[0], init?: Parameters<typeof originalFetch>[1]) => {
    const url = typeof input === 'string' ? input
      : input instanceof URL ? input
      : (input as Request).url
    if (!isLocalhostUrl(url)) {
      throw new Error(
        `NETWORK_GUARD: Outbound fetch to non-localhost URL blocked: ${String(url)}. ` +
        `cc-viewer must not make external network calls (D-12, SYS-03).`,
      )
    }
    return originalFetch(input, init)
  }) as typeof fetch
}

// ─── http.request patch ────────────────────────────────────────────────────
//
// Note: node:http's namespace bindings under ESM are non-writable. We patch the
// underlying CommonJS module via createRequire so the `request` export and
// the convenience `get` helper both go through our guard. http.get internally
// calls module.exports.request, so patching the export updates both helpers
// for any caller that does `import { request } from 'node:http'` AFTER this
// file runs (Vitest setupFiles runs before user-land imports load).

import { createRequire } from 'node:module'
const require_ = createRequire(import.meta.url)
const httpModule = require_('node:http') as typeof http
const httpsModule = require_('node:https') as typeof https

const originalHttpRequest = httpModule.request

function guardedHttpRequest(
  url: string | URL | http.RequestOptions,
  options?: http.RequestOptions | ((res: http.IncomingMessage) => void),
  callback?: (res: http.IncomingMessage) => void,
): http.ClientRequest {
  let host: string | null | undefined
  let urlStr: string | null = null

  if (typeof url === 'string') {
    urlStr = url
  } else if (url instanceof URL) {
    urlStr = url.href
  } else if (url && typeof url === 'object') {
    host = (url as http.RequestOptions).hostname ?? (url as http.RequestOptions).host ?? null
  }

  if (urlStr !== null && !isLocalhostUrl(urlStr)) {
    throw new Error(
      `NETWORK_GUARD: Outbound http.request blocked: ${urlStr} (D-12, SYS-03)`,
    )
  }
  if (urlStr === null && !isLocalhostHostname(host ?? null)) {
    throw new Error(
      `NETWORK_GUARD: Outbound http.request to non-localhost host blocked: ${host} (D-12, SYS-03)`,
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return originalHttpRequest(url as any, options as any, callback as any)
}

Object.defineProperty(httpModule, 'request', {
  value: guardedHttpRequest,
  writable: true,
  configurable: true,
})

// ─── https.request patch ───────────────────────────────────────────────────

const originalHttpsRequest = httpsModule.request

function guardedHttpsRequest(
  url: string | URL | https.RequestOptions,
  options?: https.RequestOptions | ((res: http.IncomingMessage) => void),
  callback?: (res: http.IncomingMessage) => void,
): http.ClientRequest {
  let host: string | null | undefined
  let urlStr: string | null = null

  if (typeof url === 'string') {
    urlStr = url
  } else if (url instanceof URL) {
    urlStr = url.href
  } else if (url && typeof url === 'object') {
    host = (url as https.RequestOptions).hostname ?? (url as https.RequestOptions).host ?? null
  }

  if (urlStr !== null && !isLocalhostUrl(urlStr)) {
    throw new Error(
      `NETWORK_GUARD: Outbound https.request blocked: ${urlStr} (D-12, SYS-03)`,
    )
  }
  if (urlStr === null && !isLocalhostHostname(host ?? null)) {
    throw new Error(
      `NETWORK_GUARD: Outbound https.request to non-localhost host blocked: ${host} (D-12, SYS-03)`,
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return originalHttpsRequest(url as any, options as any, callback as any)
}

Object.defineProperty(httpsModule, 'request', {
  value: guardedHttpsRequest,
  writable: true,
  configurable: true,
})
