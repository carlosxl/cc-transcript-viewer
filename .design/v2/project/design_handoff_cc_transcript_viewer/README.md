# Handoff: cc-transcript-viewer

## Overview
A viewer for Claude Code conversation transcripts (`.jsonl` session files). The
design explores how to present a long session — user prompts, assistant turns,
tool calls (Bash / Read / Edit), file diffs, "thinking" blocks, token usage,
and a navigable list of past sessions — in a way that's pleasant to read,
fast to scan, and useful to developers reviewing what an agent did.

Two artefacts are in this bundle:

1. **`source/index.html`** — Design canvas showing **three side-by-side
   directions** (Reading view, Workspace 3-pane, Timeline) in both light and
   dark, with a Tweaks panel for accent / paper / density / serif titles.
   Use this to compare directions.
2. **`source/Workspace.html`** — The chosen direction (B · Workspace) built
   out as a standalone full-bleed prototype. **This is the primary target to
   implement.**

## About the Design Files
The files in this bundle are **design references created in HTML** —
React-via-Babel prototypes that show intended look and behaviour. They are
**not production code to copy directly**.

The task is to **recreate these HTML designs in your target codebase's
existing environment** (e.g. a real Vite/Next.js + React app, an Electron
shell, a Tauri app, or whatever environment will actually consume Claude Code
session files) using its established patterns, build tools, and component
libraries. If no environment exists yet, choose the most appropriate stack
for the project — React + Vite + TypeScript is a sensible default given the
prototypes are already React.

Specifically, replace at implementation time:
- The Babel-in-the-browser `<script type="text/babel">` setup → real JSX
  build pipeline.
- The `window`-global component wiring (`Object.assign(window, {...})`) →
  proper ES module imports.
- The hard-coded `WS_MESSAGES` / `SESSIONS` mock data in `source/data.jsx`
  and `source/workspace-data.jsx` → real parsers reading Claude Code
  `~/.claude/projects/**/*.jsonl` files.
- The `<DesignCanvas>` and `<TweaksPanel>` chrome → not part of the
  product; they're authoring scaffolding.

## Fidelity
**High-fidelity.** Colors, typography, spacing, role tints, code/diff
styling, header layout, and interaction states are all intended to be
implemented as shown. The design system is fully tokenised in
`source/tokens.css` (light + dark) — lift those values rather than
re-deriving them.

## Screens / Views

### Workspace (primary — `source/Workspace.html`)
Full-bleed three-pane layout designed for 1280–1920px wide desktop windows.
There is also a narrow / mobile preview variant gated by the "narrow layout"
tweak.

**Top-level layout (left → right):**
- **Sidebar** — 260px default, resizable. Project tree + session list.
- **ResizeHandle** — 5px hit target.
- **Transcript pane** — flex:1, min-width ~520px.
- **ResizeHandle** (only when right pane is open).
- **Right inspector** — 360px default, resizable, dismissible.

Header is sticky at the top of the transcript pane. Status/keyboard-hint
bar is fixed at the bottom of the transcript pane.

#### Sidebar
- `background: var(--surface-2)`, right border `1px solid var(--border)`.
- Header section (`12px 14px 10px`, bottom border):
  - 22×22 rounded-6 accent square with white "C" mark, gap 8 from a 13.5px
    semibold "Transcripts" title, `more` icon button on the right.
  - Below it: full-width search trigger (`6px 10px`, surface bg, 1px
    border, radius `var(--r-1)`). Left: 12px search icon. Center: muted
    placeholder "Search sessions, tools, files…". Right: a `⌘K` chip
    (10px mono, 1px border, surface-2 fill).
- Project groups: collapsible headers in 10.5px uppercase 600 weight
  (`text-3`), with chevron + folder icon and a count on the right.
- Session rows: 12.5px title (single-line ellipsis), optional star icon
  (filled accent when starred), then a mono 10.5px meta line:
  `{ago} · {msgs} msg · {cost}`. Active row gets `accent-soft` background
  plus a 2px accent left border.

