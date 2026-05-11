/**
 * Sanitize a search-result snippet emitted by the server.
 *
 * The server's FTS5 `snippet()` call wraps matches in NUL-bracketed sentinels
 * (mirrors MARK_OPEN_SENTINEL / MARK_CLOSE_SENTINEL on the server). Everything
 * else in the string is raw user-content text — it can contain `<`, `>`, `&`,
 * quotes, even literal `<mark>`/`<script>` tokens.
 *
 * Strategy:
 *   1. HTML-escape the entire string. Now NO real tags can sneak through.
 *   2. Replace ONLY the (also-escaped) sentinel sequences with real `<mark>`
 *      tags — they were under our control on the server, so promoting them
 *      back to live HTML is safe.
 *
 * The result is suitable for `dangerouslySetInnerHTML` on a leaf `<span>` /
 * `<div>` — it contains only `<mark>` tags and HTML-escaped text.
 */

// Keep these in sync with the server's MARK_*_SENTINEL constants.
const OPEN_RAW = '\uE000CCV_MARK_OPEN\uE000'
const CLOSE_RAW = '\uE000CCV_MARK_CLOSE\uE000'

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function sanitizeSnippet(raw: string): string {
  if (!raw) return ''
  const escaped = escapeHtml(raw)
  // The sentinels contain NUL bytes only (no `<` / `>` / `&`), so they survive
  // escapeHtml unchanged. Replace globally with real <mark>/</mark>.
  return escaped
    .split(OPEN_RAW)
    .join('<mark>')
    .split(CLOSE_RAW)
    .join('</mark>')
}
