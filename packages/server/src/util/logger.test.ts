import { describe, it, expect, beforeEach } from 'vitest'
import { existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { logWarning, logError, MAX_LOG_SIZE } from './logger.js'
import { getCacheDir } from './cache-dir.js'

describe('logger', () => {
  // The logger writes to the real cache dir. To keep tests deterministic we
  // grab the current error.log, snapshot its size, and truncate between tests.
  // (Using getCacheDir() for the path — we do NOT redirect it.)

  const logPath = join(getCacheDir(), 'error.log')

  beforeEach(() => {
    // Clear log for test isolation.
    writeFileSync(logPath, '', { encoding: 'utf8' })
  })

  it('appends a warning as a JSON line', () => {
    logWarning('test warning', { foo: 'bar' })
    const content = readFileSync(logPath, 'utf8')
    const lines = content.trim().split('\n')
    expect(lines.length).toBe(1)
    const rec = JSON.parse(lines[0]!)
    expect(rec.level).toBe('warn')
    expect(rec.message).toBe('test warning')
    expect(rec.foo).toBe('bar')
    expect(typeof rec.ts).toBe('string')
  })

  it('appends an error with extracted message only (no stack)', () => {
    logError('test error', new Error('boom'), { scope: 'unit' })
    const content = readFileSync(logPath, 'utf8')
    const rec = JSON.parse(content.trim().split('\n')[0]!)
    expect(rec.level).toBe('error')
    expect(rec.message).toBe('test error')
    expect(rec.error).toBe('boom')
    expect(rec.scope).toBe('unit')
    expect(rec.stack).toBeUndefined()
  })

  it('rotates when log exceeds MAX_LOG_SIZE', () => {
    // Write 5 MB + 1 byte of content.
    const big = 'x'.repeat(MAX_LOG_SIZE + 1)
    writeFileSync(logPath, big, 'utf8')

    logWarning('rotation trigger')

    expect(existsSync(logPath + '.old')).toBe(true)
    // New log has exactly our single rotation-trigger line
    const newLog = readFileSync(logPath, 'utf8').trim().split('\n')
    expect(newLog.length).toBe(1)
    expect(JSON.parse(newLog[0]!).message).toBe('rotation trigger')

    // cleanup
    rmSync(logPath + '.old', { force: true })
  })

  it('never throws when called with bad inputs', () => {
    expect(() => logError('x', undefined)).not.toThrow()
    expect(() => logError('x', 'string error')).not.toThrow()
    expect(() => logError('x', 42 as unknown)).not.toThrow()
    expect(() => logWarning('x', undefined)).not.toThrow()
  })
})
