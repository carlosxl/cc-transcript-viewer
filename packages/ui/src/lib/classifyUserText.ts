/**
 * Stderr envelope detector for prompt-navigation skip rule (FR-080 n / N).
 *
 * Per research R-08: a user-prompt whose text begins with `[stderr]` is a
 * tooling envelope (not a human prompt) and is excluded from the n/N walk.
 * It is still visible in the transcript and turn jumper.
 */
export function isStderrEnvelope(text: string | null | undefined): boolean {
  return /^\[stderr\]/.test(text ?? '')
}
