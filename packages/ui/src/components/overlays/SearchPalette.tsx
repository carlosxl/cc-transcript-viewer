import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import { I } from '@/components/ui/icons'
import { search, getSearchStatus, subscribeSearchProgress } from '@/api/search'
import { useOverlays } from '@/stores/useOverlays'
import { fmtRelativeTime } from '@/lib/format'
import type { SearchHit, SearchStatusResponse } from '@/lib/types'

interface SearchPaletteProps {
  onPick: (hit: SearchHit) => void
}

const DEBOUNCE_MS = 150

export function SearchPalette({ onPick }: SearchPaletteProps) {
  const open = useOverlays((s) => s.search.open)
  const query = useOverlays((s) => s.search.query)
  const setQuery = useOverlays((s) => s.setQuery)
  const close = useOverlays((s) => s.closeSearch)

  const inputRef = useRef<HTMLInputElement | null>(null)
  const [active, setActive] = useState(0)
  const [debouncedQ, setDebouncedQ] = useState(query)

  useEffect(() => {
    if (!open) return
    const id = setTimeout(() => setDebouncedQ(query), DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [open, query])

  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => inputRef.current?.focus(), 30)
    setActive(0)
    return () => clearTimeout(t)
  }, [open])

  const { data: searchData } = useQuery({
    queryKey: ['search', debouncedQ],
    queryFn: ({ signal }) => search(debouncedQ, { signal }),
    enabled: open && debouncedQ.trim().length > 0,
  })

  const results: SearchHit[] = useMemo(() => searchData?.results ?? [], [searchData])

  // Indexing-progress strip: fetch once on open + subscribe to SSE.
  const [indexStatus, setIndexStatus] = useState<SearchStatusResponse | null>(null)
  useEffect(() => {
    if (!open) return
    let cancelled = false
    getSearchStatus()
      .then((s) => {
        if (!cancelled) setIndexStatus(s)
      })
      .catch(() => {
        /* harmless — strip just won't show */
      })
    const unsub = subscribeSearchProgress((s) => {
      if (!cancelled) setIndexStatus(s)
    })
    return () => {
      cancelled = true
      unsub()
    }
  }, [open])

  const showIndexStrip = Boolean(
    indexStatus && (indexStatus.isReconciling || indexStatus.pendingSessions > 0),
  )
  const pct = indexStatus && indexStatus.totalSessions > 0
    ? Math.max(
        0,
        Math.min(
          100,
          Math.round(
            ((indexStatus.totalSessions - indexStatus.pendingSessions) /
              indexStatus.totalSessions) *
              100,
          ),
        ),
      )
    : 0

  // Arrow nav + Enter pick — scoped to overlay open.
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActive((a) => Math.min(a + 1, results.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActive((a) => Math.max(0, a - 1))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const hit = results[active]
        if (hit) onPick(hit)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, active, results, onPick])

  // Reset active when results change.
  useEffect(() => {
    setActive(0)
  }, [debouncedQ, results.length])

  // Scroll active row into view.
  const listRef = useRef<HTMLDivElement | null>(null)
  useLayoutEffect(() => {
    if (!open) return
    const row = listRef.current?.querySelector<HTMLElement>(`[data-row="${active}"]`)
    if (row) row.scrollIntoView({ block: 'nearest' })
  }, [open, active])

  // Group results by project for display, but keep absolute order for arrow nav.
  const groups = useMemo(() => {
    const out: Array<{ project: string; hits: Array<{ hit: SearchHit; absIdx: number }> }> = []
    const byProj = new Map<string, Array<{ hit: SearchHit; absIdx: number }>>()
    results.forEach((hit, i) => {
      const key = hit.projectSlug || '—'
      const arr = byProj.get(key)
      if (arr) {
        arr.push({ hit, absIdx: i })
      } else {
        const fresh: Array<{ hit: SearchHit; absIdx: number }> = [{ hit, absIdx: i }]
        byProj.set(key, fresh)
        out.push({ project: key, hits: fresh })
      }
    })
    return out
  }, [results])

  if (!open) return null

  return createPortal(
    <>
      <div
        className="overlay-backdrop fixed inset-0 z-[100]"
        style={{
          background: 'oklch(0.05 0.01 265 / 0.5)',
          animation: 'bd-in 120ms ease-out',
        }}
        onClick={close}
      />
      <div
        role="dialog"
        aria-label="Search"
        className="palette-shell fixed z-[101] flex flex-col overflow-hidden"
        style={{
          top: '12%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'min(640px, 90vw)',
          maxHeight: '72vh',
          background: 'var(--surface-1)',
          border: '1px solid var(--border-2)',
          borderRadius: 'var(--r-lg)',
          boxShadow: 'var(--shadow-overlay)',
          animation: 'ovr-in 140ms cubic-bezier(.2,.7,.2,1)',
        }}
      >
        <div
          className="palette-input-row flex items-center gap-[10px] border-b px-[14px] py-[12px]"
          style={{ borderColor: 'var(--border-1)' }}
        >
          <span style={{ color: 'var(--text-2)' }}>
            <I.search size={16} />
          </span>
          <input
            ref={inputRef}
            placeholder="Search sessions, tools, files…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 border-none bg-transparent text-[15px] text-[var(--text-0)] outline-none"
          />
          <kbd
            className="font-mono text-[10px]"
            style={{ color: 'var(--text-3)' }}
          >
            ESC
          </kbd>
        </div>

        {showIndexStrip && (
          <div
            className="palette-status flex items-center gap-2 border-b px-[14px] py-[6px] font-mono text-[10.5px]"
            style={{ borderColor: 'var(--border)', color: 'var(--text-3)' }}
          >
            <span>
              Indexing {indexStatus!.totalSessions} sessions
              {indexStatus!.pendingSessions > 0 ? ` · ${indexStatus!.pendingSessions} pending` : ''}
            </span>
            <span
              className="progress flex-1 overflow-hidden"
              style={{ height: 2, background: 'var(--surface-2)', borderRadius: 99 }}
            >
              <span
                className="bar block"
                style={{
                  height: '100%',
                  width: `${pct}%`,
                  background: 'var(--accent)',
                  borderRadius: 99,
                  transition: 'width 200ms ease-out',
                }}
              />
            </span>
            <span>{pct}%</span>
          </div>
        )}

        <div ref={listRef} className="palette-results overflow-y-auto" style={{ padding: '6px 0 8px' }}>
          {results.length === 0 ? (
            <div
              className="palette-empty text-center"
              style={{ padding: '28px 18px', color: 'var(--text-2)', fontSize: 12.5 }}
            >
              {debouncedQ.trim().length === 0
                ? 'Start typing to search across all sessions.'
                : 'No results.'}
              <div
                className="k mt-1.5 font-mono"
                style={{ fontSize: 10.5, color: 'var(--text-3)' }}
              >
                tools · files · diffs · text · tool_results · prompts
              </div>
            </div>
          ) : (
            groups.map((g) => (
              <div key={g.project}>
                <div
                  className="palette-group-h flex items-center gap-1.5 font-mono uppercase"
                  style={{
                    padding: '8px 14px 4px',
                    fontSize: 10,
                    color: 'var(--text-3)',
                    letterSpacing: '0.07em',
                  }}
                >
                  <I.folder />
                  <span>{g.project}</span>
                  <span className="meta" style={{ color: 'var(--text-2)' }}>
                    · {g.hits.length} matches
                  </span>
                </div>
                {g.hits.map(({ hit, absIdx }) => (
                  <ResultRow
                    key={hit.sessionId + ':' + hit.turnUuid + ':' + absIdx}
                    hit={hit}
                    active={absIdx === active}
                    rowIdx={absIdx}
                    onActivate={() => setActive(absIdx)}
                    onPick={() => onPick(hit)}
                  />
                ))}
              </div>
            ))
          )}
        </div>

        <div
          className="palette-footer flex items-center gap-3.5 border-t font-mono"
          style={{
            borderColor: 'var(--border-1)',
            padding: '8px 14px',
            fontSize: 10.5,
            color: 'var(--text-3)',
          }}
        >
          <Hint label="navigate" k="↑↓" />
          <Hint label="open" k="↵" />
          <Hint label="dismiss" k="esc" />
          {searchData?.truncated && (
            <span style={{ marginLeft: 'auto', color: 'var(--text-2)' }}>
              showing top {results.length} matches
            </span>
          )}
        </div>
      </div>
    </>,
    document.body,
  )
}

