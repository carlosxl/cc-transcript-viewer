import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, Search as SearchIcon, MessageSquare, Wrench, FileCode } from 'lucide-react'
import type { SearchHit, SessionMeta } from '@cc-viewer/shared'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { useSearchStore } from '@/stores/useSearchStore'
import { useUIStore } from '@/stores/useUIStore'
import { useNavigationStore } from '@/stores/useNavigationStore'
import { useSearchQuery } from '@/hooks/useSearchQuery'
import { useSearchProgress } from '@/hooks/useSearchProgress'
import { useSessionList } from '@/hooks/useSessionList'
import { sanitizeSnippet } from '@/lib/sanitizeSnippet'
import { cn } from '@/lib/utils'

/**
 * Phase 7 redesign — cross-session ⌘K palette.
 *
 * Visual:
 *   - 640px modal, header with input + Esc kbd, filter chip row, results list,
 *     footer with kbd hints + result count.
 *   - Empty-state shows clickable suggestion chips that fill the input.
 *
 * Filtering (client-side over the existing /api/search results, since the
 * server returns content-kind on every hit and we already have the session
 * list cached for title matching):
 *   - 'all'      — every hit + session-title matches against the session list.
 *   - 'sessions' — session-title matches only. Falls back to a virtual "session"
 *     row (no turnUuid) when a title matches. Click → opens the session.
 *   - 'tools'    — hits where contentKind ∈ {tool_use, tool_result}.
 *   - 'files'    — tool_use hits whose snippet contains a path-like fragment
 *     (substring "/" or starts with "Read"/"Edit"/"Write"/"Glob"/"Grep"). This
 *     is intentionally a permissive heuristic so we don't depend on a schema
 *     change in the server index. Good enough for the UX described in §7.
 */

type Filter = 'all' | 'sessions' | 'tools' | 'files'

type ResultRow =
  | { kind: 'session'; sessionMeta: SessionMeta }
  | { kind: 'hit'; hit: SearchHit }

const CHIPS: Array<{ id: Filter; label: string; icon?: React.ReactNode }> = [
  { id: 'all', label: 'All' },
  { id: 'sessions', label: 'Sessions', icon: <MessageSquare className="w-3 h-3" aria-hidden="true" /> },
  { id: 'tools', label: 'Tool calls', icon: <Wrench className="w-3 h-3" aria-hidden="true" /> },
  { id: 'files', label: 'Files', icon: <FileCode className="w-3 h-3" aria-hidden="true" /> },
]

const SUGGESTIONS = ['security review', 'static.ts', 'Bash', 'token report']

const KIND_LABEL: Record<SearchHit['contentKind'], string> = {
  text: 'MESSAGE',
  thinking: 'THINKING',
  tool_use: 'TOOL',
  tool_result: 'TOOL',
}

const FILE_TOOL_PREFIXES = ['Read', 'Edit', 'Write', 'Glob', 'Grep', 'NotebookEdit', 'WebFetch']

function looksLikeFileHit(hit: SearchHit): boolean {
  if (hit.contentKind !== 'tool_use') return false
  // sanitizeSnippet output contains <mark>/HTML; strip tags first.
  const plain = hit.snippetHtml.replace(/<[^>]+>/g, '')
  if (plain.includes('/')) return true
  return FILE_TOOL_PREFIXES.some((p) => plain.startsWith(p))
}

/**
 * Mirror the design's `highlightMatch` — wrap each case-insensitive occurrence
 * of `q` in <mark>. Server snippets are already pre-marked by FTS5; this
 * helper is only used for titles (session-row + per-hit sessionTitle), where
 * we don't get a server-rendered snippet.
 */
