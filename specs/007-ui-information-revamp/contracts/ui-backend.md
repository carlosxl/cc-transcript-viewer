# UI ↔ Server contract (delta from 006)

Extends `specs/006-ui-rewrite-v4/contracts/ui-backend.md`. Only the deltas are documented here; everything not mentioned is unchanged.

---

## 0. Wire format invariants

| Invariant | Status |
|---|---|
| Server returns parsed objects; UI does NOT parse JSONL | Unchanged from 006. |
| All endpoints GET-only | Unchanged. |
| SSE used for live-tail and search-progress | Unchanged. |
| All paths under `/api/`; static UI served from `/` | Unchanged. |
| Server never makes outbound network calls with transcript content | Unchanged; constitution Principle I. |
| Path-traversal defense on `:id` and any subpath | Reused `isSafeSessionId` pattern from `routes.ts:64-70`. |

---

## 1. Extended response shapes

### 1.1 `SessionDetailResponse` — extended

The existing response (`routes.ts:120-162`) gains one new field. Other fields unchanged.

```ts
interface SessionDetailResponse {
  // Existing — unchanged
  sessionId: string
  title: string
  turns: Turn[]                       // legacy projection — kept during migration; removable in a later feature
  subagents: SubagentRef[]
  usage: AggregatedUsage
  parseWarnings: ParseWarning[]
  toolInteractions: ToolInteraction[]
  tokenSeries: TokenSeries
  fileTouchIndex: FileTouchIndex

  // NEW (this feature)
  rows: ClaudeRow[]                   // full schema-typed rows; the UI's primary input from Chunk A onward
}
```

`ClaudeRow` is the discriminated union exported from `packages/server/src/jsonl/schema.ts`. Wire JSON shape == Zod schema shape; no projection.

**Compat note**: `turns` and `rows` describe the same underlying data. During Chunks A–E the UI continues to consume `turns` for the existing surfaces while building new surfaces off `rows`. Once all new surfaces ship, a follow-up feature may remove `turns`.

### 1.2 `SubagentDetailResponse` — extended

Same shape extension as `SessionDetailResponse`. Adds `rows: ClaudeRow[]`.

### 1.3 Live-tail SSE event payloads — extended

Event names unchanged (`snapshot`, `turns`, `ping`, `error`). The `turns` event payload gains an additional sibling:

```ts
// Before:
event: turns
data: { turns: Turn[] }

// After:
event: turns
data: { turns: Turn[]; rows: ClaudeRow[] }
```

`turns` continues to ship for backwards-compat with the current rendering paths; `rows` is the future primary stream.

---

## 2. NEW endpoint — off-loaded tool-result blob

**Purpose**: serves the on-disk blob referenced by `BashResult.persistedOutputPath` (`schema.ts:298`) and similar. Required by FR-013.

```
GET /api/sessions/:id/tool-results/:filename

  :id        — sessionId (validated as in 006: `isSafeSessionId`)
  :filename  — must match ^[0-9a-fA-F-]{36}\.txt$ (UUID + .txt)

Resolved path: <projectsDir>/<sessionDir>/tool-results/:filename
Must verify resolved path stays under the session directory (no traversal).

Responses:
  200 text/plain (chunked streaming, no buffering)
       Body: raw file contents.
  404 { error: 'missing-blob' }   — file does not exist on disk (the FR-013 edge case).
  400 { error: 'invalid-filename' } — filename doesn't match pattern.
  404 { error: 'not-found' }       — sessionId not found / not safe.
```

**Caching**: server SHOULD set `Cache-Control: private, max-age=86400`. These files don't change after the harness writes them.

**Implementation notes**:
- Use `c.body(stream)` via Hono streaming helper.
- Apply the same `isSafeSessionId` (`routes.ts:64-70`) gate as existing endpoints.
- Resolve the filename via `path.resolve(<sessionDir>/tool-results, filename)` and re-verify the result starts with the session's tool-results directory absolute path.

---

## 3. NEW endpoint — file-history backup blob

**Purpose**: serves a single backed-up file referenced from `FileHistorySnapshotRow.snapshot.trackedFileBackups[].backupFileName` (`schema.ts:1051`). Required by FR-014.

```
GET /api/sessions/:id/file-history/:backupFileName

  :id              — sessionId (validated)
  :backupFileName  — must match the schema's emitted naming pattern (alphanumeric, hyphens, underscores, dots; max 256 chars; no slashes)

Resolved path: <projectsDir>/<sessionDir>/file-history-snapshots/:backupFileName
Must verify resolved path stays under the session directory.

Responses:
  200 application/octet-stream (streaming)
       Body: raw backup file contents.
  404 { error: 'missing-backup' }
  400 { error: 'invalid-filename' }
  404 { error: 'not-found' }       — sessionId not found / not safe.
```

**Caching**: same `Cache-Control: private, max-age=86400`.

---

## 4. Search — index scope extension (no contract change)

`/api/search`, `/api/search/status`, `/api/search/progress` endpoints unchanged externally. The internal FTS5 index now covers additional text per research.md R4. Clients see no protocol difference; result quality improves.

---

## 5. NEW endpoint (optional / deferred) — paginated rows

**Status**: defined here but NOT shipped in Chunk A. Ships only if Chunk A baseline measurement shows the largest corpus session blowing past the ~10 MB JSON response budget.

```
GET /api/sessions/:id/rows?offset=N&limit=M

  offset — integer ≥0
  limit  — integer 1..5000

Response:
  200 {
    rows: ClaudeRow[]   // length ≤ limit
    nextOffset: number | null
    total: number       // total row count
  }
```

If shipped, `SessionDetailResponse.rows` is replaced by `rows: ClaudeRow[]` containing only the first chunk plus `rowsTotal: number` and `rowsNextOffset: number`, with the UI fetching subsequent chunks on demand (driven by virtuoso's `endReached`).

---

## 6. Removed / deprecated endpoints

None. This feature is purely additive.

---

## 7. Path-traversal defense

All new endpoints reuse the existing pattern from `routes.ts:77-91` (`findSessionJsonl`). After resolving the requested path:

```ts
const resolved = path.resolve(sessionDir, subdir, filename)
if (!resolved.startsWith(path.resolve(sessionDir, subdir) + path.sep)) {
  return c.json({ error: 'invalid-filename' }, 400)
}
```

---

## 8. Compatibility / migration

| Component | During this feature | After this feature |
|---|---|---|
| Server | Emits both `turns` (legacy) and `rows` (new) | Same (legacy kept for one cycle) |
| Live SSE | Emits both in `turns` event | Same |
| UI (existing components) | Continue reading `turns` | Same; gradual migration to `rows` |
| UI (new components) | Read `rows` directly | Same |

The `turns` field is targeted for removal in a follow-up feature once every existing UI consumer is migrated to `rows`. Out of scope for this feature.
