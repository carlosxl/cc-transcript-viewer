// packages/server/src/util/error-response.ts
import type { ErrorResponse } from '@cc-viewer/shared'

/**
 * Canonical error codes. Add new codes here when routes need them.
 * Codes are UPPER_SNAKE_CASE, machine-stable, human-readable.
 */
export type ErrorCode =
  | 'FORBIDDEN_ORIGIN'
  | 'SESSION_NOT_FOUND'
  | 'SUBAGENT_NOT_FOUND'
  | 'LIST_SESSIONS_FAILED'
  | 'LOAD_SESSION_FAILED'
  | 'LOAD_SUBAGENT_FAILED'
  | 'INVALID_QUERY'
  | 'INTERNAL_ERROR'
  | 'NOT_FOUND'

/**
 * Build a canonical error response body (D-25).
 * MUST NOT include stack traces, file paths, or internal error details.
 * The caller should pass a safe, user-facing `message` — not `err.message`
 * directly from an unknown error.
 */
export function errorResponse(code: ErrorCode, message: string): ErrorResponse {
  return { error: { code, message } }
}
