import type { ToolUse } from '@cc-viewer/shared'
import { safeStringify } from './safeStringify'

/**
 * Best-effort "Copy command" formatter. The button label is "Copy command",
 * not "Copy as curl" — the output is whatever shell incantation most closely
 * approximates the tool call locally (Open Question #7).
 *
 * Rules:
 *   - Bash       → the command verbatim
 *   - Read       → `cat "<file>"`, with `sed -n 'A,Bp'` slice when offset is set
 *   - Glob       → `find <path> -name '<pattern>' -type f`
 *   - Grep       → `grep -R '<pattern>' <path>` (or rg-style fallback)
 *   - WebFetch   → `curl <url>`
 *   - everything else → `# tool=<name>\n${safeStringify(input)}`
 */
export function formatCommand(toolUse: ToolUse): string {
  const input = toolUse.input
  const str = (key: string): string => {
    const v = input[key]
    return typeof v === 'string' ? v : ''
  }
  const num = (key: string): number | null => {
    const v = input[key]
    return typeof v === 'number' && Number.isFinite(v) ? v : null
  }

  switch (toolUse.name) {
    case 'Bash': {
      const cmd = str('command')
      return cmd || `# Bash via Claude Code\n${safeStringify(input)}`
    }
    case 'Read': {
      const path = str('file_path')
      if (!path) return jsonFallback(toolUse)
      const offset = num('offset')
      const limit = num('limit')
      if (offset !== null && offset > 0) {
        const start = offset + 1
        const end = limit !== null ? offset + limit : start + 49
        return `sed -n '${start},${end}p' ${shellQuote(path)}`
      }
      return `cat ${shellQuote(path)}`
    }
    case 'Glob': {
      const pattern = str('pattern')
      const path = str('path') || '.'
      if (!pattern) return jsonFallback(toolUse)
      return `find ${shellQuote(path)} -name ${shellQuote(pattern)} -type f`
    }
    case 'Grep': {
      const pattern = str('pattern')
      const path = str('path') || '.'
      if (!pattern) return jsonFallback(toolUse)
      return `grep -R ${shellQuote(pattern)} ${shellQuote(path)}`
    }
    case 'WebFetch': {
      const url = str('url')
      if (!url) return jsonFallback(toolUse)
      return `curl ${shellQuote(url)}`
    }
    default:
      return jsonFallback(toolUse)
  }
}

function jsonFallback(toolUse: ToolUse): string {
  return `# tool=${toolUse.name}\n${safeStringify(toolUse.input)}`
}

/** POSIX single-quote escape — safe for arbitrary file paths and patterns. */
function shellQuote(s: string): string {
  if (s === '') return "''"
  if (/^[A-Za-z0-9_\-./:@%+=,]+$/.test(s)) return s
  return `'${s.replace(/'/g, `'\\''`)}'`
}
