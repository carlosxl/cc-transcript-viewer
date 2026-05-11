#!/usr/bin/env node
/**
 * Deterministic 10,000-message synthetic fixture for Phase 2 perf walkthrough.
 *
 * Privacy: NO real user content. All text is a small lorem-ipsum word pool
 * combined with deterministic seeded shuffling. No file paths, no env reads.
 *
 * Usage: tsx packages/ui/scripts/gen-fixture-10k.ts > packages/server/test/fixtures/synthetic-10k.jsonl
 */
// ---- Seeded RNG (mulberry32) so successive runs produce identical bytes ----
function mulberry32(seed: number) {
  return function rand(): number {
    seed = (seed + 0x6D2B79F5) | 0
    let t = seed
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = mulberry32(0xCAFEBABE)
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!

// ---- Deterministic UUID from seeded RNG — no node:crypto dependency ----
function seededUUID(): string {
  const hex = (n: number) => n.toString(16).padStart(2, '0')
  const b = Array.from({ length: 16 }, () => Math.floor(rand() * 256))
  b[6] = (b[6]! & 0x0f) | 0x40  // version 4
  b[8] = (b[8]! & 0x3f) | 0x80  // variant 10xx
  return [
    b.slice(0, 4).map(hex).join(''),
    b.slice(4, 6).map(hex).join(''),
    b.slice(6, 8).map(hex).join(''),
    b.slice(8, 10).map(hex).join(''),
    b.slice(10, 16).map(hex).join(''),
  ].join('-')
}

// ---- Lorem-ipsum word pool — never derived from real user data ----
const WORDS = [
  'lorem','ipsum','dolor','sit','amet','consectetur','adipiscing','elit','sed','do',
  'eiusmod','tempor','incididunt','ut','labore','et','dolore','magna','aliqua','enim',
  'ad','minim','veniam','quis','nostrud','exercitation','ullamco','laboris','nisi','aliquip',
] as const

function loremSentence(n: number): string {
  return Array.from({ length: n }, () => pick(WORDS)).join(' ') + '.'
}
function loremParagraph(sentences: number, wordsPer: number): string {
  return Array.from({ length: sentences }, () => loremSentence(wordsPer)).join(' ')
}

// ---- Markdown content snippets ----
const TABLE_MD = [
  '| Lang | Status |',
  '|------|--------|',
  '| typescript | ok |',
  '| python | ok |',
  '| rust | unknown |',
].join('\n')

const TASKLIST_MD = [
  '- [x] Implement parser',
  '- [x] Wire renderer',
  '- [ ] Ship perf walkthrough',
].join('\n')

const TS_FENCE = '```typescript\nfunction add(a: number, b: number): number {\n  return a + b\n}\n```'
const PY_FENCE = '```python\ndef greet(name):\n    return f"hello {name}"\n```'
const JSON_FENCE = '```json\n{ "ok": true, "count": 3 }\n```'
const FENCES = [TS_FENCE, PY_FENCE, JSON_FENCE] as const

// ---- Timestamp generator: monotonically increasing from a fixed base ----
const BASE_MS = Date.parse('2026-04-01T00:00:00.000Z')
let cursorMs = BASE_MS
const tick = () => { cursorMs += 1 + Math.floor(rand() * 500); return new Date(cursorMs).toISOString() }

// ---- Event factories ----
function userTurn(prev: string | null): unknown {
  const uuid = seededUUID()
  const text = loremParagraph(1 + Math.floor(rand() * 3), 8)
  return {
    type: 'user', uuid, parentUuid: prev, timestamp: tick(),
    message: { role: 'user', content: text },
  }
}

function assistantTurn(prev: string | null, opts: { withFence: boolean; withThinking: boolean; withRichMd: boolean }): { ev: unknown; uuid: string; toolUseId: string | null } {
  const uuid = seededUUID()
  const content: unknown[] = []
  if (opts.withThinking) {
    content.push({ type: 'thinking', thinking: loremParagraph(3, 7) })
  }
  let text: string
  if (opts.withRichMd) {
    text = `${loremSentence(8)}\n\n${TABLE_MD}\n\n${TASKLIST_MD}`    // ~10% rich-markdown with table + task list
  } else if (opts.withFence) {
    text = `${loremSentence(8)}\n\n${pick(FENCES)}`
  } else {
    text = loremParagraph(2, 8)
  }
  content.push({ type: 'text', text })
  let toolUseId: string | null = null
  if (rand() < 0.30) {
    toolUseId = `toolu_${seededUUID().slice(0, 8)}`
    content.push({
      type: 'tool_use', id: toolUseId, name: pick(['read_file','grep','bash']),
      input: { path: `/synthetic/${pick(WORDS)}/${pick(WORDS)}.${pick(['ts','py','md'])}` },
    })
  }
  const ev = {
    type: 'assistant', uuid, parentUuid: prev, timestamp: tick(),
    message: {
      role: 'assistant', content,
      usage: {
        input_tokens: 100 + Math.floor(rand() * 500),
        output_tokens: 50 + Math.floor(rand() * 300),
        cache_creation_input_tokens: Math.floor(rand() * 200),
        cache_read_input_tokens: Math.floor(rand() * 1000),
      },
    },
  }
  return { ev, uuid, toolUseId }
}

function toolResult(prev: string, toolUseId: string, isError: boolean): unknown {
  const uuid = seededUUID()
  const body = isError
    ? `Error: ${loremSentence(6)}`
    : loremParagraph(2 + Math.floor(rand() * 4), 9)
  return {
    type: 'user', uuid, parentUuid: prev, timestamp: tick(),
    message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: toolUseId, content: body, is_error: isError }] },
  }
}

// ---- Main loop: emit exactly 10,000 events ----
const TARGET = 10_000
const out = process.stdout
let emitted = 0
let prevUuid: string | null = null

while (emitted < TARGET) {
  const u = userTurn(prevUuid)
  out.write(JSON.stringify(u) + '\n'); emitted++
  prevUuid = (u as { uuid: string }).uuid
  if (emitted >= TARGET) break

  const { ev, uuid, toolUseId } = assistantTurn(prevUuid, {
    withRichMd: rand() < 0.10,       // ~10% have GFM table + task list (D-40.4)
    withFence: rand() < 0.20,        // ~20% have fenced code (mix of ts/py/json)
    withThinking: rand() < 0.15,     // ~15% have thinking blocks
  })
  out.write(JSON.stringify(ev) + '\n'); emitted++
  prevUuid = uuid
  if (emitted >= TARGET) break

  if (toolUseId) {
    const isError = rand() < 0.05    // ~5% failed tool calls per D-07/D-40.5
    const tr = toolResult(prevUuid, toolUseId, isError)
    out.write(JSON.stringify(tr) + '\n'); emitted++
    prevUuid = (tr as { uuid: string }).uuid
  }
}

process.stderr.write(`generated ${emitted} events; bytes ~ check via: wc -c synthetic-10k.jsonl\n`)
