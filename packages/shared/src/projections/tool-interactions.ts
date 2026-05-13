/**
 * Pair each ToolUse with its matching ToolResult and produce a flat
 * `ToolInteraction[]` ready for the Inspector right-rail panel.
 *
 * Pure, deterministic, no I/O. Walks `Turn[]` exactly once.
 */
import type {
  Turn,
  ToolUse,
  ToolResult,
  ToolInteraction,
  DiffSummary,
  PreviewSummary,
} from '../types.js';

interface ResultRef {
  result: ToolResult;
  turnUuid: string;
  timestamp: string;
}

const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);

/**
 * Build the call ↔ result projection for one agent's turn list.
 *
 * `turns` should be a single agent's `Turn[]` (main session, or one subagent).
 * Mixing agents is allowed but not required — the pairing is by toolUseId.
 */
export function buildToolInteractions(turns: Turn[]): ToolInteraction[] {
  const resultsById = indexResults(turns);
  const interactions: ToolInteraction[] = [];

  for (const turn of turns) {
    if (turn.role !== 'assistant') continue;
    for (const use of turn.toolUses) {
      const ref = resultsById.get(use.id);
      interactions.push(buildOne(turn, use, ref));
    }
  }
  return interactions;
}

/** Map `tool_use_id` → matching result + the turn timestamp where it appeared. */
function indexResults(turns: Turn[]): Map<string, ResultRef> {
  const map = new Map<string, ResultRef>();
  for (const turn of turns) {
    for (const result of turn.toolResults) {
      // First match wins. Duplicate tool_use_ids would be a corrupt session;
      // we don't try to repair them.
      if (!map.has(result.tool_use_id)) {
        map.set(result.tool_use_id, { result, turnUuid: turn.uuid, timestamp: turn.timestamp });
      }
    }
  }
  return map;
}

function buildOne(turn: Turn, use: ToolUse, ref: ResultRef | undefined): ToolInteraction {
  const result = ref?.result ?? null;
  const status: ToolInteraction['status'] =
    result === null ? 'running' : result.is_error ? 'fail' : 'success';

  return {
    id: `${turn.uuid}:${use.id}`,
    turnUuid: turn.uuid,
    toolUseId: use.id,
    tool: use.name,
    resultTurnUuid: ref?.turnUuid ?? null,
    status,
    startedAt: turn.timestamp,
    durationMs: computeDuration(turn.timestamp, ref?.timestamp),
    diff: EDIT_TOOLS.has(use.name) ? buildDiff(use) : null,
    preview: use.name === 'Read' ? buildPreview(use, result) : null,
  };
}

function computeDuration(startTs: string, endTs: string | undefined): number | null {
  if (!endTs) return null;
  const a = Date.parse(startTs);
  const b = Date.parse(endTs);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, b - a);
}

/** Line-count diff for Edit / Write / MultiEdit / NotebookEdit. */
function buildDiff(use: ToolUse): DiffSummary | null {
  const input = use.input as Record<string, unknown>;
  const filePath =
    typeof input.file_path === 'string'
      ? input.file_path
      : typeof input.notebook_path === 'string'
        ? input.notebook_path
        : null;
  if (!filePath) return null;

  switch (use.name) {
    case 'Edit':
      return diffOfStrings(filePath, str(input.old_string), str(input.new_string));
    case 'Write':
      return { filePath, added: lineCount(str(input.content)), removed: 0 };
    case 'MultiEdit': {
      const edits = Array.isArray(input.edits) ? input.edits : [];
      let added = 0;
      let removed = 0;
      for (const e of edits) {
        if (!e || typeof e !== 'object') continue;
        const edit = e as Record<string, unknown>;
        const d = diffOfStrings('', str(edit.old_string), str(edit.new_string));
        added += d.added;
        removed += d.removed;
      }
      return { filePath, added, removed };
    }
    case 'NotebookEdit':
      return diffOfStrings(filePath, str(input.old_source), str(input.new_source));
    default:
      return null;
  }
}

function diffOfStrings(filePath: string, oldStr: string, newStr: string): DiffSummary {
  const oldN = oldStr ? lineCount(oldStr) : 0;
  const newN = newStr ? lineCount(newStr) : 0;
  return {
    filePath,
    added: Math.max(0, newN - oldN),
    removed: Math.max(0, oldN - newN),
  };
}

function buildPreview(use: ToolUse, result: ToolResult | null): PreviewSummary | null {
  const input = use.input as Record<string, unknown>;
  const filePath = typeof input.file_path === 'string' ? input.file_path : null;
  if (!filePath) return null;

  let lc: number | null = null;
  if (result && typeof result.content === 'string') {
    lc = lineCount(result.content);
  }
  return { filePath, lineCount: lc };
}

function lineCount(s: string): number {
  if (s.length === 0) return 0;
  let n = 1;
  for (let i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) === 10) n++;
  }
  return n;
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}
