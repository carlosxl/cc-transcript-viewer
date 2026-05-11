# Real Fixture Corpus Version Record

Real (scrubbed) session fixtures captured from `~/.claude/projects/` live here.

**Claude Code version at capture:** (none yet — real fixtures to be added by developer running `packages/server/src/reader/__fixtures__/scrub.ts`)

**Fixture requirements (D-31):**
- 3–5 real sessions chosen to cover:
  - (a) Plain session with no subagents
  - (b) Session with ≥2 nested subagents
  - (c) Session with `compact_boundary` events
  - (d) Session with `system/api_error` events
- Scrubbed via `scrub.ts` to remove: `sk-ant-*` keys, `sk-*` keys, `Bearer *` tokens, absolute paths containing user home dir, `password/token/api_key` JSON fields.
- Before committing: manually inspect output for residual secrets.

Synthetic fixtures (always present in `__fixtures__/synthetic/`) cover pathological inputs:
- `empty.jsonl`, `malformed-line.jsonl`, `unknown-event-type.jsonl`,
  `partial-trailing-line.jsonl`, `utf8-boundary.jsonl`, `plain-session.jsonl`.

When adding real fixtures, update this file's Claude Code version.
