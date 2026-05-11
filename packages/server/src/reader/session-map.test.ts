import { describe, it, expect, beforeEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync, mkdtempSync, symlinkSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { SessionMap, listSessions } from './session-map.js'

const tmpRoot = join(tmpdir(), 'cc-viewer-plan-05-session-map')

function makeProjectDir(projectsDir: string, slug: string): string {
  const dir = join(projectsDir, slug)
  mkdirSync(dir, { recursive: true })
  return dir
}

function writeSession(projectDir: string, sessionId: string, lines: string[]): void {
  writeFileSync(join(projectDir, `${sessionId}.jsonl`), lines.join('\n') + '\n', 'utf8')
}

describe('listSessions (D-20, D-21, D-22)', () => {
  beforeEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true })
    mkdirSync(tmpRoot, { recursive: true })
  })

  it('returns [] for missing projectsDir', async () => {
    expect(await listSessions(join(tmpRoot, 'nonexistent'))).toEqual([])
  })

  it('discovers JSONL files across multiple project slugs', async () => {
    const p1 = makeProjectDir(tmpRoot, '-Users-a-project1')
    const p2 = makeProjectDir(tmpRoot, '-Users-a-project2')
    writeSession(p1, 'aaa-111', [
      '{"type":"user","uuid":"u1","sessionId":"aaa-111","timestamp":"2026-04-24T00:00:00Z","message":{"role":"user","content":"hi"}}',
    ])
    writeSession(p1, 'bbb-222', [
      '{"type":"last-prompt","sessionId":"bbb-222","lastPrompt":"test"}',
    ])
    writeSession(p2, 'ccc-333', [
      '{"type":"custom-title","sessionId":"ccc-333","customTitle":"My Title"}',
    ])

    const list = await listSessions(tmpRoot)
    expect(list.length).toBe(3)
    expect(list.map(s => s.sessionId).sort()).toEqual(['aaa-111', 'bbb-222', 'ccc-333'])
    expect(list.find(s => s.sessionId === 'ccc-333')?.title).toBe('My Title')
  })

  it('applies title precedence (D-22)', async () => {
    const p = makeProjectDir(tmpRoot, '-x')
    writeSession(p, 'sid-1', [
      '{"type":"last-prompt","sessionId":"sid-1","lastPrompt":"fallback lp"}',
      '{"type":"ai-title","sessionId":"sid-1","aiTitle":"AI Title"}',
      '{"type":"custom-title","sessionId":"sid-1","customTitle":"Custom Wins"}',
    ])
    const [session] = await listSessions(tmpRoot)
    expect(session!.title).toBe('Custom Wins')
  })

  it('uses sessions-index.json fast path when mtime matches (D-21)', async () => {
    const p = makeProjectDir(tmpRoot, '-fast-path')
    const jsonlPath = join(p, 'fast-1.jsonl')
    writeFileSync(jsonlPath, '{"type":"user","uuid":"u1","message":{"role":"user","content":"x"}}\n', 'utf8')
    const { statSync } = await import('node:fs')
    const mt = statSync(jsonlPath).mtimeMs

    const index = {
      version: 1,
      sessions: [{
        sessionId: 'fast-1',
        customTitle: 'From Index',
        firstTimestamp: '2020-01-01T00:00:00Z',
        lastTimestamp: '2020-01-01T00:00:01Z',
        messageCount: 42,
        mtime: mt,
      }],
    }
    writeFileSync(join(p, 'sessions-index.json'), JSON.stringify(index), 'utf8')

    const [session] = await listSessions(tmpRoot)
    expect(session!.title).toBe('From Index')
    expect(session!.messageCount).toBe(42)    // trusted from index, not from file
  })

  it('falls back to full-file parse when sessions-index.json mtime is stale (D-21)', async () => {
    const p = makeProjectDir(tmpRoot, '-stale-index')
    const jsonlPath = join(p, 'stale-1.jsonl')
    writeFileSync(jsonlPath, [
      '{"type":"user","uuid":"u1","message":{"role":"user","content":"x"}}',
      '{"type":"assistant","uuid":"a1","message":{"role":"assistant","content":[{"type":"text","text":"y"}],"usage":{"input_tokens":1,"output_tokens":1,"cache_creation_input_tokens":0,"cache_read_input_tokens":0}}}',
    ].join('\n'), 'utf8')

    const staleIndex = {
      version: 1,
      sessions: [{
        sessionId: 'stale-1',
        customTitle: 'Stale Title',
        messageCount: 999,
        mtime: 1,          // intentionally stale
      }],
    }
    writeFileSync(join(p, 'sessions-index.json'), JSON.stringify(staleIndex), 'utf8')

    const [session] = await listSessions(tmpRoot)
    // Fallback path recomputes messageCount from the file (2 events, both counted)
    expect(session!.messageCount).toBe(2)
    expect(session!.title).not.toBe('Stale Title')
  })

  it('handles unparseable sessions-index.json gracefully (logs + falls back)', async () => {
    const p = makeProjectDir(tmpRoot, '-bad-index')
    writeFileSync(join(p, 'sess-1.jsonl'), '{"type":"user","uuid":"u","message":{"role":"user","content":"hi"}}\n', 'utf8')
    writeFileSync(join(p, 'sessions-index.json'), 'not valid json', 'utf8')

    const [session] = await listSessions(tmpRoot)
    expect(session).toBeDefined()
    expect(session!.sessionId).toBe('sess-1')
  })

  it('marks hasSubagents when companion directory exists', async () => {
    const p = makeProjectDir(tmpRoot, '-with-agents')
    const sessionId = 'multi'
    writeFileSync(join(p, `${sessionId}.jsonl`), '{"type":"user","uuid":"u","message":{"role":"user","content":"x"}}\n', 'utf8')
    mkdirSync(join(p, sessionId, 'subagents'), { recursive: true })

    const [session] = await listSessions(tmpRoot)
    expect(session!.hasSubagents).toBe(true)
  })
})

