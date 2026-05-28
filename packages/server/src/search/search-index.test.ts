import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { Turn } from '@cc-viewer/shared'
import { SearchIndex, MARK_OPEN_SENTINEL, MARK_CLOSE_SENTINEL } from './search-index.js'

function makeTurn(partial: Partial<Turn> & Pick<Turn, 'uuid' | 'role'>): Turn {
  return {
    uuid: partial.uuid,
    parentUuid: partial.parentUuid ?? null,
    timestamp: partial.timestamp ?? '2026-05-09T00:00:00Z',
    role: partial.role,
    textBlocks: partial.textBlocks ?? [],
    thinkingBlocks: partial.thinkingBlocks ?? [],
    toolUses: partial.toolUses ?? [],
    toolResults: partial.toolResults ?? [],
    isMeta: partial.isMeta ?? false,
    agentId: partial.agentId ?? null,
  }
}

describe('SearchIndex', () => {
  let dir: string
  let index: SearchIndex

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'cc-viewer-search-'))
    index = new SearchIndex(join(dir, 'search.db'))
  })

  afterEach(() => {
    index.close()
    rmSync(dir, { recursive: true, force: true })
  })

  it('returns no hits for empty query', () => {
    const result = index.search('')
    expect(result.hits).toEqual([])
    expect(result.truncated).toBe(false)
  })

  it('indexes user + assistant text and returns ranked hits with snippet markers', () => {
    index.indexFull(
      'sess-A',
      null,
      '/tmp/sess-A.jsonl',
      1000,
      500,
      [
        makeTurn({ uuid: 'u1', role: 'user', textBlocks: ['help me fix the parser bug'] }),
        makeTurn({ uuid: 'a1', role: 'assistant', textBlocks: ['the parser handles tokens, parsers are recursive'] }),
      ],
      { title: 'Session A', projectSlug: '-Users-x-projA' },
    )
    index.indexFull(
      'sess-B',
      null,
      '/tmp/sess-B.jsonl',
      2000,
      300,
      [makeTurn({ uuid: 'u2', role: 'user', textBlocks: ['unrelated text about graphics'] })],
      { title: 'Session B', projectSlug: '-Users-x-projB' },
    )

    const { hits, truncated } = index.search('parser')
    expect(truncated).toBe(false)
    expect(hits.length).toBeGreaterThanOrEqual(2)
    for (const hit of hits) expect(hit.sessionId).toBe('sess-A')
    expect(hits[0].snippetHtml).toContain(`${MARK_OPEN_SENTINEL}parser${MARK_CLOSE_SENTINEL}`)
    expect(hits[0].sessionTitle).toBe('Session A')
    expect(hits[0].projectSlug).toBe('-Users-x-projA')
    expect(['user', 'assistant']).toContain(hits[0].role)
  })

  it('extracts text from thinking, tool_use input, and tool_result content', () => {
    index.indexFull(
      'sess',
      null,
      '/tmp/sess.jsonl',
      1,
      1,
      [
        makeTurn({
          uuid: 't1',
          role: 'assistant',
          thinkingBlocks: ['I should investigate the migration script'],
          toolUses: [{ id: 'tool-1', name: 'Bash', input: { command: 'grep migration src/' } }],
          toolResults: [{ tool_use_id: 'tool-1', content: 'src/db/migration.ts: line 4' }],
        }),
      ],
      { title: 'S', projectSlug: 'p' },
    )

    const kinds = new Set(index.search('migration').hits.map((h) => h.contentKind))
    expect(kinds.has('thinking')).toBe(true)
    expect(kinds.has('tool_use')).toBe(true)
    expect(kinds.has('tool_result')).toBe(true)
  })

  it('skips meta turns and system roles', () => {
    index.indexFull(
      'sess',
      null,
      '/tmp/sess.jsonl',
      1,
      1,
      [
        makeTurn({ uuid: 's1', role: 'system', textBlocks: ['system note about parser'] }),
        makeTurn({ uuid: 'm1', role: 'user', isMeta: true, textBlocks: ['/clear parser'] }),
        makeTurn({ uuid: 'k1', role: 'user', textBlocks: ['kept parser'] }),
      ],
      { title: 'S', projectSlug: 'p' },
    )
    const hits = index.search('parser').hits
    expect(hits.map((h) => h.turnUuid)).toEqual(['k1'])
  })

  it('replaces all rows on indexFull (no duplicate hits across reindex)', () => {
    const turns = [makeTurn({ uuid: 'u1', role: 'user', textBlocks: ['the lonely parser'] })]
    index.indexFull('sess', null, '/tmp/sess.jsonl', 1, 1, turns, { title: 'S', projectSlug: 'p' })
    index.indexFull('sess', null, '/tmp/sess.jsonl', 2, 2, turns, { title: 'S', projectSlug: 'p' })
    expect(index.search('parser').hits).toHaveLength(1)
  })

  it('appendDelta adds new rows without dropping prior ones', () => {
    index.indexFull(
      'sess',
      null,
      '/tmp/sess.jsonl',
      1,
      10,
      [makeTurn({ uuid: 'u1', role: 'user', textBlocks: ['original parser content'] })],
      { title: 'S', projectSlug: 'p' },
    )
    index.appendDelta(
      'sess',
      null,
      [makeTurn({ uuid: 'a1', role: 'assistant', textBlocks: ['new parser response'] })],
      { mtimeMs: 2, sizeBytes: 20, byteOffset: 20, jsonlPath: '/tmp/sess.jsonl' },
    )
    const uuids = index.search('parser').hits.map((h) => h.turnUuid).sort()
    expect(uuids).toEqual(['a1', 'u1'])
  })

  it('deleteSession drops main + persists subagents only when agentId given', () => {
    index.indexFull(
      'sess',
      null,
      '/tmp/sess.jsonl',
      1,
      1,
      [makeTurn({ uuid: 'main1', role: 'user', textBlocks: ['main parser'] })],
      { title: 'S', projectSlug: 'p' },
    )
    index.indexFull(
      'sess',
      'agent-1',
      '/tmp/sess/subagents/agent-1.jsonl',
      1,
      1,
      [makeTurn({ uuid: 'sub1', role: 'user', textBlocks: ['sub parser'] })],
      { title: 'S', projectSlug: 'p' },
    )

    index.deleteSession('sess', 'agent-1')
    const afterAgent = index.search('parser').hits.map((h) => h.turnUuid).sort()
    expect(afterAgent).toEqual(['main1'])

    index.deleteSession('sess')
    expect(index.search('parser').hits).toEqual([])
    expect(index.countSessions()).toBe(0)
  })

  it('persists across instances on the same DB file', () => {
    const dbPath = join(dir, 'search.db')
    index.indexFull(
      'sess',
      null,
      '/tmp/sess.jsonl',
      1,
      1,
      [makeTurn({ uuid: 'u1', role: 'user', textBlocks: ['durable parser'] })],
      { title: 'S', projectSlug: 'p' },
    )
    index.close()

    const reopened = new SearchIndex(dbPath)
    try {
      const hits = reopened.search('parser').hits
      expect(hits).toHaveLength(1)
      expect(hits[0].turnUuid).toBe('u1')
      expect(reopened.getFile('sess', null)?.mtimeMs).toBe(1)
    } finally {
      reopened.close()
    }
    // Re-open the original dir so afterEach close() doesn't double-close.
    index = new SearchIndex(dbPath)
  })

  it('truncates results when limit exceeded', () => {
    const turns = Array.from({ length: 30 }, (_, i) =>
      makeTurn({ uuid: `t${i}`, role: 'user', textBlocks: [`hit number ${i} parser appears`] }),
    )
    index.indexFull('sess', null, '/tmp/sess.jsonl', 1, 1, turns, { title: 'S', projectSlug: 'p' })
    const result = index.search('parser', { limit: 10 })
    expect(result.hits).toHaveLength(10)
    expect(result.truncated).toBe(true)
  })

  it('007 T050: indexes attachment payload text (file paths, hook stdout, skill listings)', () => {
    const rows = [
      {
        type: 'attachment',
        uuid: 'att-1',
        timestamp: '2026-05-26T00:00:00Z',
        attachment: { type: 'directory', path: '/tmp', displayPath: '/tmp', content: 'rare-keyword-xyz.txt\nother.txt' },
      },
      {
        type: 'attachment',
        uuid: 'att-2',
        timestamp: '2026-05-26T00:00:01Z',
        attachment: { type: 'hook_success', hookEvent: 'PreToolUse', hookName: 'lint', toolUseID: 'tu1', exitCode: 0, stdout: 'no rare-keyword-xyz issues', stderr: '' },
      },
    ] as unknown as Parameters<typeof index.indexFull>[7]
    index.indexFull('sess', null, '/tmp/sess.jsonl', 1, 1, [], { title: 'S', projectSlug: 'p' }, rows)
    const hits = index.search('rare-keyword-xyz').hits
    expect(hits.length).toBeGreaterThanOrEqual(2)
    const uuids = new Set(hits.map((h) => h.turnUuid))
    expect(uuids.has('att-1')).toBe(true)
    expect(uuids.has('att-2')).toBe(true)
  })

  it('007 T050: indexes system api_error messages', () => {
    const rows = [
      {
        type: 'system',
        uuid: 'err-1',
        subtype: 'api_error',
        timestamp: '2026-05-26T00:00:00Z',
        error: { message: 'unique-error-marker rate_limit_exceeded' },
        retryAttempt: 0,
        maxRetries: 3,
      },
    ] as unknown as Parameters<typeof index.indexFull>[7]
    index.indexFull('sess', null, '/tmp/sess.jsonl', 1, 1, [], { title: 'S', projectSlug: 'p' }, rows)
    const hits = index.search('unique-error-marker').hits
    expect(hits.length).toBe(1)
    expect(hits[0]!.turnUuid).toBe('err-1')
  })

  it('007 T050: indexes system informational/away_summary content fields', () => {
    const rows = [
      {
        type: 'system',
        uuid: 'info-1',
        subtype: 'informational',
        timestamp: '2026-05-26T00:00:00Z',
        content: 'Unknown command: /verywierdslashcommand',
        level: 'warning',
      },
    ] as unknown as Parameters<typeof index.indexFull>[7]
    index.indexFull('sess', null, '/tmp/sess.jsonl', 1, 1, [], { title: 'S', projectSlug: 'p' }, rows)
    const hits = index.search('verywierdslashcommand').hits
    expect(hits.length).toBe(1)
    expect(hits[0]!.turnUuid).toBe('info-1')
  })

  it('007 T050: appendDelta also indexes rows', () => {
    index.indexFull('sess', null, '/tmp/sess.jsonl', 1, 1, [makeTurn({ uuid: 'u1', role: 'user', textBlocks: ['nothing interesting'] })], { title: 'S', projectSlug: 'p' })
    const rows = [
      {
        type: 'attachment',
        uuid: 'att-delta',
        timestamp: '2026-05-26T00:00:00Z',
        attachment: { type: 'directory', path: '/tmp', displayPath: '/tmp', content: 'delta-marker.txt' },
      },
    ] as unknown as readonly unknown[]
    index.appendDelta(
      'sess',
      null,
      [],
      { mtimeMs: 2, sizeBytes: 20, byteOffset: 20, jsonlPath: '/tmp/sess.jsonl' },
      undefined,
      rows as unknown as Parameters<typeof index.appendDelta>[5],
    )
    const hits = index.search('delta-marker').hits
    expect(hits.length).toBe(1)
    expect(hits[0]!.turnUuid).toBe('att-delta')
  })
})
