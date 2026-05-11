import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, utimesSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { SessionMap } from '../reader/session-map.js'
import { SearchIndex } from './search-index.js'
import { SearchReconciler } from './reconciler.js'

function writeSession(projectsDir: string, slug: string, sessionId: string, lines: string[]): string {
  const projectDir = join(projectsDir, slug)
  mkdirSync(projectDir, { recursive: true })
  const path = join(projectDir, `${sessionId}.jsonl`)
  writeFileSync(path, lines.join('\n') + '\n', 'utf8')
  return path
}

function userLine(uuid: string, sessionId: string, ts: string, text: string): string {
  return JSON.stringify({
    type: 'user',
    uuid,
    sessionId,
    timestamp: ts,
    message: { role: 'user', content: text },
  })
}

function assistantLine(uuid: string, sessionId: string, ts: string, text: string): string {
  return JSON.stringify({
    type: 'assistant',
    uuid,
    sessionId,
    timestamp: ts,
    message: {
      role: 'assistant',
      content: [{ type: 'text', text }],
      usage: { input_tokens: 1, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
    },
  })
}

describe('SearchReconciler', () => {
  let dir: string
  let projectsDir: string
  let dbPath: string
  let index: SearchIndex
  let sessionMap: SessionMap
  let reconciler: SearchReconciler

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'cc-viewer-recon-'))
    projectsDir = join(dir, 'projects')
    mkdirSync(projectsDir, { recursive: true })
    dbPath = join(dir, 'search.db')
    index = new SearchIndex(dbPath)
    sessionMap = new SessionMap()
    reconciler = new SearchReconciler(index, sessionMap, projectsDir)
  })

  afterEach(() => {
    index.close()
    rmSync(dir, { recursive: true, force: true })
  })

  it('indexes all on-disk sessions on cold start', async () => {
    writeSession(projectsDir, '-Users-x-projA', 'sess-1', [
      userLine('u1', 'sess-1', '2026-04-01T00:00:00Z', 'looking for the parser bug'),
      assistantLine('a1', 'sess-1', '2026-04-01T00:00:01Z', 'the parser handles tokens'),
    ])
    writeSession(projectsDir, '-Users-x-projB', 'sess-2', [
      userLine('u2', 'sess-2', '2026-04-02T00:00:00Z', 'unrelated graphics question'),
    ])

    await reconciler.start()

    const parserHits = index.search('parser').hits
    expect(parserHits.length).toBeGreaterThanOrEqual(2)
    expect(parserHits.every((h) => h.sessionId === 'sess-1')).toBe(true)

    expect(index.search('graphics').hits.map((h) => h.sessionId)).toEqual(['sess-2'])
    expect(index.countSessions()).toBe(2)
  })

  it('skips sessions whose mtime + size match the persisted index', async () => {
    const path = writeSession(projectsDir, '-Users-x-projA', 'sess-1', [
      userLine('u1', 'sess-1', '2026-04-01T00:00:00Z', 'hello parser'),
    ])
    await reconciler.start()
    expect(index.search('parser').hits).toHaveLength(1)

    // Mutate the session in-memory only — pretend nothing changed on disk.
    // Re-run; should NOT re-index. We assert via row count: re-indexing would
    // delete + reinsert with the same content (count stays 1) so we test the
    // mtime-skip path differently: corrupt the indexed row, re-run, expect no fix.
    const stmt = (index as unknown as { db: { prepare: (s: string) => { run: (...a: unknown[]) => unknown } } }).db
      .prepare('UPDATE messages SET content = ? WHERE turn_uuid = ?')
    stmt.run('SENTINEL_TAMPERED', 'u1')
    expect(index.search('parser').hits).toHaveLength(0)

    sessionMap.invalidate()
    await reconciler.start()

    // Skip path was hit: tampered row was NOT replaced because mtime matches.
    expect(index.search('parser').hits).toHaveLength(0)
    expect(index.search('SENTINEL_TAMPERED').hits).toHaveLength(1)

    // Now actually mutate the file; reconciler should detect the mtime change.
    writeFileSync(path, userLine('u1', 'sess-1', '2026-04-01T00:00:00Z', 'updated parser content') + '\n')
    sessionMap.invalidate()
    await reconciler.start()

    expect(index.search('SENTINEL_TAMPERED').hits).toHaveLength(0)
    expect(index.search('parser').hits).toHaveLength(1)
  })

  it('drops orphan sessions that disappeared from disk', async () => {
    writeSession(projectsDir, '-Users-x-projA', 'sess-1', [
      userLine('u1', 'sess-1', '2026-04-01T00:00:00Z', 'parser content'),
    ])
    await reconciler.start()
    expect(index.countSessions()).toBe(1)

    rmSync(join(projectsDir, '-Users-x-projA'), { recursive: true })
    sessionMap.invalidate()
    await reconciler.start()
    expect(index.search('parser').hits).toHaveLength(0)
    expect(index.countSessions()).toBe(0)
  })

  it('emits progress events during reconciliation', async () => {
    for (let i = 0; i < 3; i++) {
      writeSession(projectsDir, `-Users-x-proj${i}`, `sess-${i}`, [
        userLine(`u${i}`, `sess-${i}`, '2026-04-01T00:00:00Z', `parser content ${i}`),
      ])
    }
    const events: number[] = []
    reconciler.onProgress((p) => events.push(p.done))

    await reconciler.start()

    expect(events.length).toBeGreaterThan(0)
    expect(events[events.length - 1]).toBe(3)
  })

  it('status() reflects in-flight + completed state', async () => {
    writeSession(projectsDir, '-Users-x-projA', 'sess-1', [
      userLine('u1', 'sess-1', '2026-04-01T00:00:00Z', 'parser'),
    ])
    expect(reconciler.status().isReconciling).toBe(false)

    await reconciler.start()
    const after = reconciler.status()
    expect(after.isReconciling).toBe(false)
    expect(after.totalSessions).toBe(1)
    expect(after.pendingSessions).toBe(0)
  })

  it('indexes subagent files alongside the main session', async () => {
    const sessionId = 'sess-with-sub'
    const projectDir = join(projectsDir, '-Users-x-projA')
    mkdirSync(projectDir, { recursive: true })
    writeFileSync(
      join(projectDir, `${sessionId}.jsonl`),
      userLine('u1', sessionId, '2026-04-01T00:00:00Z', 'main session asks subagent') + '\n',
    )
    const subagentsDir = join(projectDir, sessionId, 'subagents')
    mkdirSync(subagentsDir, { recursive: true })
    writeFileSync(
      join(subagentsDir, 'agent-abc.jsonl'),
      userLine('s1', sessionId, '2026-04-01T00:00:01Z', 'subagent investigates the parser internals') + '\n',
    )

    await reconciler.start()
    const hits = index.search('parser').hits
    expect(hits.some((h) => h.agentId === 'abc')).toBe(true)
    expect(index.listIndexedAgentIds(sessionId)).toEqual(['abc'])
  })

  // utimesSync is imported just to silence unused warnings if removed; assert at least one usage.
  it('detects subagent-only mtime changes', async () => {
    const sessionId = 'sess-sub-update'
    const projectDir = join(projectsDir, '-Users-x-projA')
    mkdirSync(projectDir, { recursive: true })
    const mainPath = join(projectDir, `${sessionId}.jsonl`)
    writeFileSync(mainPath, userLine('u1', sessionId, '2026-04-01T00:00:00Z', 'main') + '\n')
    const subagentsDir = join(projectDir, sessionId, 'subagents')
    mkdirSync(subagentsDir, { recursive: true })
    const agentPath = join(subagentsDir, 'agent-xyz.jsonl')
    writeFileSync(agentPath, userLine('s1', sessionId, '2026-04-01T00:00:01Z', 'first version') + '\n')

    await reconciler.start()
    expect(index.search('first').hits.some((h) => h.agentId === 'xyz')).toBe(true)

    writeFileSync(agentPath, userLine('s2', sessionId, '2026-04-01T00:00:02Z', 'second version of the agent') + '\n')
    // Force mtime forward to defeat sub-second stat resolution on some filesystems.
    const now = new Date()
    utimesSync(agentPath, now, new Date(now.getTime() + 2000))
    sessionMap.invalidate()

    await reconciler.start()
    expect(index.search('first').hits).toHaveLength(0)
    expect(index.search('second').hits.some((h) => h.agentId === 'xyz')).toBe(true)
  })
})