#### Transcript header (sticky)
Order, left → right:
1. Hamburger button (only in narrow mode) to toggle the sidebar.
2. Optional back arrow / breadcrumb area.
3. Session title (15px / 600) with single-line ellipsis.
4. Star/unstar button — outline star (`text-4`) ↔ filled accent star.
5. MetricChip: "Messages" / `{count}` (mono, dense).
6. MetricChip: "Tokens" / `{cost}` (mono, dense, accent tone).
7. MetricChip: "Model" / `{model name}` (mono, dense).
8. Theme toggle (sun/moon, pill border, surface fill).
9. Side-panel toggle (`side` icon, 1px border, square-ish).

**Recently swapped:** the theme toggle is on the LEFT of the side-panel
toggle, so the side-panel toggle anchors the far right of the header.
Don't restore the old order.

Metric chips and the side-panel toggle hide when the transcript area gets
narrow (effectiveNarrow flag). The theme toggle and title always stay.

#### Transcript body
- Scrollable region, `padding: 24px 36px 80px 36px`.
- Inner column: `maxWidth: 820px`, centered, `gap: 22px` between messages.
- Focused message gets a 1px `accent-soft` outline at 8px offset, radius
  `var(--r-2)`, transitioned 120ms.

**Message types** (see `source/workspace-app.jsx` `MessagePart`):
- `text` — 14px / 1.65 line-height, `var(--text)`. Inline ``` `code` ``` and
  `**bold**` are formatted by the `RichText` helper.
- `think` — italic block, `var(--think-tint)` fill, 1px **dashed**
  `border-strong`, 10.5px uppercase "Thinking" label with spark icon.
  Hidden when the "Show thinking" tweak is off (via
  `body[data-show-thinking="n"]`).
- `tool` — capsule button. Status dot colour: success (`#2F7D4F`),
  warn (running, `#B5781E`), or danger (fail, `#B5392F`). Layout:
  `[icon] [tool name mono 600] [args mono ellipsis flex:1] [duration]
  [status dot] [chevron]`. Active tool gets `accent` border +
  `accent-soft` outline.
- `diff` — file header (file path, +added / −removed in green/red mono),
  followed by a hunk: 50px right-aligned line-number gutter, 18px marker
  column (`+` / `−` / space), then the line. Added rows on
  `--diff-add-bg`, removed rows on `--diff-rm-bg`.
- `markdown` — rendered with a Markdown component (use any solid React
  markdown lib in production — `react-markdown` + `remark-gfm` is fine).

**Role messages:**
- **User** has a 28px round avatar with `user-tint` fill / `user-text`
  foreground, then a column with role label + timestamp baseline-aligned,
  and the body.
- **Assistant** uses `claude-tint` / `claude-text` and the `spark` icon.
- **Command** (user kind=`command`) — mono pill, accent name, args in
  `text-2`, timestamp right-aligned.
- **stderr** (user kind=`stderr`) — `danger-soft` fill, `danger` border,
  mono pre-wrap content.

#### Right inspector
Open/closed state lives in `rightOpen` React state, persisted is OK but
not required. When open, shows a context panel for the currently-focused
tool call or diff (file preview, command output, etc.). Components live
in `source/workspace-inspector.jsx`.

#### Status bar
`6px 22px` padding, `surface-2` background, top border. Mono 11px keyboard
hints separated by ~14px gap:
- `j / k` message
- `/` or `⌘K` search
- `t` theme
- `Esc` close

### Reading view (alternate — `source/v1-reading.jsx`)
A document-feel single-column layout with a sticky header and inline tool
capsules in the flow of text. Implement only if you want a "read it like
prose" mode in addition to Workspace.

### Timeline view (alternate — `source/v3-timeline.jsx`)
A vertical spine with avatars on alternating sides and a persistent
token-usage rail. Optional / aspirational; Workspace is the primary
target.

## Interactions & Behavior

- **Session pick:** clicking a sidebar row sets `activeId`, transcript pane
  scrolls to top of that session's messages.