describe('buildMetaFromJsonl — claudeCodeVersion + gitBranch (amended D-34, VIEW-09)', () => {
  beforeEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true })
    mkdirSync(tmpRoot, { recursive: true })
  })

  it('captures last-event version and gitBranch onto SessionMeta', async () => {
    const p = makeProjectDir(tmpRoot, '-slug-cv1')
    writeSession(p, 'sess-cv1', [
      '{"type":"user","uuid":"u1","sessionId":"sess-cv1","timestamp":"2026-04-26T00:00:00Z","version":"1.0.0","gitBranch":"main","message":{"role":"user","content":"hi"}}',
      '{"type":"assistant","uuid":"a1","sessionId":"sess-cv1","timestamp":"2026-04-26T00:00:01Z","version":"1.2.3","gitBranch":"main","message":{"role":"assistant","content":[{"type":"text","text":"hello"}]}}',
    ])
    const sessions = await listSessions(tmpRoot)
    const s = sessions.find(x => x.sessionId === 'sess-cv1')!
    expect(s.claudeCodeVersion).toBe('1.2.3')
    expect(s.gitBranch).toBe('main')
  })

  it('returns undefined when last event lacks version or gitBranch', async () => {
    const p = makeProjectDir(tmpRoot, '-slug-cv2')
    writeSession(p, 'sess-cv2', [
      '{"type":"user","uuid":"u1","sessionId":"sess-cv2","timestamp":"2026-04-26T00:00:00Z","message":{"role":"user","content":"hi"}}',
      '{"type":"assistant","uuid":"a1","sessionId":"sess-cv2","timestamp":"2026-04-26T00:00:01Z","message":{"role":"assistant","content":[]}}',
    ])
    const sessions = await listSessions(tmpRoot)
    const s = sessions.find(x => x.sessionId === 'sess-cv2')!
    expect(s.claudeCodeVersion).toBeUndefined()
    expect(s.gitBranch).toBeUndefined()
  })

  it('reflects the LAST event — undefined when last event lacks the fields', async () => {
    const p = makeProjectDir(tmpRoot, '-slug-cv3')
    writeSession(p, 'sess-cv3', [
      '{"type":"user","uuid":"u1","sessionId":"sess-cv3","timestamp":"2026-04-26T00:00:00Z","version":"1.0.0","gitBranch":"feature/x","message":{"role":"user","content":"hi"}}',
      '{"type":"assistant","uuid":"a1","sessionId":"sess-cv3","timestamp":"2026-04-26T00:00:01Z","message":{"role":"assistant","content":[]}}',
    ])
    const sessions = await listSessions(tmpRoot)
    const s = sessions.find(x => x.sessionId === 'sess-cv3')!
    // Last event (assistant) has no version/gitBranch → both undefined
    expect(s.claudeCodeVersion).toBeUndefined()
    expect(s.gitBranch).toBeUndefined()
  })
})

