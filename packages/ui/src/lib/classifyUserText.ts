/**
 * Classify a user-role turn's assembled text into one of the design's
 * user-message shapes:
 *
 *   - `command` — Claude Code slash commands. Source text contains
 *     `<command-name>X</command-name>` (and optional `<command-args>`,
 *     `<command-message>`, `<local-command-stdout>`, `<local-command-stderr>`).
 *   - `stderr`  — Source text is dominated by a non-empty
 *     `<local-command-stderr>…</local-command-stderr>` block (no command name).
 *   - `stdout`  — Source text is dominated by a non-empty
 *     `<local-command-stdout>…</local-command-stdout>` block (no command name).
 *     Custom slash commands (e.g. `/nf-db`) emit their output in a follow-up
 *     user event without the `<command-name>` wrapper.
 *   - `text`    — Anything else — plain user prose.
 *
 * Matching is loose XML-tag substring matching (not a full parser). Falls back
 * to `text` whenever the source doesn't look like a Claude-Code-emitted
 * structured user event — that's the right default for v1.
 */

export type ClassifiedUserText =
  | {
      kind: 'command'
      name: string
      args: string
      message: string
      stdout: string
      stderr: string
    }
  | { kind: 'stderr'; text: string }
  | { kind: 'stdout'; text: string }
  | { kind: 'text'; text: string }

const TAG_RE = (tag: string) =>
  new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`)

function extract(text: string, tag: string): string {
  const m = text.match(TAG_RE(tag))
  return m ? m[1]!.trim() : ''
}

export function classifyUserText(text: string): ClassifiedUserText {
  if (!text) return { kind: 'text', text: '' }

  if (text.includes('<command-name>')) {
    return {
      kind: 'command',
      name: extract(text, 'command-name'),
      args: extract(text, 'command-args'),
      message: extract(text, 'command-message'),
      stdout: extract(text, 'local-command-stdout'),
      stderr: extract(text, 'local-command-stderr'),
    }
  }

  if (text.includes('<local-command-stderr>')) {
    const body = extract(text, 'local-command-stderr')
    if (body.length > 0) return { kind: 'stderr', text: body }
  }

  if (text.includes('<local-command-stdout>')) {
    const body = extract(text, 'local-command-stdout')
    if (body.length > 0) return { kind: 'stdout', text: body }
  }

  return { kind: 'text', text }
}
