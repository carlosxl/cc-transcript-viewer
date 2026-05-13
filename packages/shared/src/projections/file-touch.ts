/**
 * Files-touched aggregation for the Files right-rail panel.
 *
 * Walks Read / Edit / Write / MultiEdit / NotebookEdit tool calls in a single
 * agent's `Turn[]` and produces one `FileTouch` per distinct path, sorted by
 * most-recent-touch first.
 */
import type { Turn, ToolUse, ToolResult, FileTouch, FileTouchIndex, TurnRef } from '../types.js';

interface Builder {
  reads: TurnRef[];
  writes: TurnRef[];
  lineCount: number | null;
  lastTs: number;
}

export function buildFileTouchIndex(turns: Turn[]): FileTouchIndex {
  const byPath = new Map<string, Builder>();
  const resultsById = indexResults(turns);

  for (const t of turns) {
    if (t.role !== 'assistant') continue;
    for (const use of t.toolUses) {
      const path = extractPath(use);
      if (!path) continue;
      const ref: TurnRef = { turnUuid: t.uuid, timestamp: t.timestamp };
      const slot = byPath.get(path) ?? createBuilder();
      byPath.set(path, slot);
      const ts = Date.parse(t.timestamp);
      if (Number.isFinite(ts) && ts > slot.lastTs) slot.lastTs = ts;

      if (use.name === 'Read') {
        slot.reads.push(ref);
        const result = resultsById.get(use.id);
        if (result && typeof result.content === 'string') {
          slot.lineCount = countLines(result.content);
        }
      } else {
        slot.writes.push(ref);
      }
    }
  }

  const files: FileTouch[] = [];
  for (const [path, b] of byPath) {
    files.push({
      path,
      reads: b.reads,
      writes: b.writes,
      changed: b.writes.length > 0,
      lineCount: b.lineCount,
    });
  }
  files.sort((a, b) => {
    const lastA = tsOf(byPath.get(a.path)!);
    const lastB = tsOf(byPath.get(b.path)!);
    if (lastA !== lastB) return lastB - lastA;
    if (a.writes.length !== b.writes.length) return b.writes.length - a.writes.length;
    return a.path.localeCompare(b.path);
  });
  return { files };
}

function indexResults(turns: Turn[]): Map<string, ToolResult> {
  const map = new Map<string, ToolResult>();
  for (const t of turns) {
    for (const r of t.toolResults) {
      if (!map.has(r.tool_use_id)) map.set(r.tool_use_id, r);
    }
  }
  return map;
}

function extractPath(use: ToolUse): string | null {
  const input = use.input as Record<string, unknown>;
  switch (use.name) {
    case 'Read':
    case 'Edit':
    case 'Write':
    case 'MultiEdit':
      return typeof input.file_path === 'string' ? input.file_path : null;
    case 'NotebookEdit':
      return typeof input.notebook_path === 'string' ? input.notebook_path : null;
    default:
      return null;
  }
}

function createBuilder(): Builder {
  return { reads: [], writes: [], lineCount: null, lastTs: -Infinity };
}

function tsOf(b: Builder): number {
  return b.lastTs;
}

function countLines(s: string): number {
  if (s.length === 0) return 0;
  let n = 1;
  for (let i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) === 10) n++;
  }
  return n;
}