function Hint({ label, k }: { label: string; k: string }) {
  return (
    <span className="hint inline-flex items-center gap-[5px]">
      <kbd
        className="rounded-[3px] border bg-[var(--surface-2)] px-[4px]"
        style={{ borderColor: 'var(--border-1)', fontSize: 9, color: 'var(--text-2)' }}
      >
        {k}
      </kbd>
      {label}
    </span>
  )
}

function ResultRow({
  hit,
  active,
  rowIdx,
  onActivate,
  onPick,
}: {
  hit: SearchHit
  active: boolean
  rowIdx: number
  onActivate: () => void
  onPick: () => void
}) {
  return (
    <div
      data-row={rowIdx}
      data-active={active || undefined}
      onMouseEnter={onActivate}
      onClick={onPick}
      className="palette-result flex cursor-pointer flex-col gap-0.5 border-l-2 px-[14px] py-[8px]"
      style={{
        borderLeftColor: active ? 'var(--accent)' : 'transparent',
        background: active ? 'var(--surface-2)' : 'transparent',
      }}
    >
      <div
        className="top flex items-center gap-2"
        style={{ fontSize: 12.5, color: 'var(--text-0)' }}
      >
        <Badge>{hit.contentKind}</Badge>
        <span className="truncate">{hit.sessionTitle}</span>
      </div>
      <SafeSnippet html={hit.snippetHtml} />
      <div className="meta font-mono" style={{ fontSize: 10.5, color: 'var(--text-3)' }}>
        Turn {hit.turnUuid.slice(0, 8)} · {fmtRelativeTime(hit.timestamp)}
      </div>
    </div>
  )
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="badge inline-flex items-center font-mono"
      style={{
        fontSize: 10,
        color: 'var(--text-2)',
        padding: '0 5px',
        borderRadius: 3,
        background: 'var(--surface-2)',
        border: '1px solid var(--border-1)',
      }}
    >
      {children}
    </span>
  )
}

