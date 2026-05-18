import type { Turn } from '@cc-viewer/shared'
import { classifyUserText } from './classifyUserText'

export type VirtualNode =
  | { kind: 'turn';     key: string; turn: Turn }
  | { kind: 'capsule';  key: string; turn: Turn; toolUseId: string }
  | { kind: 'diff';     key: string; turn: Turn; toolUseId: string }
  | { kind: 'thinking'; key: string; turn: Turn; index: number }

export interface FlatNodeOptions {
  /** When false, thinking nodes are omitted (matches the old "compact" mode). */
  showThinking: boolean
  /** Caller-provided lookup: does this toolUseId have a non-null diff projection? */
  hasDiff: (toolUseId: string) => boolean
}

/**
 * Pure derivation: `Turn[]` → flat `VirtualNode[]` for Virtuoso (Phase 4).
 *
 * Differences from the Phase 3 shape:
 *   - Tool result rows are gone. Results live in the right rail (Phase 5).
 *   - Tool calls become `capsule` nodes (rendered by `ToolCapsule`).
 *   - Edit/Write tool calls also emit a `diff` node right after the capsule
 *     when the matched `ToolInteraction.diff` is non-null. The caller passes
 *     a `hasDiff(toolUseId)` lookup so this builder stays pure.
 *   - Thinking nodes are gated by `showThinking`. Everything else (text,
 *     capsule, diff, command, stderr) is always emitted.
 *   - User turns that classify as `command` / `stderr` still emit a single
 *     `turn` node; `UserTurn` dispatches to `CommandBlock` / `StderrBlock`.
 *   - Tool-result-only user turns are dropped entirely (results moved to rail).
 */
export function buildFlatNodes(
  turns: Turn[],
  opts: FlatNodeOptions,
): VirtualNode[] {
  const out: VirtualNode[] = []
  let lastShellRole: Turn['role'] | null = null

  for (const turn of turns) {
    if (turn.isMeta) continue

    const text = Array.isArray(turn.textBlocks) ? turn.textBlocks.join('\n\n') : ''

    // ── User turns ─────────────────────────────────────────────────────
    if (turn.role === 'user') {
      const classified = classifyUserText(text)
      const hasUserBody =
        classified.kind === 'command' ||
        classified.kind === 'stderr' ||
        classified.kind === 'stdout' ||
        classified.text.length > 0
      if (!hasUserBody) {
        // Tool-result-only envelope. Drop — capsule statuses + the rail
        // carry the result now.
        continue
      }
      out.push({ kind: 'turn', key: turn.uuid, turn })
      lastShellRole = 'user'
      continue
    }

    // ── Assistant / system turns ───────────────────────────────────────
    const childRows: VirtualNode[] = []

    if (opts.showThinking) {
      turn.thinkingBlocks.forEach((_, i) =>
        childRows.push({
          kind: 'thinking',
          key: `${turn.uuid}:think:${i}`,
          turn,
          index: i,
        }),
      )
    }

    turn.toolUses.forEach((tu) => {
      childRows.push({
        kind: 'capsule',
        key: `${turn.uuid}:cap:${tu.id}`,
        turn,
        toolUseId: tu.id,
      })
      if (opts.hasDiff(tu.id)) {
        childRows.push({
          kind: 'diff',
          key: `${turn.uuid}:diff:${tu.id}`,
          turn,
          toolUseId: tu.id,
        })
      }
    })

    const hasChildren = childRows.length > 0

    // Shell emit rule (unchanged from Phase 3):
    //   - has prose → emit
    //   - empty + role differs from prior shell → emit (boundary marker)
    //   - empty + same role + has children → SKIP (continuation)
    //   - empty + no children → emit (preserves a visible row)
    const emitShell =
      text.length > 0 ||
      turn.role !== lastShellRole ||
      !hasChildren
    if (emitShell) {
      out.push({ kind: 'turn', key: turn.uuid, turn })
      lastShellRole = turn.role
    }
    out.push(...childRows)
  }
  return out
}
