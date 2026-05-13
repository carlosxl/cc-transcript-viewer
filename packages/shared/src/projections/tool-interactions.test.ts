import { describe, it, expect } from 'vitest';
import { buildToolInteractions } from './tool-interactions.js';
import type { Turn, ToolUse, ToolResult } from '../types.js';

function tu(id: string, name: string, input: Record<string, unknown> = {}): ToolUse {
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

describe('buildToolInteractions', () => {
  it('returns empty when no assistant turns', () => {
    expect(buildToolInteractions([])).toEqual([]);
  });

  it('pairs a ToolUse with its ToolResult by id', () => {
    const out = buildToolInteractions([
      aTurn('t1', '2026-05-12T00:00:00Z', [tu('u1', 'Bash', { command: 'ls' })]),
      uTurn('t2', '2026-05-12T00:00:01Z', [
        { tool_use_id: 'u1', content: 'a\nb' },
      ]),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]!.id).toBe('t1:u1');
    expect(out[0]!.toolUseId).toBe('u1');
    expect(out[0]!.tool).toBe('Bash');
    expect(out[0]!.status).toBe('success');
    expect(out[0]!.resultTurnUuid).toBe('t2');
    expect(out[0]!.durationMs).toBe(1000);
  });

  it('marks status running when no result has appeared yet', () => {
    const out = buildToolInteractions([
      aTurn('t1', '2026-05-12T00:00:00Z', [tu('u1', 'Bash')]),
    ]);
    expect(out[0]!.status).toBe('running');
    expect(out[0]!.resultTurnUuid).toBeNull();
    expect(out[0]!.durationMs).toBeNull();
  });

  it('marks status fail when result has is_error=true', () => {
    const out = buildToolInteractions([
      aTurn('t1', '2026-05-12T00:00:00Z', [tu('u1', 'Bash')]),
      uTurn('t2', '2026-05-12T00:00:00Z', [
        { tool_use_id: 'u1', content: 'boom', is_error: true },
      ]),
    ]);
    expect(out[0]!.status).toBe('fail');
  });

  it('emits one interaction per ToolUse in order within a turn', () => {
    const out = buildToolInteractions([
      aTurn('t1', '2026-05-12T00:00:00Z', [
        tu('u1', 'Bash'),
        tu('u2', 'Read', { file_path: '/x' }),
      ]),
    ]);
    expect(out.map((i) => i.id)).toEqual(['t1:u1', 't1:u2']);
    expect(out[1]!.tool).toBe('Read');
  });

  it('pairs across non-adjacent turns', () => {
    const out = buildToolInteractions([
      aTurn('t1', '2026-05-12T00:00:00Z', [tu('u1', 'Bash')]),
      aTurn('t2', '2026-05-12T00:00:01Z', [tu('u2', 'Bash')]),
      uTurn('t3', '2026-05-12T00:00:02Z', [
        { tool_use_id: 'u2', content: 'ok' },
        { tool_use_id: 'u1', content: 'ok' },
      ]),
    ]);
    expect(out[0]!.status).toBe('success');
    expect(out[1]!.status).toBe('success');
  });

  describe('diff', () => {
    it('Edit produces +added / −removed line counts', () => {
      const out = buildToolInteractions([
        aTurn('t1', '2026-05-12T00:00:00Z', [
          tu('u1', 'Edit', {
            file_path: '/a.ts',
            old_string: 'one\ntwo',
            new_string: 'one\ntwo\nthree\nfour',
          }),
        ]),
      ]);
      expect(out[0]!.diff).toEqual({ filePath: '/a.ts', added: 2, removed: 0 });
    });

    it('Write counts content lines as added', () => {
      const out = buildToolInteractions([
        aTurn('t1', '2026-05-12T00:00:00Z', [
          tu('u1', 'Write', { file_path: '/a.ts', content: 'a\nb\nc' }),
        ]),
      ]);
      expect(out[0]!.diff).toEqual({ filePath: '/a.ts', added: 3, removed: 0 });
    });

    it('MultiEdit sums edits', () => {
      const out = buildToolInteractions([
        aTurn('t1', '2026-05-12T00:00:00Z', [
          tu('u1', 'MultiEdit', {
            file_path: '/a.ts',
            edits: [
              { old_string: 'x', new_string: 'x\ny' },
              { old_string: 'a\nb', new_string: 'a' },
            ],
          }),
        ]),
      ]);
      expect(out[0]!.diff).toEqual({ filePath: '/a.ts', added: 1, removed: 1 });
    });

    it('NotebookEdit uses notebook_path', () => {
      const out = buildToolInteractions([
        aTurn('t1', '2026-05-12T00:00:00Z', [
          tu('u1', 'NotebookEdit', {
            notebook_path: '/x.ipynb',
            old_source: 'a',
            new_source: 'a\nb',
          }),
        ]),
      ]);
      expect(out[0]!.diff?.filePath).toBe('/x.ipynb');
      expect(out[0]!.diff?.added).toBe(1);
    });

    it('null for non-Edit tools', () => {
      const out = buildToolInteractions([
        aTurn('t1', '2026-05-12T00:00:00Z', [tu('u1', 'Bash')]),
      ]);
      expect(out[0]!.diff).toBeNull();
    });
  });

  describe('preview', () => {
    it('Read populates filePath and lineCount from result', () => {
      const out = buildToolInteractions([
        aTurn('t1', '2026-05-12T00:00:00Z', [tu('u1', 'Read', { file_path: '/a.ts' })]),
        uTurn('t2', '2026-05-12T00:00:01Z', [
          { tool_use_id: 'u1', content: 'line1\nline2\nline3' },
        ]),
      ]);
      expect(out[0]!.preview).toEqual({ filePath: '/a.ts', lineCount: 3 });
    });

    it('Read with no result yet has lineCount=null', () => {
      const out = buildToolInteractions([
        aTurn('t1', '2026-05-12T00:00:00Z', [tu('u1', 'Read', { file_path: '/a.ts' })]),
      ]);
      expect(out[0]!.preview).toEqual({ filePath: '/a.ts', lineCount: null });
    });

    it('non-Read tools have preview=null', () => {
      const out = buildToolInteractions([
        aTurn('t1', '2026-05-12T00:00:00Z', [tu('u1', 'Bash')]),
      ]);
      expect(out[0]!.preview).toBeNull();
    });
  });

  it('id format is ${turnUuid}:${toolUseId}', () => {
    const out = buildToolInteractions([
      aTurn('abc-123', '2026-05-12T00:00:00Z', [tu('use-42', 'Bash')]),
    ]);
    expect(out[0]!.id).toBe('abc-123:use-42');
  });

  it('durationMs clamps negative deltas to 0', () => {
    const out = buildToolInteractions([
      aTurn('t1', '2026-05-12T00:00:05Z', [tu('u1', 'Bash')]),
      uTurn('t2', '2026-05-12T00:00:00Z', [
        { tool_use_id: 'u1', content: '' },
      ]),
    ]);
    expect(out[0]!.durationMs).toBe(0);
  });
});