- **Project collapse:** clicking a project header toggles a local
  `collapsed[project]` map.
- **Star / unstar:** toggles `pinned[id]` (persist to localStorage in
  production).
- **Search (⌘K or `/`):** opens a command-palette modal (see
  `source/workspace-search.jsx`). Implement with full-text over
  `{title, project, msgs.text, tool args}`.
- **Resizable panes:** `mousedown` on the handle starts a `mousemove`
  listener that adjusts the pane's width; `mouseup` cleans up. Cursor
  changes to `col-resize` / `row-resize` during drag.
- **Tool/diff pick:** clicking a tool capsule or diff block sets
  `activePart` / `activeDiff` and opens the right inspector with that
  context. Active item gets an accent outline.
- **Theme toggle:** flips `data-theme` on `<html>` between `light` /
  `dark`. The pill shows the icon of the **destination** theme
  (sun = will switch to light, moon = will switch to dark).
- **Side-panel toggle:** `setRightOpen(o => !o)`. Title attribute swaps
  between "Hide side panel" / "Show side panel".
- **Keyboard shortcuts** to implement:
  - `j` / `k` — next/previous message (move `focusedMsg`, scroll into view).
  - `/` or `⌘K` — open search.
  - `t` — toggle theme.
  - `Esc` — close search / inspector / dialogs.

### Responsive / narrow
At narrow widths (or when the "narrow layout" tweak is on), the metric
chips and the side-panel toggle hide. The sidebar collapses into an
off-canvas drawer opened by a hamburger button on the left of the header.

## State Management

Per-session UI state (component-local React state is fine for these):
- `activeId` — currently-open session id
- `focusedMsg` — index of the keyboard-focused message
- `activePart` / `activeDiff` — id of the tool call / diff selected in the
  inspector
- `rightOpen` — boolean, inspector visibility
- `leftWidth` / `rightWidth` — pane widths driven by ResizeHandle
- `collapsed` — `{ [projectName]: boolean }`

Persisted (localStorage in production):
- `pinned` — `{ [sessionId]: boolean }`
- `theme` — `"light" | "dark"`
- `leftWidth`, `rightWidth`
- `density`, `serifTitles`, `showThinking`, `narrowLayout`, `accent`
  (these come from the Tweaks panel; in production they should be real
  Settings, not authoring tweaks).

Data fetching (replace mocks):
- Read Claude Code sessions from `~/.claude/projects/**/*.jsonl`.
  Each line is a JSON object — parse and group by `sessionId`.
- Surface aggregate metrics per session: message count, total tokens,
  model used, last-active timestamp.
- Each message has parts that need to be normalised to the shape
  `source/data.jsx` shows: `text`, `think`, `tool`, `diff`, `markdown`.
  Edit/Write/MultiEdit tool results map to `diff`. Bash maps to `tool`
  with `args.command`. Read maps to `tool` with `args.file_path`.

## Design Tokens
Lift verbatim from `source/tokens.css`. Highlights:

**Colors (light):**
- `--bg #FAF9F6`, `--surface #FFFFFF`, `--surface-2 #F4F2EC`,
  `--surface-3 #ECE9E1`, `--surface-inset #F8F6F1`
- `--text #1F1E1C`, `--text-2 #58544D`, `--text-3 #8B867D`,
  `--text-4 #B5B0A6`
- `--border #E8E4DC`, `--border-strong #D8D2C6`,
  `--border-subtle #F0EDE5`
- `--accent #C96442`, `--accent-hover #B25636`,
  `--accent-soft #F5E6DD`, `--accent-text #8A3F26`
- Role tints — user `#EEF2F7` / `#2C4E6E`, claude `#F7EFE7` / `#8A3F26`,
  tool `#F1EFE9` / `#4A4540`, think `#F0EFEB` / `#6A6359`
- Semantic — success `#2F7D4F`, warn `#B5781E`, danger `#B5392F`,
  info `#2F6FB5`, each paired with a `*-soft` background