describe('buildMetaFromJsonl — F-2 token aggregation (BROWSER-05)', () => {
  beforeEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true })
    mkdirSync(tmpRoot, { recursive: true })
  })

  it('aggregates per-turn assistant usage into totalUsage', async () => {
    const p = makeProjectDir(tmpRoot, '-tokens')
    writeSession(p, 'usage-sess', [
      '{"type":"assistant","uuid":"a1","sessionId":"usage-sess","timestamp":"2026-04-01T00:00:00Z","message":{"role":"assistant","content":[{"type":"text","text":"hi"}],"usage":{"input_tokens":100,"output_tokens":20,"cache_creation_input_tokens":50,"cache_read_input_tokens":10}}}',
      '{"type":"assistant","uuid":"a2","sessionId":"usage-sess","timestamp":"2026-04-01T00:00:01Z","message":{"role":"assistant","content":[{"type":"text","text":"hi2"}],"usage":{"input_tokens":200,"output_tokens":30,"cache_creation_input_tokens":0,"cache_read_input_tokens":5}}}',
    ])

    const sessions = await listSessions(tmpRoot)
    const session = sessions.find(s => s.sessionId === 'usage-sess')!
    expect(session).toBeDefined()
    expect(session.totalUsage.inputTokens).toBe(300)
    expect(session.totalUsage.outputTokens).toBe(50)
    expect(session.totalUsage.cacheCreationTokens).toBe(50)
    expect(session.totalUsage.cacheReadTokens).toBe(15)
    // Main agent slot populated; subagent aggregation now active (W2.1).
    expect(session.totalUsage.byAgent['']?.inputTokens).toBe(300)
  })

  it('aggregates subagent usage into list-cache totalUsage (W2.1 / TOKEN-01)', async () => {
    const p = makeProjectDir(tmpRoot, '-tokens-with-agents')
    const sessionId = 'multi-agent-tokens'
    writeSession(p, sessionId, [
      '{"type":"assistant","uuid":"a1","sessionId":"multi-agent-tokens","timestamp":"2026-05-09T00:00:00Z","message":{"role":"assistant","content":[{"type":"text","text":"hi"}],"usage":{"input_tokens":10,"output_tokens":5,"cache_creation_input_tokens":0,"cache_read_input_tokens":0}}}',
    ])

    mkdirSync(join(p, sessionId, 'subagents'), { recursive: true })
    writeFileSync(
      join(p, sessionId, 'subagents', 'agent-A.jsonl'),
      '{"type":"assistant","uuid":"sa1","agentId":"A","sessionId":"multi-agent-tokens","timestamp":"2026-05-09T00:00:01Z","message":{"role":"assistant","content":[{"type":"text","text":"alpha"}],"usage":{"input_tokens":100,"output_tokens":50,"cache_creation_input_tokens":0,"cache_read_input_tokens":20}}}\n',
      'utf8',
    )
    writeFileSync(
      join(p, sessionId, 'subagents', 'agent-B.jsonl'),
      '{"type":"assistant","uuid":"sb1","agentId":"B","sessionId":"multi-agent-tokens","timestamp":"2026-05-09T00:00:02Z","message":{"role":"assistant","content":[{"type":"text","text":"beta"}],"usage":{"input_tokens":200,"output_tokens":75,"cache_creation_input_tokens":30,"cache_read_input_tokens":0}}}\n',
      'utf8',
    )

    const sessions = await listSessions(tmpRoot)
    const session = sessions.find(s => s.sessionId === sessionId)!
    expect(session).toBeDefined()
    // Total = main (10/5/0/0) + agentA (100/50/0/20) + agentB (200/75/30/0)
    expect(session.totalUsage.inputTokens).toBe(310)
    expect(session.totalUsage.outputTokens).toBe(130)
    expect(session.totalUsage.cacheCreationTokens).toBe(30)
    expect(session.totalUsage.cacheReadTokens).toBe(20)
    // byAgent breakdown carries each subagent independently.
    expect(session.totalUsage.byAgent['']?.inputTokens).toBe(10)
    expect(session.totalUsage.byAgent['A']?.inputTokens).toBe(100)
    expect(session.totalUsage.byAgent['B']?.outputTokens).toBe(75)
  })
})

describe('pickTitleFromEvents — F-3 full-sessionId fallback (BROWSER-04)', () => {
  beforeEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true })
    mkdirSync(tmpRoot, { recursive: true })
  })

  it('falls back to full sessionId when no title events present', async () => {
    const p = makeProjectDir(tmpRoot, '-titlefallback')
    // Use a sessionId longer than 8 chars and with NO custom-title / ai-title /
    // agent-name / last-prompt events. Only user + assistant turns.
    writeSession(p, 'synthetic-13chr', [
      '{"type":"user","uuid":"u1","sessionId":"synthetic-13chr","timestamp":"2026-04-01T00:00:00Z","message":{"role":"user","content":"hi"}}',
      '{"type":"assistant","uuid":"a1","sessionId":"synthetic-13chr","timestamp":"2026-04-01T00:00:01Z","message":{"role":"assistant","content":[{"type":"text","text":"yo"}]}}',
    ])

    const sessions = await listSessions(tmpRoot)
    const session = sessions.find(s => s.sessionId === 'synthetic-13chr')!
    expect(session).toBeDefined()
    expect(session.title).toBe('synthetic-13chr')
    expect(session.title.length).toBeGreaterThan(8)
    expect(session.title).not.toBe('syntheti')
  })
})

