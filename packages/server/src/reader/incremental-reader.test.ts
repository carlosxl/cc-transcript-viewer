import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { writeFileSync, appendFileSync, mkdirSync, rmSync, renameSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { IncrementalReader } from './incremental-reader.js'

let tmp: string
let reader: IncrementalReader

beforeEach(() => {
  tmp = join(tmpdir(), `cc-viewer-incremental-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  mkdirSync(tmp, { recursive: true })
  reader = new IncrementalReader()
})

afterEach(async () => {
  await reader.closeAll()
  rmSync(tmp, { recursive: true, force: true })
})

const validUserLine = (uuid: string, content: string) =>
  `{"type":"user","uuid":"${uuid}","sessionId":"s","timestamp":"2026-05-09T00:00:00Z","message":{"role":"user","content":"${content}"}}\n`

describe('IncrementalReader', () => {
  it('init at EOF means readNew returns no turns when nothing new', async () => {
    const path = join(tmp, 's.jsonl')
    writeFileSync(path, validUserLine('u1', 'first'), 'utf8')
    await reader.init('s', path)
    const { turns, rows } = await reader.readNew('s', path)
    expect(turns).toEqual([])
    expect(rows).toEqual([])
  })

  it('returns turns appended after init', async () => {
    const path = join(tmp, 's.jsonl')
    writeFileSync(path, validUserLine('u1', 'first'), 'utf8')
    await reader.init('s', path)
    appendFileSync(path, validUserLine('u2', 'second'), 'utf8')
    const { turns, rows } = await reader.readNew('s', path)
    expect(turns.length).toBe(1)
    expect(turns[0]!.uuid).toBe('u2')
    // 007: rows stream parallels turns for the same appended JSONL lines.
    expect(rows.length).toBe(1)
    expect((rows[0] as { uuid?: string }).uuid).toBe('u2')
  })

  it('handles multi-call append: 2 lines added in 2 reads', async () => {
    const path = join(tmp, 's.jsonl')
    writeFileSync(path, validUserLine('u1', 'one'), 'utf8')
    await reader.init('s', path)

    appendFileSync(path, validUserLine('u2', 'two'), 'utf8')
    const r1 = await reader.readNew('s', path)
    expect(r1.turns.length).toBe(1)
    expect(r1.turns[0]!.uuid).toBe('u2')

    appendFileSync(path, validUserLine('u3', 'three'), 'utf8')
    const r2 = await reader.readNew('s', path)
    expect(r2.turns.length).toBe(1)
    expect(r2.turns[0]!.uuid).toBe('u3')
  })

  it('does NOT parse a partial trailing line (Pitfall 4 — never parse partial)', async () => {
    const path = join(tmp, 's.jsonl')
    writeFileSync(path, validUserLine('u1', 'first'), 'utf8')
    await reader.init('s', path)

    // Append the first half of a line (no newline yet).
    const half = '{"type":"user","uuid":"u2","sessionId":"s","timestamp":"2026-05-09T00:00:00Z","message":{"role":"user","con'
    appendFileSync(path, half, 'utf8')
    const r1 = await reader.readNew('s', path)
    expect(r1.turns).toEqual([]) // partial line buffered, not parsed
    expect(r1.rows).toEqual([])

    // Append the rest of the line plus a newline.
    appendFileSync(path, 'tent":"hello"}}\n', 'utf8')
    const r2 = await reader.readNew('s', path)
    expect(r2.turns.length).toBe(1)
    expect(r2.turns[0]!.uuid).toBe('u2')
    expect(r2.turns[0]!.textBlocks).toEqual(['hello'])
  })

  it('recovers from inode rotation: re-reads the new inode from offset 0', async () => {
    const path = join(tmp, 's.jsonl')
    writeFileSync(path, validUserLine('orig', 'old'), 'utf8')
    await reader.init('s', path)

    // Rotate: rename old, write a new file in its place with a single line.
    renameSync(path, join(tmp, 's.old'))
    writeFileSync(path, validUserLine('rot', 'rotated'), 'utf8')

    const { turns } = await reader.readNew('s', path)
    expect(turns.length).toBe(1)
    expect(turns[0]!.uuid).toBe('rot')
  })

  it('recovers from truncation: re-reads from offset 0', async () => {
    const path = join(tmp, 's.jsonl')
    writeFileSync(path, validUserLine('u1', 'one') + validUserLine('u2', 'two'), 'utf8')
    await reader.init('s', path)
    // Truncate to one shorter line.
    writeFileSync(path, validUserLine('fresh', 'fresh'), 'utf8')
    const { turns } = await reader.readNew('s', path)
    expect(turns.length).toBe(1)
    expect(turns[0]!.uuid).toBe('fresh')
  })

  it('returns empty when file is unavailable; subsequent valid append still works', async () => {
    const path = join(tmp, 's.jsonl')
    writeFileSync(path, validUserLine('u1', 'first'), 'utf8')
    await reader.init('s', path)
    rmSync(path)
    const r1 = await reader.readNew('s', path)
    expect(r1.turns).toEqual([])
    // Re-create file with a new inode + one line; rotation handler fires.
    writeFileSync(path, validUserLine('u2', 'reborn'), 'utf8')
    const r2 = await reader.readNew('s', path)
    expect(r2.turns.length).toBe(1)
    expect(r2.turns[0]!.uuid).toBe('u2')
  })

  it('close releases the file handle and clears buffered state', async () => {
    const path = join(tmp, 's.jsonl')
    writeFileSync(path, validUserLine('u1', 'first'), 'utf8')
    await reader.init('s', path)
    await reader.close('s')
    // After close, readNew acts as a fresh init (returns [] since no new bytes
    // have been appended since the close moment, but does re-open the handle).
    appendFileSync(path, validUserLine('u2', 'after-close'), 'utf8')
    // Expected: readNew sees the late-init branch and resets to current EOF,
    // returning [] for this call — see incremental-reader.ts comment.
    const { turns } = await reader.readNew('s', path)
    expect(turns).toEqual([])
  })

  it('handles multiple concurrent keys independently', async () => {
    const a = join(tmp, 'a.jsonl')
    const b = join(tmp, 'b.jsonl')
    writeFileSync(a, validUserLine('a1', 'aaa'), 'utf8')
    writeFileSync(b, validUserLine('b1', 'bbb'), 'utf8')
    await reader.init('a', a)
    await reader.init('b', b)
    appendFileSync(a, validUserLine('a2', 'AAA'), 'utf8')
    const ra = await reader.readNew('a', a)
    const rb = await reader.readNew('b', b)
    expect(ra.turns.map(t => t.uuid)).toEqual(['a2'])
    expect(rb.turns).toEqual([])
  })
})
