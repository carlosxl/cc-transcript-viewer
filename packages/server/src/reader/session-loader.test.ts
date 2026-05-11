import { describe, it, expect, beforeAll } from 'vitest'
import { writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { loadSessionFromDisk } from './session-loader.js'
import { SessionCache } from './session-cache.js'

const tmpRoot = join(tmpdir(), 'cc-viewer-plan-03-test')

beforeAll(() => {
  rmSync(tmpRoot, { recursive: true, force: true })
  mkdirSync(tmpRoot, { recursive: true })
})

describe('loadSessionFromDisk', () => {
  it('loads a simple session and reports correct title + turn count (D-22)', async () => {
    const projectDir = join(tmpRoot, '-Users-test-project')
    mkdirSync(projectDir, { recursive: true })
    const sessionPath = join(projectDir, 'abc-123.jsonl')
    writeFileSync(sessionPath, [
      '{"type":"last-prompt","sessionId":"abc-123","lastPrompt":"prompt content for fallback title","timestamp":"2026-04-24T00:00:00Z"}',
      '{"type":"custom-title","sessionId":"abc-123","customTitle":"User Custom Title","timestamp":"2026-04-24T00:00:01Z"}',
      '{"type":"user","uuid":"u1","sessionId":"abc-123","timestamp":"2026-04-24T00:00:02Z","message":{"role":"user","content":"hi"}}',
      '{"type":"assistant","uuid":"a1","sessionId":"abc-123","timestamp":"2026-04-24T00:00:03Z","message":{"role":"assistant","content":[{"type":"text","text":"hi back"}],"usage":{"input_tokens":20,"output_tokens":10,"cache_creation_input_tokens":0,"cache_read_input_tokens":0}}}',
      '',
    ].join('\n'), 'utf8')

    const { session, mtimeMs } = await loadSessionFromDisk(sessionPath)

    expect(session.sessionId).toBe('abc-123')
    expect(session.projectSlug).toBe('-Users-test-project')
    expect(session.title).toBe('User Custom Title')       // custom-title wins over last-prompt
    expect(session.messageCount).toBe(2)                  // user + assistant
    expect(session.turns.length).toBe(2)
    expect(session.hasSubagents).toBe(false)
    expect(session.totalUsage.inputTokens).toBe(20)
    expect(session.totalUsage.outputTokens).toBe(10)
    expect(session.parseWarnings).toBe(0)
    expect(mtimeMs).toBeGreaterThan(0)
  })

  it('falls back to last-prompt slice for title when no custom-title (D-22)', async () => {
    const projectDir = join(tmpRoot, '-Users-test-p2')
    mkdirSync(projectDir, { recursive: true })
    const sessionPath = join(projectDir, 'def-456.jsonl')
    writeFileSync(sessionPath, '{"type":"last-prompt","sessionId":"def-456","lastPrompt":"this is a long prompt that should be trimmed to eighty characters for use as the session title","timestamp":"2026-04-24T00:00:00Z"}\n', 'utf8')

    const { session } = await loadSessionFromDisk(sessionPath)
    expect(session.title.length).toBeLessThanOrEqual(80)
    expect(session.title).toContain('this is a long prompt')
  })

  it('counts parseWarnings from malformed lines in session', async () => {
    const projectDir = join(tmpRoot, '-Users-test-p3')
    mkdirSync(projectDir, { recursive: true })
    const sessionPath = join(projectDir, 'ghi-789.jsonl')
    writeFileSync(sessionPath, [
      '{"type":"user","uuid":"u1","sessionId":"ghi-789","timestamp":"2026-04-24T00:00:00Z","message":{"role":"user","content":"ok"}}',
      '{garbage',
      '',
    ].join('\n'), 'utf8')

    const { session } = await loadSessionFromDisk(sessionPath)
    expect(session.parseWarnings).toBe(1)
    expect(session.turns.length).toBe(1)
  })

  it('falls back to full sessionId for title when no title events present (F-3)', async () => {
    const projectDir = join(tmpRoot, '-Users-test-titlefallback')
    mkdirSync(projectDir, { recursive: true })
    const sessionId = 'long-session-id-13'
    const sessionPath = join(projectDir, `${sessionId}.jsonl`)
    writeFileSync(sessionPath, [
      '{"type":"user","uuid":"u1","sessionId":"long-session-id-13","timestamp":"2026-04-01T00:00:00Z","message":{"role":"user","content":"hi"}}',
      '{"type":"assistant","uuid":"a1","sessionId":"long-session-id-13","timestamp":"2026-04-01T00:00:01Z","message":{"role":"assistant","content":[{"type":"text","text":"yo"}]}}',
    ].join('\n'), 'utf8')

    const { session } = await loadSessionFromDisk(sessionPath)
    expect(session.title).toBe('long-session-id-13')
    expect(session.title.length).toBeGreaterThan(8)
  })

  it('loads subagents from companion directory', async () => {
    const projectDir = join(tmpRoot, '-Users-test-p4')
    const sessionId = 'multi-agent-session'
    mkdirSync(join(projectDir, sessionId, 'subagents'), { recursive: true })
    const sessionPath = join(projectDir, `${sessionId}.jsonl`)
    writeFileSync(sessionPath, '{"type":"user","uuid":"u1","sessionId":"multi-agent-session","timestamp":"2026-04-24T00:00:00Z","message":{"role":"user","content":"spawn agent"}}\n', 'utf8')

    const agentPath = join(projectDir, sessionId, 'subagents', 'agent-xyz.jsonl')
    writeFileSync(agentPath, '{"type":"assistant","uuid":"sa1","agentId":"xyz","sessionId":"multi-agent-session","timestamp":"2026-04-24T00:00:01Z","message":{"role":"assistant","content":[{"type":"text","text":"agent reply"}],"usage":{"input_tokens":50,"output_tokens":25,"cache_creation_input_tokens":0,"cache_read_input_tokens":0}}}\n', 'utf8')

    writeFileSync(join(projectDir, sessionId, 'subagents', 'agent-xyz.meta.json'), JSON.stringify({ agentType: 'research', description: 'Research agent' }), 'utf8')

    const { session } = await loadSessionFromDisk(sessionPath)
    expect(session.hasSubagents).toBe(true)
    expect(session.subagents.length).toBe(1)
    expect(session.subagents[0]!.agentId).toBe('xyz')
    expect(session.subagents[0]!.agentType).toBe('research')
    expect(session.subagents[0]!.turns.length).toBe(1)

    // Token aggregation: main had no usage, subagent contributed 50/25
    expect(session.totalUsage.inputTokens).toBe(50)
    expect(session.totalUsage.outputTokens).toBe(25)
    expect(session.totalUsage.byAgent['xyz']?.inputTokens).toBe(50)
    expect(session.totalUsage.byAgent['']?.inputTokens).toBe(0)
  })

  it('resolves subagent linkages from queue-operation events (W1.1)', async () => {
    const projectDir = join(tmpRoot, '-Users-test-linker')
    const sessionId = 'linked-session'
    mkdirSync(join(projectDir, sessionId, 'subagents'), { recursive: true })
    const sessionPath = join(projectDir, `${sessionId}.jsonl`)

    writeFileSync(sessionPath, [
      '{"type":"assistant","uuid":"a1","sessionId":"linked-session","timestamp":"2026-05-09T00:00:00Z","message":{"role":"assistant","content":[{"type":"tool_use","id":"toolu_AAA","name":"Task","input":{"description":"go research"}}]}}',
      '{"type":"queue-operation","uuid":"qo1","sessionId":"linked-session","timestamp":"2026-05-09T00:00:01Z","operation":"enqueue","content":"<task-id>res123</task-id><tool-use-id>toolu_AAA</tool-use-id>"}',
      '{"type":"queue-operation","uuid":"qo2","sessionId":"linked-session","timestamp":"2026-05-09T00:00:05Z","operation":"remove","content":"<task-id>res123</task-id><tool-use-id>toolu_AAA</tool-use-id>"}',
      '',
    ].join('\n'), 'utf8')

    writeFileSync(
      join(projectDir, sessionId, 'subagents', 'agent-res123.jsonl'),
      '{"type":"assistant","uuid":"sa1","agentId":"res123","sessionId":"linked-session","timestamp":"2026-05-09T00:00:02Z","message":{"role":"assistant","content":[{"type":"text","text":"working"}]}}\n',
      'utf8',
    )

    const { session } = await loadSessionFromDisk(sessionPath)

    // Subagent linkage resolved from queue-operation.
    expect(session.subagents[0]!.toolUseId).toBe('toolu_AAA')
    expect(session.subagents[0]!.status).toBe('completed') // 'remove' operation
    // Parent ToolUse.childAgentId set so the UI can offer drill-in.
    const parentTurn = session.turns.find(t => t.toolUses.length > 0)!
    expect(parentTurn.toolUses[0]!.childAgentId).toBe('res123')
  })

  it('falls back to tool_result agentId text when queue-operation absent', async () => {
    const projectDir = join(tmpRoot, '-Users-test-linker-fb')
    const sessionId = 'fallback-session'
    mkdirSync(join(projectDir, sessionId, 'subagents'), { recursive: true })
    const sessionPath = join(projectDir, `${sessionId}.jsonl`)

    writeFileSync(sessionPath, [
      '{"type":"assistant","uuid":"a1","sessionId":"fallback-session","timestamp":"2026-05-09T00:00:00Z","message":{"role":"assistant","content":[{"type":"tool_use","id":"toolu_BBB","name":"Agent","input":{}}]}}',
      '{"type":"user","uuid":"u1","sessionId":"fallback-session","timestamp":"2026-05-09T00:00:01Z","message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"toolu_BBB","content":"Async agent launched successfully.\\nagentId: fb456"}]}}',
      '',
    ].join('\n'), 'utf8')

    writeFileSync(
      join(projectDir, sessionId, 'subagents', 'agent-fb456.jsonl'),
      '{"type":"assistant","uuid":"sa1","agentId":"fb456","sessionId":"fallback-session","timestamp":"2026-05-09T00:00:02Z","message":{"role":"assistant","content":[{"type":"text","text":"hi"}]}}\n',
      'utf8',
    )

    const { session } = await loadSessionFromDisk(sessionPath)
    expect(session.subagents[0]!.toolUseId).toBe('toolu_BBB')
    const parentTurn = session.turns.find(t => t.toolUses.length > 0)!
    expect(parentTurn.toolUses[0]!.childAgentId).toBe('fb456')
  })

  it('detects nested subagent spawning (childAgentIds populated)', async () => {
    const projectDir = join(tmpRoot, '-Users-test-linker-nested')
    const sessionId = 'nested-session'
    mkdirSync(join(projectDir, sessionId, 'subagents'), { recursive: true })
    const sessionPath = join(projectDir, `${sessionId}.jsonl`)

    writeFileSync(sessionPath, [
      '{"type":"assistant","uuid":"a1","sessionId":"nested-session","timestamp":"2026-05-09T00:00:00Z","message":{"role":"assistant","content":[{"type":"tool_use","id":"toolu_PARENT","name":"Task","input":{}}]}}',
      '{"type":"queue-operation","uuid":"qo1","sessionId":"nested-session","timestamp":"2026-05-09T00:00:01Z","operation":"enqueue","content":"<task-id>parent01</task-id><tool-use-id>toolu_PARENT</tool-use-id>"}',
      '',
    ].join('\n'), 'utf8')

    // Parent subagent spawns a child.
    writeFileSync(
      join(projectDir, sessionId, 'subagents', 'agent-parent01.jsonl'),
      [
        '{"type":"assistant","uuid":"sa1","agentId":"parent01","sessionId":"nested-session","timestamp":"2026-05-09T00:00:02Z","message":{"role":"assistant","content":[{"type":"tool_use","id":"toolu_CHILD","name":"Task","input":{}}]}}',
        '{"type":"queue-operation","uuid":"qo2","agentId":"parent01","sessionId":"nested-session","timestamp":"2026-05-09T00:00:03Z","operation":"enqueue","content":"<task-id>child01</task-id><tool-use-id>toolu_CHILD</tool-use-id>"}',
        '',
      ].join('\n'),
      'utf8',
    )
    writeFileSync(
      join(projectDir, sessionId, 'subagents', 'agent-child01.jsonl'),
      '{"type":"assistant","uuid":"sa2","agentId":"child01","sessionId":"nested-session","timestamp":"2026-05-09T00:00:04Z","message":{"role":"assistant","content":[{"type":"text","text":"done"}]}}\n',
      'utf8',
    )

    const { session } = await loadSessionFromDisk(sessionPath)
    const parent = session.subagents.find(s => s.agentId === 'parent01')!
    const child = session.subagents.find(s => s.agentId === 'child01')!
    expect(parent.childAgentIds).toEqual(['child01'])
    expect(child.toolUseId).toBe('toolu_CHILD')
    // Inside the parent subagent's turns, the Task tool_use should now carry childAgentId.
    const parentSpawnTurn = parent.turns.find(t => t.toolUses.length > 0)!
    expect(parentSpawnTurn.toolUses[0]!.childAgentId).toBe('child01')
  })

  it('leaves toolUseId empty when neither linkage source matches (AGENT-04 graceful)', async () => {
    const projectDir = join(tmpRoot, '-Users-test-linker-orphan')
    const sessionId = 'orphan-session'
    mkdirSync(join(projectDir, sessionId, 'subagents'), { recursive: true })
    const sessionPath = join(projectDir, `${sessionId}.jsonl`)
    writeFileSync(sessionPath, '{"type":"user","uuid":"u1","sessionId":"orphan-session","timestamp":"2026-05-09T00:00:00Z","message":{"role":"user","content":"hi"}}\n', 'utf8')
    writeFileSync(
      join(projectDir, sessionId, 'subagents', 'agent-orphan99.jsonl'),
      '{"type":"assistant","uuid":"sa1","agentId":"orphan99","sessionId":"orphan-session","timestamp":"2026-05-09T00:00:01Z","message":{"role":"assistant","content":[{"type":"text","text":"alone"}]}}\n',
      'utf8',
    )

    const { session } = await loadSessionFromDisk(sessionPath)
    expect(session.subagents[0]!.agentId).toBe('orphan99')
    expect(session.subagents[0]!.toolUseId).toBe('')
    expect(session.subagents[0]!.status).toBe('completed') // safe default
  })
})

describe('SessionCache (D-18)', () => {
  it('evicts LRU entry when capacity exceeded', () => {
    const cache = new SessionCache<string>(3)
    cache.set('a', 'A', 1)
    cache.set('b', 'B', 1)
    cache.set('c', 'C', 1)
    cache.set('d', 'D', 1)
    expect(cache.get('a', 1)).toBeNull()  // evicted
    expect(cache.get('d', 1)).toBe('D')
    expect(cache.size()).toBe(3)
  })

  it('returns null when mtime mismatches (invalidation)', () => {
    const cache = new SessionCache<string>(3)
    cache.set('a', 'A', 1000)
    expect(cache.get('a', 1000)).toBe('A')
    expect(cache.get('a', 1001)).toBeNull()  // stale
    expect(cache.size()).toBe(0)             // invalidation removes the entry
  })

  it('refreshes position on get (true LRU behavior)', () => {
    const cache = new SessionCache<string>(3)
    cache.set('a', 'A', 1)
    cache.set('b', 'B', 1)
    cache.set('c', 'C', 1)
    cache.get('a', 1)                        // promote a
    cache.set('d', 'D', 1)                   // b should now be LRU
    expect(cache.get('a', 1)).toBe('A')
    expect(cache.get('b', 1)).toBeNull()
    expect(cache.get('c', 1)).toBe('C')
    expect(cache.get('d', 1)).toBe('D')
  })
})
