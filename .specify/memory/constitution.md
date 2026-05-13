<!--
SYNC IMPACT REPORT
==================
Version change: (uninitialized template) → 1.0.0
Bump rationale: Initial ratification — all placeholders replaced with concrete
governance. No prior version existed; MAJOR baseline established.

Modified principles: N/A (initial adoption)
Added sections:
  - Core Principles I–V (Local-First Privacy; Scale by Default; Single-Command
    Distribution; Source-File Read-Only; Simplicity & Surgical Changes)
  - Performance & Compatibility Standards
  - Development Workflow & Quality Gates
  - Governance
Removed sections: None.

Templates audited:
  ✅ .specify/templates/plan-template.md — references "Constitution Check"
     dynamically; no edits needed. Constitution gates above are now the
     authoritative source for that section.
  ✅ .specify/templates/spec-template.md — not opened; no constitution-coupled
     placeholders detected at audit time. Re-audit if scope/requirements
     sections gain principle-driven mandates.
  ✅ .specify/templates/tasks-template.md — not opened; no
     principle-driven task categories changed.
  ✅ .specify/templates/checklist-template.md — generic; no edits needed.
  ✅ CLAUDE.md — already encodes stack + constraints aligned with this
     constitution; treat as the runtime guidance file referenced by Governance.

Deferred / TODOs: None.
-->

# cc-transcript-viewer Constitution

## Core Principles

### I. Local-First Privacy (NON-NEGOTIABLE)

Transcript content MUST NOT leave the user's machine. The server MUST NOT make
outbound network calls carrying transcript bytes, file paths from
`~/.claude/projects/`, or any derived fields (e.g., summaries, embeddings).
Update-checks, telemetry, and analytics that transmit transcript-derived data
are prohibited. Outbound calls that carry only the tool's own version string
(e.g., npm registry self-update) are permitted but MUST be off by default.

**Rationale**: Transcripts routinely contain secrets, internal code, and
customer data. A single accidental upload is unrecoverable.

### II. Scale by Default

Every UI surface that renders transcript content MUST be designed for the 10k+
message case from day one. Lists MUST be virtualized (react-virtuoso or
equivalent). Parsing and indexing MUST stream, not buffer whole files. Search
MUST use a persistent index (SQLite FTS5), not in-memory rebuilds. Features
that work only at small scale and degrade above 10k messages are rejected,
not deferred.

**Rationale**: The product's core value — "I can read any session, no matter
how long" — collapses if scale is treated as a later optimization.

### III. Single-Command Distribution

The tool MUST be runnable via one command (`npx cc-transcript-viewer` or
`npm i -g` then a single binary) with zero additional setup: no Docker, no
cloud account, no login, no config file required for first run. Native
dependencies that block `npx` (uncompiled binaries, per-platform CI matrices)
are prohibited unless the alternative is materially worse along another
principle. Artifacts on npm SHOULD stay under 10 MB.

**Rationale**: Friction kills adoption of a local dev tool. The viewer must
be reachable in one keystroke from the terminal that already runs Claude
Code.

### IV. Source-File Read-Only

`~/.claude/projects/` and the JSONL files within it MUST be treated as
strictly read-only inputs. The server MUST NOT write, rename, move, truncate,
or delete files there. Caches, indexes, and any persistent state MUST live in
the tool's own directory (e.g., `~/.cache/cc-transcript-viewer/`) and MUST be
safe to delete without data loss.

**Rationale**: Claude Code owns those files and may rewrite them. Any write
from this tool risks corrupting an active session.

### V. Simplicity & Surgical Changes

Implementations MUST be the minimum code that solves the stated problem. No
speculative abstractions, configurability, or error handling for impossible
scenarios. Edits MUST be scoped to the user's request: adjacent refactors,
style changes, and pre-existing dead-code removal require a separate task.
Every changed line MUST trace to an explicit requirement.

**Rationale**: This is a small local tool with one user per install. Every
abstraction is overhead that the user pays for in bugs and onboarding time.
Cf. Karpathy Guidelines (simplicity-first, surgical-changes).

## Performance & Compatibility Standards

- **Throughput**: Opening a 10k-message session MUST reach interactive state
  (first message visible, scroll responsive) within 2 seconds on an M-series
  Mac after the index is warm; cold-start MAY be longer but MUST stream
  progress, never block on a full parse.
- **Memory**: Steady-state RSS for a single open 10k-message session SHOULD
  stay under 500 MB.
- **Live-tailing**: New JSONL lines appended to an active session MUST appear
  in the UI within 1 second of OS-level write completion, without manual
  refresh.
- **Runtime independence**: The server MUST NOT shell out to the `claude`
  CLI or require Claude Code to be running. JSONL files are the contract.
- **Supported runtime**: Node.js 20 LTS or newer. Per-feature minimums MUST
  be documented in CLAUDE.md when stricter.

## Development Workflow & Quality Gates

- **Spec-driven**: Non-trivial features (anything beyond a localized fix) MUST
  flow through `.specify/`: `/speckit-specify` → `/speckit-plan` →
  `/speckit-tasks` → `/speckit-implement`. The Constitution Check in
  `plan-template.md` is satisfied by demonstrating compliance with Principles
  I–V; violations MUST be recorded in the plan's Complexity Tracking table
  with justification.
- **Stack adherence**: Deviations from the recommended stack in `CLAUDE.md`
  (React 19 + Vite + Hono + better-sqlite3 + react-virtuoso + chokidar + SSE)
  MUST be justified in writing in the relevant `research.md` or plan.
- **Testing**: Parsing, indexing, file-watching, and live-tailing MUST have
  automated tests covering the 10k+ message and partial-write cases. UI
  changes MUST be exercised in a browser before being marked complete.
- **Reviews**: PR descriptions MUST state which principles were affected and
  link to the spec for any feature-sized change.

## Governance

This constitution supersedes other practices and informal conventions for
this repository. `CLAUDE.md` is the runtime development guidance file and
elaborates the stack, conventions, and architecture; where the two conflict,
this constitution wins and `CLAUDE.md` MUST be updated to match.

**Amendments**: Run `/speckit-constitution` with the proposed change. The
command MUST produce a Sync Impact Report (prepended as an HTML comment),
bump the version per the rules below, and update dependent templates in the
same commit.

**Versioning**:
- MAJOR — A principle is removed or redefined incompatibly, or a governance
  rule changes in a way that invalidates prior plans.
- MINOR — A new principle or section is added, or existing guidance is
  materially expanded.
- PATCH — Wording, clarifications, typo fixes, non-semantic refinements.

**Compliance review**: Every plan's Constitution Check is the primary gate.
Quarterly, maintainers SHOULD spot-check merged features against
Principles I–V and open follow-up issues for drift.

**Version**: 1.0.0 | **Ratified**: 2026-05-13 | **Last Amended**: 2026-05-13
