import { describe, it, expect } from 'vitest'
import { existsSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { getCacheDir } from './cache-dir.js'

describe('getCacheDir', () => {
  // NOTE: These tests exercise the REAL platform path. They are non-destructive
  // because getCacheDir is idempotent — it only creates the directory if missing.
  // Verifying mode 0o700 on Windows is a no-op; we only assert platform path logic.

  it('returns a directory that exists after call', () => {
    const dir = getCacheDir()
    expect(existsSync(dir)).toBe(true)
    expect(statSync(dir).isDirectory()).toBe(true)
  })

  it('contains "cc-viewer" in the path', () => {
    expect(getCacheDir()).toContain('cc-viewer')
  })

  it('is idempotent', () => {
    const a = getCacheDir()
    const b = getCacheDir()
    expect(a).toBe(b)
  })

  if (process.platform !== 'win32') {
    it('sets mode to 0o700 on POSIX (D-13)', () => {
      const dir = getCacheDir()
      const mode = statSync(dir).mode & 0o777
      expect(mode).toBe(0o700)
    })
  }

  if (process.platform === 'darwin') {
    it('uses ~/Library/Caches on macOS', () => {
      expect(getCacheDir()).toBe(join(homedir(), 'Library', 'Caches', 'cc-viewer'))
    })
  }
})