describe('F-2 regression anchor — totalUsage non-zero for fixture with usage blocks', () => {
  beforeEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true })
    mkdirSync(tmpRoot, { recursive: true })
  })

  it('buildMetaFromJsonl aggregates per-turn usage so SessionMeta.totalUsage > 0 (D-40.1 / BROWSER-05 anchor)', async () => {
    // Anchor against the 02-10 walkthrough failure: the synthetic-10k fixture
    // had ~4341 assistant `usage` blocks but SessionMeta.totalUsage came back
    // {0,0,0,0}. This test guards against that regression returning silently.
    const p = makeProjectDir(tmpRoot, '-anchor-f2')
    writeSession(p, 'anchor-f2-session', [
      '{"type":"user","uuid":"u1","sessionId":"anchor-f2-session","timestamp":"2026-04-01T00:00:00Z","message":{"role":"user","content":"hi"}}',
      '{"type":"assistant","uuid":"a1","sessionId":"anchor-f2-session","timestamp":"2026-04-01T00:00:01Z","message":{"role":"assistant","content":[{"type":"text","text":"hello"}],"usage":{"input_tokens":42,"output_tokens":7,"cache_creation_input_tokens":3,"cache_read_input_tokens":1}}}',
    ])
    const [session] = await listSessions(tmpRoot)
    // Anchor 1: total fields are non-zero
    expect(session!.totalUsage.inputTokens).toBe(42)
    expect(session!.totalUsage.outputTokens).toBe(7)
    expect(session!.totalUsage.cacheCreationTokens).toBe(3)
    expect(session!.totalUsage.cacheReadTokens).toBe(1)
    // Anchor 2: byAgent[''] (main-agent slot) populated
    expect(session!.totalUsage.byAgent['']).toBeDefined()
    expect(session!.totalUsage.byAgent['']!.inputTokens).toBe(42)
    // Anchor 3: human-readable failure message if regression returns
    const sumOfFour =
      session!.totalUsage.inputTokens +
      session!.totalUsage.outputTokens +
      session!.totalUsage.cacheCreationTokens +
      session!.totalUsage.cacheReadTokens
    expect(sumOfFour, 'regression: totalUsage summed to zero — buildMetaFromJsonl is no longer aggregating per-turn usage.').toBeGreaterThan(0)
  })
})

describe('listSessionsForProject — F-4 symlink-friendly enumeration', () => {
  beforeEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true })
    mkdirSync(tmpRoot, { recursive: true })
  })

  it('enumerates symlinked .jsonl files as sessions', async () => {
    if (process.platform === 'win32') return // symlinks require admin on Windows

    const p = makeProjectDir(tmpRoot, '-symlinkproject')
    // Write a real .jsonl file outside the project dir (sibling temp dir).
    const targetDir = mkdtempSync(join(tmpdir(), 'cc-viewer-symlink-target-'))
    const realJsonl = join(targetDir, 'real-session.jsonl')
    writeFileSync(realJsonl, '{"type":"user","uuid":"u1","sessionId":"symlinked-id","timestamp":"2026-04-01T00:00:00Z","message":{"role":"user","content":"hi"}}\n', 'utf8')

    // Symlink it into the project dir under a different name.
    symlinkSync(realJsonl, join(p, 'symlinked-id.jsonl'))

    const sessions = await listSessions(tmpRoot)
    const session = sessions.find(s => s.sessionId === 'symlinked-id')
    expect(session).toBeDefined()
    expect(session!.messageCount).toBe(1)
  })
})

describe('SessionMap (D-20 lazy cache)', () => {
  beforeEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true })
    mkdirSync(tmpRoot, { recursive: true })
  })

  it('caches on first get, returns same array on subsequent calls', async () => {
    const p = makeProjectDir(tmpRoot, '-p')
    writeSession(p, 's1', ['{"type":"user","uuid":"u","message":{"role":"user","content":"x"}}'])

    const map = new SessionMap()
    const first = await map.get(tmpRoot)
    expect(map.isCached()).toBe(true)
    const second = await map.get(tmpRoot)
    expect(second).toBe(first)  // same reference = cache hit
  })

  it('invalidate() clears the cache', async () => {
    const p = makeProjectDir(tmpRoot, '-p')
    writeSession(p, 's1', ['{"type":"user","uuid":"u","message":{"role":"user","content":"x"}}'])

    const map = new SessionMap()
    await map.get(tmpRoot)
    map.invalidate()
    expect(map.isCached()).toBe(false)
    const sessions = await map.get(tmpRoot)
    expect(sessions.length).toBe(1)
  })
})