function HighlightedText({ text, query }: { text: string; query: string }) {
  const q = query.trim()
  if (!q) return <>{text}</>
  const needle = q.toLowerCase()
  const haystack = text.toLowerCase()
  const out: React.ReactNode[] = []
  let cursor = 0
  while (cursor < text.length) {
    const idx = haystack.indexOf(needle, cursor)
    if (idx < 0) {
      out.push(text.slice(cursor))
      break
    }
    if (idx > cursor) out.push(text.slice(cursor, idx))
    out.push(
      <mark
        key={idx}
        className="bg-primary/30 text-foreground rounded-sm px-0.5"
      >
        {text.slice(idx, idx + needle.length)}
      </mark>,
    )
    cursor = idx + needle.length
  }
  return <>{out}</>
}

export function SearchPalette() {
  const isOpen = useSearchStore((s) => s.isOpen)
  const open = useSearchStore((s) => s.open)
  const close = useSearchStore((s) => s.close)
  const query = useSearchStore((s) => s.query)
  const setQuery = useSearchStore((s) => s.setQuery)
  const requestJump = useSearchStore((s) => s.requestJump)

  const setActiveSessionId = useUIStore((s) => s.setActiveSessionId)
  const setViewMode = useUIStore((s) => s.setViewMode)
  const setDrillStack = useNavigationStore((s) => s.setDrillStack)

  const status = useSearchProgress(isOpen)
  const [filter, setFilter] = useState<Filter>('all')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const isOpenShortcut = e.key === 'k' && (e.metaKey || e.ctrlKey)
      if (!isOpenShortcut) return
      const target = e.target as HTMLElement | null
      const inEditable =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        (target as HTMLElement | null)?.isContentEditable
      if (inEditable && !isOpen) return
      e.preventDefault()
      if (isOpen) close()
      else open()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, open, close])

  // Auto-focus input on open.
  useEffect(() => {
    if (!isOpen) return
    const t = window.setTimeout(() => inputRef.current?.focus(), 30)
    return () => window.clearTimeout(t)
  }, [isOpen])

  const searchQuery = useSearchQuery(query)
  const hits = useMemo<SearchHit[]>(() => searchQuery.data?.results ?? [], [searchQuery.data])
  const isLoading = searchQuery.isFetching && query.trim().length >= 2

  const { data: sessionList } = useSessionList()

  // Build the displayed list per filter. Memoize on the inputs so keystrokes
  // don't recompute when sessionList re-references the same data.
  const rows = useMemo<ResultRow[]>(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 2) return []
    const out: ResultRow[] = []

    if (filter === 'all' || filter === 'sessions') {
      const seen = new Set<string>()
      for (const s of sessionList ?? []) {
        if (s.title.toLowerCase().includes(q)) {
          if (seen.has(s.sessionId)) continue
          seen.add(s.sessionId)
          out.push({ kind: 'session', sessionMeta: s })
        }
      }
    }

    if (filter === 'sessions') return out

    for (const hit of hits) {
      if (filter === 'tools' && !(hit.contentKind === 'tool_use' || hit.contentKind === 'tool_result')) continue
      if (filter === 'files' && !looksLikeFileHit(hit)) continue
      out.push({ kind: 'hit', hit })
    }
    return out
  }, [query, filter, hits, sessionList])

  // Reset cursor when results change.
  useEffect(() => { setSelectedIndex(0) }, [query, filter, rows.length])

  const onPickSession = useCallback(
    (sessionId: string, agentId: string | null, turnUuid: string | undefined, forceDetails: boolean) => {
      if (forceDetails) setViewMode('details')
      setActiveSessionId(sessionId)
      setDrillStack(agentId ? [{ sessionId, agentId }] : [])
      if (turnUuid) requestJump({ sessionId, agentId, turnUuid })
      else close()
    },
    [setViewMode, setActiveSessionId, setDrillStack, requestJump, close],
  )

  const onSelectRow = useCallback(
    (row: ResultRow) => {
      if (row.kind === 'session') {
        onPickSession(row.sessionMeta.sessionId, null, undefined, false)
        return
      }
      const hit = row.hit
      onPickSession(hit.sessionId, hit.agentId, hit.turnUuid, hit.contentKind !== 'text')
    },
    [onPickSession],
  )

  // Up/Down/Enter while open.
  useEffect(() => {
    if (!isOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((i) => Math.min(i + 1, Math.max(rows.length - 1, 0)))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((i) => Math.max(i - 1, 0))
      } else if (e.key === 'Enter') {
        const target = rows[selectedIndex]
        if (!target) return
        e.preventDefault()
        onSelectRow(target)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, rows, selectedIndex, onSelectRow])

  return (
    <Dialog open={isOpen} onOpenChange={(o) => (o ? open() : close())}>
      <DialogHeader className="sr-only">
        <DialogTitle>Search</DialogTitle>
        <DialogDescription>Search across all sessions, tool calls, and files.</DialogDescription>
      </DialogHeader>
      <DialogContent
        className="overflow-hidden p-0 sm:max-w-[640px] gap-0 top-[10vh] translate-y-0"
        showCloseButton={false}
      >
        {/* Header — input + Esc kbd */}
        <div className="flex items-center gap-2.5 px-4 h-12 border-b border-border">
          <SearchIcon className="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search across all sessions, tool calls, and files…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            aria-label="Search query"
          />
          <kbd className="font-mono text-[10.5px] border border-border bg-muted px-1.5 py-0 rounded text-muted-foreground">
            Esc
          </kbd>
        </div>

        {/* Filter chips */}
        <div
          role="tablist"
          aria-label="Search filters"
          className="flex gap-1 px-3 py-1.5 border-b border-border bg-muted/50"
        >
          {CHIPS.map((c) => {
            const active = filter === c.id
            return (
              <button
                key={c.id}
                role="tab"
                type="button"
                aria-selected={active}
                onClick={() => setFilter(c.id)}
                className={cn(
                  'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11.5px] border transition-colors',
                  active
                    ? 'bg-primary/15 text-foreground border-primary font-semibold'
                    : 'text-muted-foreground border-transparent hover:bg-accent',
                )}
              >
                {c.icon}
                {c.label}
              </button>
            )
          })}
        </div>

        {/* Result list */}
        <div className="flex-1 min-h-0 overflow-y-auto py-1.5 max-h-[50vh]">
          {!query.trim() && (
            <EmptyState
              totalSessions={sessionList?.length ?? 0}
              onPickSuggestion={(s) => setQuery(s)}
            />
          )}

          {query.trim().length === 1 && (
            <div className="px-4 py-8 text-center text-xs text-muted-foreground">
              Keep typing — searches start at 2 characters.
            </div>
          )}

          {query.trim().length >= 2 && isLoading && rows.length === 0 && (
            <div className="px-4 py-8 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Searching…
            </div>
          )}

          {query.trim().length >= 2 && !isLoading && rows.length === 0 && (
            <div className="px-4 py-8 text-center text-xs text-muted-foreground">
              No matches for <span className="font-mono text-foreground">&quot;{query.trim()}&quot;</span>
            </div>
          )}

          {rows.map((row, i) => (
            <ResultRowView
              key={rowKey(row, i)}
              row={row}
              query={query}
              selected={i === selectedIndex}
              onSelect={() => onSelectRow(row)}
              onHover={() => setSelectedIndex(i)}
            />
          ))}
        </div>

        {/* Footer — kbd hints + count */}
        <div className="flex items-center gap-3.5 px-3.5 py-1.5 border-t border-border bg-muted/50 font-mono text-[10.5px] text-muted-foreground">
          <span className="inline-flex items-center gap-1"><Kbd>↑↓</Kbd> navigate</span>
          <span className="inline-flex items-center gap-1"><Kbd>↵</Kbd> open</span>
          <span className="inline-flex items-center gap-1"><Kbd>Esc</Kbd> close</span>
          <span className="flex-1" />
          {status?.isReconciling ? (
            <span className="inline-flex items-center gap-1 text-foreground/70">
              <Loader2 className="h-3 w-3 animate-spin" />
              {status.pendingSessions > 0
                ? `Indexing ${status.pendingSessions} sessions…`
                : `Indexing ${status.totalSessions} sessions…`}
            </span>
          ) : query.trim().length >= 2 ? (
            <span>{rows.length} result{rows.length !== 1 ? 's' : ''}</span>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="font-mono text-[10px] border border-border bg-background px-1 py-0 rounded text-foreground/70">
      {children}
    </kbd>
  )
}

function rowKey(row: ResultRow, i: number): string {
  if (row.kind === 'session') return `session:${row.sessionMeta.sessionId}`
  const h = row.hit
  return `hit:${h.sessionId}:${h.agentId ?? ''}:${h.turnUuid}:${h.contentKind}:${i}`
}

function EmptyState({
  totalSessions,
  onPickSuggestion,
}: {
  totalSessions: number
  onPickSuggestion: (s: string) => void
}) {
  return (
    <div className="px-5 py-10 text-center text-muted-foreground">
      <SearchIcon className="w-6 h-6 mx-auto text-foreground/30" aria-hidden="true" />
      <div className="mt-2 text-xs">Search across {totalSessions} session{totalSessions === 1 ? '' : 's'}</div>
      <div className="mt-3.5 flex flex-wrap justify-center gap-2 font-mono text-[11px]">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onPickSuggestion(s)}
            className="border border-border rounded px-2 py-0.5 text-foreground/80 hover:bg-accent hover:text-foreground"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}

function ResultRowView({
  row,
  query,
  selected,
  onSelect,
  onHover,
}: {
  row: ResultRow
  query: string
  selected: boolean
  onSelect: () => void
  onHover: () => void
}) {
  if (row.kind === 'session') {
    const s = row.sessionMeta
    return (
      <button
        type="button"
        onClick={onSelect}
        onMouseEnter={onHover}
        className={cn(
          'flex w-full items-center gap-3 px-4 py-2 text-left border-l-2',
          selected ? 'bg-accent border-primary' : 'border-transparent hover:bg-accent/60',
        )}
      >
        <MessageSquare className="w-3.5 h-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <div className="text-[13px] text-foreground truncate">
            <HighlightedText text={s.title} query={query} />
          </div>
          <div className="text-[11px] text-muted-foreground font-mono mt-0.5">
            {s.projectSlug} · {s.messageCount} msg
          </div>
        </div>
        <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          SESSION
        </div>
      </button>
    )
  }
  const hit = row.hit
  const isFileHit = hit.contentKind === 'tool_use' && looksLikeFileHit(hit)
  const KindIcon = hit.contentKind === 'tool_use' || hit.contentKind === 'tool_result'
    ? Wrench
    : MessageSquare
  const kindLabel = isFileHit ? 'FILE' : KIND_LABEL[hit.contentKind]
  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={onHover}
      className={cn(
        'flex w-full items-start gap-3 px-4 py-2 text-left border-l-2',
        selected ? 'bg-accent border-primary' : 'border-transparent hover:bg-accent/60',
      )}
    >
      <KindIcon className="w-3.5 h-3.5 shrink-0 mt-0.5 text-muted-foreground" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
          <span className="font-medium text-foreground truncate">
            <HighlightedText text={hit.sessionTitle} query={query} />
          </span>
          {hit.agentId && (
            <span className="rounded bg-muted px-1 py-0 text-[10px]">subagent</span>
          )}
        </div>
        <div
          className="mt-0.5 text-[12px] leading-snug text-foreground/85 line-clamp-2 [&_mark]:bg-primary/30 [&_mark]:text-foreground [&_mark]:rounded-sm [&_mark]:px-0.5"
          dangerouslySetInnerHTML={{ __html: sanitizeSnippet(hit.snippetHtml) }}
        />
      </div>
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground shrink-0 mt-0.5">
        {kindLabel}
      </div>
    </button>
  )
}