- Code — `--code-bg #F4F2EC`, `--code-border #E5E1D8`,
  `--code-text #2A2722`
- Diff — add `#E6F1E5` / `#1F5E2A` / gutter `#C8E0C2`,
  rm `#F7E1DC` / `#8E2B22` / gutter `#ECC2BA`

Dark mode values are in the same file under `[data-theme="dark"]`.

**Spacing & radii:**
- Radii: `--r-1: 6px`, `--r-2: 10px`, `--r-3: 14px`,
  `--r-pill: 999px`
- Padding scale used in the prototype: 6 / 10 / 14 / 22 / 36 px.
- Sidebar row: `6px 14px 7px 28px`. Header strip: `10px 18px`.

**Shadows:**
- `--shadow-sm`, `--shadow-md`, `--shadow-lg` — values defined in
  `tokens.css` for both themes.

**Typography:**
- Sans: **Geist** (Google Fonts). Fallback to system.
- Serif: **Instrument Serif** for titles when "Serif titles" is on.
- Mono: **Geist Mono**. Fallback chain ends at `monospace`.
- `body[data-density="compact"]` shrinks mock font-size to 12.5px,
  line-height 1.35; `h1` becomes 18px.

## Assets
- **Icons** — all custom Lucide-style SVG paths in `source/shared.jsx`
  `Icon` component. Re-use the same path set (or swap to the `lucide-react`
  package; the names match closely: `search`, `filter`, `chart`, `close`,
  `chevron-*`, `user`, `bot`, `spark`, `tool`, `terminal`, `code`, `sun`,
  `moon`, `pin`, `folder`, `command`, `warn`, `more`, `side`, `git`,
  `diff`, `hash`, `circle`, `star`, …).
- **Fonts** — load Geist, Geist Mono, Instrument Serif via Google Fonts
  or self-host. There is no proprietary brand asset in this design.
- **Images** — none. No avatars, no logos beyond the small "C" mark in
  the sidebar (which is a div with a letter, not an image).

## Files (in this bundle)
All inside `source/`:

- `Workspace.html` — primary prototype entry
- `index.html` — design-canvas comparing the three directions
- `tokens.css` — full design-token sheet (light + dark)
- `shared.jsx` — `Icon`, `ThemeToggle`, `MetricChip`, `CodeBlock`,
  `DiffBlock`, `RichText`
- `workspace-app.jsx` — Workspace shell, sidebar, transcript, header,
  resize handles, message rendering
- `workspace-data.jsx` — mock session list + transcript data
- `workspace-code.jsx`, `workspace-inspector.jsx`, `workspace-rail.jsx`,
  `workspace-search.jsx` — right-side panels, search palette, persistent
  rail
- `data.jsx` — alternate mock dataset used by v1/v2/v3 explorations
- `v1-reading.jsx`, `v2-workspace.jsx`, `v3-timeline.jsx` — the three
  exploration directions
- `design-canvas.jsx` — authoring-only canvas component (do not ship)
- `tweaks-panel.jsx` — authoring-only tweaks panel (do not ship)

## Implementation notes (read me)

- **Drop the authoring chrome.** `design-canvas.jsx` and
  `tweaks-panel.jsx` exist only to compare options and adjust tokens
  during design. They have no place in the shipped app.
- **Promote tweaks to settings.** "Density", "Serif titles", "Show
  thinking", "Accent" should become real user preferences (settings
  page + localStorage), not tweaks.
- **Replace mock data first.** Get a real JSONL parser running over a
  sample `~/.claude/projects/...` folder and rendering one session in
  the transcript pane before touching styling — the prototype's
  styling will largely just work once the data shape matches.
- **Keep the token sheet.** Don't translate the CSS variables into
  Tailwind classes or styled-components props until you've reproduced
  the look 1:1 — the variables in `tokens.css` are the contract.
- **Accessibility:** add `aria-label` to all icon-only buttons (the
  prototype uses `title` for now), trap focus in the search palette,
  honour `prefers-reduced-motion` on the focused-message transition.
