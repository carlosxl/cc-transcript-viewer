import type { Turn, ToolResult } from '@cc-viewer/shared'
import type { ViewMode } from '@/stores/useUIStore'

export type VirtualNode =
  | { kind: 'turn';        key: string; turn: Turn }
  | { kind: 'tool-input';  key: string; turn: Turn; toolUseId: string }
  | { kind: 'tool-output'; key: string; turn: Turn; toolUseId: string; unmatched?: boolean }
  | { kind: 'thinking';    key: string; turn: Turn; index: number }

/**
 * Pure derivation: Turn[] + ViewMode → flat VirtualNode[] for Virtuoso.
 *
 * - compact: only user-prose and assistant-prose turns. Tool calls, tool
 *   results, and thinking blocks are hidden. User turns that carry only
 *   tool_result blocks (the API envelope shape) are dropped entirely.
 * - details: every node, fully inline. No per-row expand/collapse. Tool
 *   results are hoisted next to their matching tool_use across turn
 *   boundaries so call ↔ result pairs render adjacent regardless of the
 *   JSONL's interleaved arrival order. Orphan results (no matching call)
 *   stay at their source position and are flagged `unmatched: true`.
 *
 * NEVER nest Virtuoso. Children are appended AFTER their parent so a hit on
 * a parent's index always lands on the same row regardless of mode.
 */
export function buildFlatNodes(turns: Turn[], mode: ViewMode): VirtualNode[] {
  const out: VirtualNode[] = []

  // Pre-scan: tool_use_id → result + the turn that owns it. First match wins
  // so a stray duplicate (live-tail re-emit) doesn't shadow the first arrival.
  // Only used in details mode — compact mode never renders tool rows.
  const resultByUseId =
    mode === 'details'
      ? buildResultIndex(turns)
      : new Map<string, { turn: Turn; result: ToolResult }>()
  const consumed = new Set<string>()
  // Tracks the role of the most recently emitted turn shell. The role label
  // ("User" / "Claude" / "System") is a boundary marker — repeating it on
  // every same-role continuation turn (e.g. thinking-only assistant chunks
  // followed by text-only assistant chunks) makes the visual role shift
  // ambiguous. We emit the shell at role-shifts, and otherwise only when the
  // turn itself has prose worth showing.
  let lastShellRole: Turn['role'] | null = null

  for (const turn of turns) {
    if (turn.isMeta) continue

    if (mode === 'compact') {
      const text = Array.isArray(turn.textBlocks) ? turn.textBlocks.join('\n\n') : ''
      // Drop user-role turns that exist only to carry tool_result envelopes.
      if (turn.role === 'user' && text.length === 0 && (turn.toolResults?.length ?? 0) > 0) continue
      // Assistant turns with no prose (e.g., pure thinking/tool turn) add nothing in compact mode.
      if (turn.role === 'assistant' && text.length === 0) continue
      out.push({ kind: 'turn', key: turn.uuid, turn })
      continue
    }

    // details mode: parent + all children inline. Skip the parent shell when
    // it carries no prose but does have children — the children rows alone
    // convey what happened and avoid stacking a header-only "Assistant" /
    // "User" row above a single tool call.
    const text = Array.isArray(turn.textBlocks) ? turn.textBlocks.join('\n\n') : ''

    // Build the child rows in a buffer so `hasChildren` reflects what will
    // actually emit (after intra-turn pairing consumes some results). Two-pass
    // ordering matters: tool-input rows must run before the orphan scan so
    // same-turn pairings populate `consumed` and don't get re-emitted as
    // orphans below.
    const childRows: VirtualNode[] = []

    turn.thinkingBlocks.forEach((_, i) =>
      childRows.push({ kind: 'thinking', key: `${turn.uuid}:think:${i}`, turn, index: i })
    )
    turn.toolUses.forEach((tu) => {
      childRows.push({ kind: 'tool-input', key: `${turn.uuid}:in:${tu.id}`, turn, toolUseId: tu.id })
      const matched = resultByUseId.get(tu.id)
      if (matched && !consumed.has(tu.id)) {
        consumed.add(tu.id)
        // Key uses the source turn's uuid so it stays unique and stable across
        // re-renders — the result row's identity is tied to where the data
        // lives, not where it visually appears.
        childRows.push({
          kind: 'tool-output',
          key: `${matched.turn.uuid}:out:${tu.id}`,
          turn: matched.turn,
          toolUseId: tu.id,
        })
      }
    })
    turn.toolResults.forEach((tr) => {
      if (consumed.has(tr.tool_use_id)) return
      childRows.push({
        kind: 'tool-output',
        key: `${turn.uuid}:out:${tr.tool_use_id}`,
        turn,
        toolUseId: tr.tool_use_id,
        unmatched: true,
      })
    })

    const hasChildren = childRows.length > 0

    // A user turn whose tool_results were all hoisted to their call sites
    // contributes nothing here. Drop it entirely (don't even render its shell).
    // The historical "empty turn keeps its shell" behaviour is preserved when
    // the turn never had tool_results in the first place.
    if (text.length === 0 && !hasChildren && turn.toolResults.length > 0) {
      continue
    }

    // Shell emit rule:
    //   - has prose → emit (need to show the text)
    //   - empty prose but role differs from previous emitted shell → emit
    //     (boundary marker so children below have a labelled role above them)
    //   - empty prose + same role as previous → skip (continuation)
    //   - empty prose + no children + no prior tool_results → emit
    //     (preserves a visible row for purely-empty turns that aren't being
    //     dropped above)
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

function buildResultIndex(turns: Turn[]): Map<string, { turn: Turn; result: ToolResult }> {
  const m = new Map<string, { turn: Turn; result: ToolResult }>()
  for (const turn of turns) {
    for (const tr of turn.toolResults) {
      if (!m.has(tr.tool_use_id)) m.set(tr.tool_use_id, { turn, result: tr })
    }
  }
  return m
}