/**
 * Render server-emitted snippet HTML safely:
 *   - Allow only <mark> tags (used to highlight matches).
 *   - Decode HTML entities via DOMParser.
 *   - Everything else becomes inert text.
 * Eliminates any XSS surface even if the snippet is forged downstream.
 */
function SafeSnippet({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!ref.current) return
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const sanitized = sanitizeNodes(doc.body)
    ref.current.replaceChildren(...sanitized)
  }, [html])
  return (
    <div
      ref={ref}
      className="snippet truncate font-mono"
      style={{
        fontSize: 11,
        color: 'var(--text-1)',
        paddingLeft: 4,
        borderLeft: '2px solid var(--border-1)',
        whiteSpace: 'nowrap',
        textOverflow: 'ellipsis',
        overflow: 'hidden',
      }}
    />
  )
}

function sanitizeNodes(parent: Node): Node[] {
  const out: Node[] = []
  for (const node of Array.from(parent.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      out.push(document.createTextNode(node.textContent ?? ''))
    } else if (node.nodeType === Node.ELEMENT_NODE && (node as Element).tagName === 'MARK') {
      const m = document.createElement('mark')
      m.style.background = 'oklch(0.82 0.14 80 / 0.25)'
      m.style.color = 'var(--text-0)'
      m.style.padding = '0 2px'
      m.style.borderRadius = '2px'
      m.textContent = node.textContent ?? ''
      out.push(m)
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      // unknown element → flatten to text
      out.push(document.createTextNode(node.textContent ?? ''))
    }
  }
  return out
}
