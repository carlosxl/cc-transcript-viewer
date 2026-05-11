// packages/server/src/util/logger.ts
import { appendFileSync, renameSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { getCacheDir } from './cache-dir.js'

/** Rotate error.log when it exceeds this size (D-14). */
export const MAX_LOG_SIZE = 5 * 1024 * 1024  // 5 MB

/**
 * Log a warning to <cache-dir>/error.log as a JSON line.
 * Per D-14 and SYS-03, logs are LOCAL ONLY — never sent over the network.
 */
export function logWarning(message: string, context?: Record<string, unknown>): void {
  writeLine('warn', message, context)
}

/**
 * Log an error (non-fatal) to <cache-dir>/error.log. The err argument is
 * extracted to { error: string } — never the raw Error object (which might
 * include file paths or stack traces). Stack traces are NEVER logged (D-14).
 */
export function logError(message: string, err?: unknown, context?: Record<string, unknown>): void {
  const safe: Record<string, unknown> = { ...context }
  if (err !== undefined) {
    safe.error = err instanceof Error ? err.message : String(err)
  }
  writeLine('error', message, safe)
}

function writeLine(level: 'warn' | 'error', message: string, context?: Record<string, unknown>): void {
  const record = {
    level,
    ts: new Date().toISOString(),
    message,
    ...(context ?? {}),
  }
  const line = JSON.stringify(record) + '\n'

  const logPath = join(getCacheDir(), 'error.log')

  try {
    rotateIfNeeded(logPath)
  } catch {
    // Rotation errors are non-fatal; fall through to append.
  }

  try {
    appendFileSync(logPath, line, { encoding: 'utf8', mode: 0o600 })
  } catch {
    // Logging must never throw into the caller. Swallow silently — if logging
    // is broken there's no place to log that.
  }
}

function rotateIfNeeded(logPath: string): void {
  let size: number
  try {
    size = statSync(logPath).size
  } catch {
    return  // file does not exist yet; nothing to rotate
  }
  if (size > MAX_LOG_SIZE) {
    try {
      renameSync(logPath, logPath + '.old')
    } catch {
      // Rename failure is non-fatal; next append will continue writing to the
      // oversize file. Better than throwing.
    }
  }
}
