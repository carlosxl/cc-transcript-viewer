/**
 * Defensive JSON stringify (D-40.2 / F-1): `ToolUse.input` is typed `unknown`
 * upstream, but real Claude sessions occasionally produce non-object inputs
 * (string, number, BigInt) or self-referential objects. JSON.stringify throws
 * on either, which used to unmount the React root before the ErrorBoundary
 * existed.
 */
export function safeStringify(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'string') return v
  try {
    return JSON.stringify(v, null, 2)
  } catch {
    return String(v)
  }
}
