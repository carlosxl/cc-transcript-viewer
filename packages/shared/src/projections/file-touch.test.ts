import { describe, it, expect } from 'vitest';
import { buildFileTouchIndex } from './file-touch.js';
import type { Turn, ToolUse, ToolResult } from '../types.js';

function tu(id: string, name: string, input: Record<string, unknown>): ToolUse {
  return { id, name, input };
}

function aTurn(uuid: string, ts: string, toolUses: ToolUse[]): Turn {
  return {
    uuid,
    parentUuid: null,
    timestamp: ts,
    role: 'assistant',
    textBlocks: [],
    thinkingBlocks: [],
    toolUses,
    toolResults: [],
    isMeta: false,
    agentId: null,
  };
}

function uTurn(uuid: string, ts: string, results: ToolResult[]): Turn {
  return {
    uuid,
    parentUuid: null,
    timestamp: ts,
    role: 'user',
    textBlocks: [],
    thinkingBlocks: [],
    toolUses: [],
    toolResults: results,
    isMeta: false,
    agentId: null,
  };
}

describe('buildFileTouchIndex', () => {
  it('returns empty for no turns', () => {
    expect(buildFileTouchIndex([])).toEqual({ files: [] });
  });

  it('records a Read as a read, changed=false', () => {
    const ix = buildFileTouchIndex([
      aTurn('t1', '2026-05-12T00:00:00Z', [tu('u1', 'Read', { file_path: '/a.ts' })]),
    ]);
    expect(ix.files).toHaveLength(1);
    const f = ix.files[0]!;
    expect(f.path).toBe('/a.ts');
    expect(f.reads).toHaveLength(1);
    expect(f.writes).toHaveLength(0);
    expect(f.changed).toBe(false);
  });

  it('records Edit/Write/MultiEdit as writes, changed=true', () => {
    const ix = buildFileTouchIndex([
      aTurn('t1', '2026-05-12T00:00:00Z', [tu('u1', 'Edit', { file_path: '/a' })]),
      aTurn('t2', '2026-05-12T00:00:01Z', [tu('u2', 'Write', { file_path: '/b' })]),
      aTurn('t3', '2026-05-12T00:00:02Z', [tu('u3', 'MultiEdit', { file_path: '/c' })]),
    ]);
    expect(ix.files).toHaveLength(3);
    for (const f of ix.files) {
      expect(f.changed).toBe(true);
      expect(f.writes).toHaveLength(1);
      expect(f.reads).toHaveLength(0);
    }
  });

  it('NotebookEdit uses notebook_path', () => {
    const ix = buildFileTouchIndex([
      aTurn('t1', '2026-05-12T00:00:00Z', [
        tu('u1', 'NotebookEdit', { notebook_path: '/x.ipynb' }),
      ]),
    ]);
    expect(ix.files[0]!.path).toBe('/x.ipynb');
    expect(ix.files[0]!.changed).toBe(true);
  });

  it('combines Read and Edit on the same path', () => {
    const ix = buildFileTouchIndex([
      aTurn('t1', '2026-05-12T00:00:00Z', [tu('u1', 'Read', { file_path: '/a' })]),
      aTurn('t2', '2026-05-12T00:00:01Z', [tu('u2', 'Edit', { file_path: '/a' })]),
      aTurn('t3', '2026-05-12T00:00:02Z', [tu('u3', 'Read', { file_path: '/a' })]),
    ]);
    expect(ix.files).toHaveLength(1);
    const f = ix.files[0]!;
    expect(f.reads).toHaveLength(2);
    expect(f.writes).toHaveLength(1);
    expect(f.changed).toBe(true);
  });

  it('sorts files by recency desc (latest touch first)', () => {
    const ix = buildFileTouchIndex([
      aTurn('t1', '2026-05-12T00:00:00Z', [tu('u1', 'Read', { file_path: '/old' })]),
      aTurn('t2', '2026-05-12T00:00:05Z', [tu('u2', 'Read', { file_path: '/new' })]),
    ]);
    expect(ix.files.map((f) => f.path)).toEqual(['/new', '/old']);
  });

  it('lineCount comes from Read result content', () => {
    const ix = buildFileTouchIndex([
      aTurn('t1', '2026-05-12T00:00:00Z', [tu('u1', 'Read', { file_path: '/a' })]),
      uTurn('t2', '2026-05-12T00:00:01Z', [
        { tool_use_id: 'u1', content: 'a\nb\nc\nd' },
      ]),
    ]);
    expect(ix.files[0]!.lineCount).toBe(4);
  });

  it('lineCount is null when only writes are seen', () => {
    const ix = buildFileTouchIndex([
      aTurn('t1', '2026-05-12T00:00:00Z', [
        tu('u1', 'Edit', { file_path: '/a', old_string: 'x', new_string: 'y' }),
      ]),
    ]);
    expect(ix.files[0]!.lineCount).toBeNull();
  });

  it('skips tool calls without file_path', () => {
    const ix = buildFileTouchIndex([
      aTurn('t1', '2026-05-12T00:00:00Z', [tu('u1', 'Edit', {})]),
    ]);
    expect(ix.files).toEqual([]);
  });

  it('ignores non-file tools (Bash, etc.)', () => {
    const ix = buildFileTouchIndex([
      aTurn('t1', '2026-05-12T00:00:00Z', [tu('u1', 'Bash', { command: 'ls' })]),
    ]);
    expect(ix.files).toEqual([]);
  });
});
