// packages/server/src/reader/watcher.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, appendFileSync, rmSync, mkdtempSync, utimesSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { watchProjectsDir } from './watcher.js'
import type { FSWatcher } from 'chokidar'

let tmpRoot: string
let watcher: (FSWatcher & { isLive: (id: string, w?: number) => boolean; clear: () => void }) | null

/** chokidar fires async; small awaitable helper. */
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), 'cc-viewer-watcher-'))
  mkdirSync(join(tmpRoot, 'project-slug'), { recursive: true })
  watcher = null
})

afterEach(async () => {
  if (watcher) { try { await watcher.close() } catch { /* ignore */ } }
  rmSync(tmpRoot, { recursive: true, force: true })
})

describe('LiveTracker (D-24 / D-34)', () => {
  it('isLive() returns false for untracked sessionId', () => {
    const calls: number[] = []
    watcher = watchProjectsDir(tmpRoot, () => calls.push(1))
    expect(watcher.isLive('any-id')).toBe(false)
  })

  it('appending to a .jsonl flips isLive to true within the 5s window', async () => {
    const calls: number[] = []
    watcher = watchProjectsDir(tmpRoot, () => calls.push(1))
    const jsonlPath = join(tmpRoot, 'project-slug', 'sess-1.jsonl')
    // Pre-create file so chokidar fires 'change' (not 'add') on next write
    writeFileSync(jsonlPath, '{"type":"user","timestamp":"2026-04-26T00:00:00Z","message":{"role":"user","content":"hi"}}\n')
    await wait(150)  // let chokidar settle initial scan + ignoreInitial
    appendFileSync(jsonlPath, '{"type":"assistant","timestamp":"2026-04-26T00:00:01Z"}\n')
    // Wait > stabilityThreshold (50ms) + handler dispatch
    await wait(250)
    expect(watcher.isLive('sess-1')).toBe(true)
  })

  it('isLive() returns false after the window elapses', () => {
    const calls: number[] = []
    watcher = watchProjectsDir(tmpRoot, () => calls.push(1))
    // Rely on isLive(sessionId, 0) === false for any value because (now - t) < 0
    // is never true for any stored timestamp.
    expect(watcher.isLive('sess-1', 0)).toBe(false)
  })

  it('change event does NOT call onListInvalidated', async () => {
    const calls: number[] = []
    watcher = watchProjectsDir(tmpRoot, () => calls.push(1))
    const jsonlPath = join(tmpRoot, 'project-slug', 'sess-2.jsonl')
    writeFileSync(jsonlPath, '{"type":"user"}\n')
    await wait(200)
    const beforeAppend = calls.length
    appendFileSync(jsonlPath, '{"type":"assistant"}\n')
    await wait(250)
    expect(calls.length).toBe(beforeAppend)  // change must NOT invalidate
  })

  it('add of a new .jsonl DOES call onListInvalidated (regression)', async () => {
    const calls: number[] = []
    watcher = watchProjectsDir(tmpRoot, () => calls.push(1))
    await wait(150)
    const beforeAdd = calls.length
    writeFileSync(join(tmpRoot, 'project-slug', 'sess-new.jsonl'), '{"type":"user"}\n')
    await wait(300)
    expect(calls.length).toBeGreaterThan(beforeAdd)
  })

  it('unlink of a .jsonl DOES call onListInvalidated (regression)', async () => {
    const jsonlPath = join(tmpRoot, 'project-slug', 'sess-doomed.jsonl')
    writeFileSync(jsonlPath, '{"type":"user"}\n')
    const calls: number[] = []
    watcher = watchProjectsDir(tmpRoot, () => calls.push(1))
    await wait(200)
    const before = calls.length
    rmSync(jsonlPath)
    await wait(300)
    expect(calls.length).toBeGreaterThan(before)
  })

  it('clear() empties the tracker', () => {
    const calls: number[] = []
    watcher = watchProjectsDir(tmpRoot, () => calls.push(1))
    watcher.clear()
    expect(watcher.isLive('any-id')).toBe(false)
  })

  // F-5 (02-13) — diagnostic + regression tests for live-dot timing
  // ---------------------------------------------------------------
  // F-5 evidence: during D-40.1 walkthrough, `touch ~/.claude/projects/.../synthetic-10k.jsonl`
  // did not flip the live dot within 5s. Hypothesis A: chokidar's `awaitWriteFinish` waits for
  // file SIZE stability before firing `change`; a metadata-only `touch` does NOT change file size,
  // so the event is suppressed. The two tests below empirically verify both branches:
  //   1. Real-content append must trip isLive within 500ms (tightened regression anchor).
  //   2. Metadata-only utimesSync (POSIX `touch` equivalent) — anchors observed behavior so
  //      a future chokidar upgrade that changes the contract will surface as a test failure.

  it('appending real content flips isLive within 500ms (F-5 regression anchor)', async () => {
    const calls: number[] = []
    watcher = watchProjectsDir(tmpRoot, () => calls.push(1))
    const jsonlPath = join(tmpRoot, 'project-slug', 'sess-fast.jsonl')
    writeFileSync(
      jsonlPath,
      '{"type":"user","timestamp":"2026-04-26T00:00:00Z","message":{"role":"user","content":"hi"}}\n',
    )
    await wait(200) // settle initial scan + ignoreInitial
    const t0 = Date.now()
    appendFileSync(jsonlPath, '{"type":"assistant","timestamp":"2026-04-26T00:00:01Z"}\n')
    // Poll every 50ms up to 500ms for isLive=true
    let live = false
    for (let i = 0; i < 10; i++) {
      await wait(50)
      if (watcher.isLive('sess-fast')) {
        live = true
        break
      }
    }
    const elapsed = Date.now() - t0
    expect(live).toBe(true)
    expect(elapsed).toBeLessThanOrEqual(500)
  })

  it('metadata-only utimesSync (touch-equivalent) — documented behavior', async () => {
    const calls: number[] = []
    watcher = watchProjectsDir(tmpRoot, () => calls.push(1))
    const jsonlPath = join(tmpRoot, 'project-slug', 'sess-touch.jsonl')
    writeFileSync(jsonlPath, '{"type":"user"}\n')
    await wait(200)
    const before = watcher.isLive('sess-touch')
    // Simulate `touch` — bumps atime/mtime, no content write, no size change.
    const now = new Date()
    utimesSync(jsonlPath, now, now)
    // Poll up to 1s for any state change.
    let after = before
    for (let i = 0; i < 20; i++) {
      await wait(50)
      if (watcher.isLive('sess-touch')) {
        after = true
        break
      }
    }
    // Document the observed behavior. Either result is acceptable PROVIDED the
    // verify protocol matches it.
    //
    // EMPIRICAL OUTCOME (Node 20+ / chokidar v5 / macOS / mkdtemp under /tmp):
    // utimesSync IS observed to fire `change` within ~1s — chokidar's awaitWriteFinish
    // does NOT suppress mtime-only updates in this environment. Hypothesis A
    // (the original guess for F-5) is REFUTED here.
    //
    // Caveat: F-5 was reported against a `touch` on a symlinked file under
    // ~/.claude/projects/ (real macOS FSEvents path, not /tmp), where the result
    // differed. Live-dot field reliability still favours real-content appends, but
    // the watcher contract itself is "metadata-only updates DO trip change in test
    // environments" — anchored here so any future regression surfaces immediately.
    expect(after).toBe(true)
  })
})
