import { describe, it, expect } from 'vitest'
import { projectSessionSummary } from './session-summary.js'
import { projectStickyState } from './sticky-state.js'
import type { ClaudeRowOrUnknown } from '../jsonl/schema.js'
import type { FileTouchIndex } from '../types.js'

const EMPTY_FILES: FileTouchIndex = { files: [] }

function user(promptId: string, text: string, uuid: string, ts = '2026-05-26T00:00:00Z'): ClaudeRowOrUnknown {
  return {
    type: 'user',
    uuid,
    timestamp: ts,
    promptId,
    message: { role: 'user', content: text },
  } as unknown as ClaudeRowOrUnknown
}

function asst(messageId: string, model: string, usage: Record<string, number>, uuid: string): ClaudeRowOrUnknown {
  return {
    type: 'assistant',
    uuid,
    message: { id: messageId, model, usage },
  } as unknown as ClaudeRowOrUnknown
}

function permMode(mode: 'auto' | 'plan' | 'acceptEdits' | 'default'): ClaudeRowOrUnknown {
  return { type: 'permission-mode', permissionMode: mode } as unknown as ClaudeRowOrUnknown
}

describe('projectSessionSummary', () => {
  it('returns zeroed totals on empty input', () => {
    const out = projectSessionSummary([], new Map(), EMPTY_FILES)
    expect(out.tokens.inputTotal).toBe(0)
    expect(out.tokens.cacheHitRate).toBe(0)
    expect(out.files).toEqual([])
    expect(out.prLinks).toEqual([])
    expect(out.queueOperations).toEqual([])
    expect(out.apiErrorChains).toEqual([])
    expect(out.harnessStateTransitions).toEqual([])
  })

  it('de-duplicates token totals across same-message-id assistant rows', () => {
    const usage = { input_tokens: 50, output_tokens: 20, cache_read_input_tokens: 100, cache_creation_input_tokens: 0 }
    const rows: ClaudeRowOrUnknown[] = [
      user('p1', 'hello', 'u1'),
      asst('m1', 'sonnet-4-6', usage, 'a1'),
      asst('m1', 'sonnet-4-6', usage, 'a2'), // same message.id → must NOT double-count
      asst('m1', 'sonnet-4-6', usage, 'a3'),
    ]
    const sticky = projectStickyState(rows)
    const out = projectSessionSummary(rows, sticky, EMPTY_FILES)
    expect(out.tokens.inputTotal).toBe(50)
    expect(out.tokens.outputTotal).toBe(20)
    expect(out.tokens.cacheReadTotal).toBe(100)
    expect(out.tokens.countedMessageIds.size).toBe(1)
  })

  it('surfaces pr-link rows', () => {
    const rows: ClaudeRowOrUnknown[] = [
      user('p1', 'open a pr', 'u1'),
      { type: 'pr-link', uuid: 'pr1', timestamp: '2026-05-26T01:00:00Z',
        prNumber: 42, prRepository: 'owner/repo', prUrl: 'https://github.com/owner/repo/pull/42' } as unknown as ClaudeRowOrUnknown,
    ]
    const out = projectSessionSummary(rows, projectStickyState(rows), EMPTY_FILES)
    expect(out.prLinks).toHaveLength(1)
    expect(out.prLinks[0]!.prNumber).toBe(42)
    expect(out.prLinks[0]!.prRepository).toBe('owner/repo')
  })

  it('surfaces queue-operation rows in order', () => {
    const rows: ClaudeRowOrUnknown[] = [
      { type: 'queue-operation', uuid: 'q1', operation: 'enqueue', sessionId: 's1', content: 'task A' } as unknown as ClaudeRowOrUnknown,
      { type: 'queue-operation', uuid: 'q2', operation: 'dequeue', sessionId: 's1' } as unknown as ClaudeRowOrUnknown,
    ]
    const out = projectSessionSummary(rows, new Map(), EMPTY_FILES)
    expect(out.queueOperations.map((q) => q.operation)).toEqual(['enqueue', 'dequeue'])
  })

  it('aggregates api_error retry chains', () => {
    const rows: ClaudeRowOrUnknown[] = [
      user('p1', 'hi', 'u1'),
      { type: 'system', subtype: 'api_error', uuid: 'e1' } as unknown as ClaudeRowOrUnknown,
      { type: 'system', subtype: 'api_error', uuid: 'e2' } as unknown as ClaudeRowOrUnknown,
      asst('m1', 'sonnet', { input_tokens: 1, output_tokens: 1 }, 'a1'),
    ]
    const out = projectSessionSummary(rows, projectStickyState(rows), EMPTY_FILES)
    expect(out.apiErrorChains).toHaveLength(1)
    expect(out.apiErrorChains[0]!.retries).toBe(2)
    expect(out.apiErrorChains[0]!.finalOutcome).toBe('success')
  })

  it('records harness-state transitions only on change (not per stable turn)', () => {
    const rows: ClaudeRowOrUnknown[] = [
      user('p1', 'first', 'u1', '2026-05-26T00:00:00Z'),
      asst('m1', 'sonnet-4-6', { input_tokens: 1, output_tokens: 1 }, 'a1'),
      user('p2', 'second', 'u2', '2026-05-26T00:01:00Z'),
      asst('m2', 'sonnet-4-6', { input_tokens: 1, output_tokens: 1 }, 'a2'),
      permMode('plan'),
      user('p3', 'third', 'u3', '2026-05-26T00:02:00Z'),
      asst('m3', 'opus-4-7', { input_tokens: 1, output_tokens: 1 }, 'a3'),
    ]
    const sticky = projectStickyState(rows)
    const out = projectSessionSummary(rows, sticky, EMPTY_FILES)
    // Between p1→p2: nothing changed → no transition.
    // Between p2→p3: permissionMode default→plan AND model sonnet-4-6→opus-4-7 → 2 transitions.
    expect(out.harnessStateTransitions.length).toBe(2)
    const fields = out.harnessStateTransitions.map((t) => t.field).sort()
    expect(fields).toEqual(['model', 'permissionMode'])
    expect(out.harnessStateTransitions.find((t) => t.field === 'permissionMode')).toMatchObject({ from: 'default', to: 'plan' })
  })

  it('cacheHitRate matches the formula cacheRead/(cacheRead+cacheCreation+input)', () => {
    const rows: ClaudeRowOrUnknown[] = [
      asst('m1', 's', { input_tokens: 100, output_tokens: 0, cache_creation_input_tokens: 100, cache_read_input_tokens: 300 }, 'a1'),
    ]
    const out = projectSessionSummary(rows, new Map(), EMPTY_FILES)
    expect(out.tokens.cacheHitRate).toBeCloseTo(300 / 500)
  })

  it('attaches file-history backups to files in the file-touch index', () => {
    const fileTouchIndex: FileTouchIndex = {
      files: [
        {
          path: '/src/app.ts',
          reads: [{ turnUuid: 'u1', timestamp: '2026-05-26T00:00:00Z' }],
          writes: [{ turnUuid: 'u2', timestamp: '2026-05-26T00:01:00Z' }],
          changed: true,
          lineCount: 10,
        },
      ],
    }
    const rows: ClaudeRowOrUnknown[] = [
      {
        type: 'file-history-snapshot',
        uuid: 'fh1',
        isSnapshotUpdate: false,
        messageId: 'm1',
        snapshot: {
          messageId: 'm1',
          timestamp: '2026-05-26T00:00:30Z',
          trackedFileBackups: {
            '/src/app.ts': { backupFileName: 'abc@v1', backupTime: '2026-05-26T00:00:30Z', version: 1 },
            '/src/untouched.ts': { backupFileName: null, backupTime: '2026-05-26T00:00:30Z', version: 0 },
          },
        },
      } as unknown as ClaudeRowOrUnknown,
    ]
    const out = projectSessionSummary(rows, new Map(), fileTouchIndex)
    expect(out.files).toHaveLength(1)
    expect(out.files[0]!.path).toBe('/src/app.ts')
    expect(out.files[0]!.backups).toHaveLength(1)
    expect(out.files[0]!.backups[0]!.backupFileName).toBe('abc@v1')
  })
})
