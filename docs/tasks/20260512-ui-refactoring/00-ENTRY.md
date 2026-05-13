# UI Refactoring — Handoff Entry Point

You are picking up an in-progress UI refactor of `cc-transcript-viewer`. A new
design exists at `.design/cc-transcript-viewer/` (read its `README.md` first if
unfamiliar). This refactor is large — broken into phases.

## How to use this folder

1. **Read [`00-PROGRESS.md`](./00-PROGRESS.md) first.** It tells you which phase
   is current, what's done, and what's blocked.
2. **Open the current phase file** (e.g. `01-design-system.md`). Each phase file
   is a self-contained brief: goal, scope, dependencies, files touched, key
   decisions to settle, acceptance criteria.
3. **Plan the phase before coding.** Phase files intentionally do *not*
   prescribe step-by-step implementation. Spawn a Plan agent or write a
   sub-plan in this folder (e.g. `01-PLAN.md`) before executing.
4. **Update `00-PROGRESS.md` when you finish or pause.** Future you (or another
   agent) will thank you.

## Source-of-truth references

- **Design bundle**: `.design/cc-transcript-viewer/project/` — JSX prototypes,
  `tokens.css`, `Workspace.html` is the primary screen.
- **Project goals & stack**: `CLAUDE.md` at repo root.
- **Cross-cutting open questions**: [`OPEN-QUESTIONS.md`](./OPEN-QUESTIONS.md).
  Skim once; revisit when a phase intersects with one.

## Working norms for this task

- Phase ordering matters; respect declared dependencies. Two phases can run in
  parallel only when both list each other as independent.
- The raw event model (`Session` / `Turn` / `ToolUse` / `ToolResult` /
  `UsageBlock` in `@cc-viewer/shared`) is **not** being reshaped. The
  projection layer (Phase 2) is where new derived structures live.
- Performance constraint stands: 10k+ messages per session must stay smooth.
  Any phase that adds rail content or per-turn computation should verify on a
  large session.
- Stay surgical. Match existing patterns (`useFlatNodes`, store slices,
  shadcn primitives in `components/ui/`).
