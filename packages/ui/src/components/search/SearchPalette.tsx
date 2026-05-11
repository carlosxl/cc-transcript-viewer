import { useCallback, useEffect, useMemo } from 'react'
import { Loader2 } from 'lucide-react'
import type { SearchHit } from '@cc-viewer/shared'
import {
  CommandDialog,
  CommandEmpty,
  CommandInput,
  CommandList,
  CommandItem,
} from '@/components/ui/command'
import { useSearchStore } from '@/stores/useSearchStore'
import { useUIStore } from '@/stores/useUIStore'
import { useNavigationStore } from '@/stores/useNavigationStore'
import { useSearchQuery } from '@/hooks/useSearchQuery'
import { useSearchProgress } from '@/hooks/useSearchProgress'
import { sanitizeSnippet } from '@/lib/sanitizeSnippet'
import { formatTurnTimestamp } from '@/lib/format'

const KIND_LABEL: Record<SearchHit['contentKind'], string> = {
  text: 'message',
  thinking: 'thinking',
  tool_use: 'tool call',
  tool_result: 'tool result',
}

/**
 * ⌘K cross-session search palette. Mounted once at the AppShell level so
 * the dialog overlay stacks above all panes.
 *
 * Behavior:
 *   - ⌘K (or Ctrl-K) toggles the palette open/closed. Esc closes via the
 *     underlying Radix Dialog.
 *   - Typing a query (>= 2 chars) debounces 200ms and fires /api/search.
 *   - Clicking a hit (or pressing Enter on the highlighted item) closes the
 *     palette, switches the active session, drills into the right subagent,
 *     and asks TranscriptPane to scroll-and-expand the matched turn.
 *   - Footer renders progress while the reconciler is indexing.
 */
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

  // Polling status only while open — saves cycles when palette is dismissed.
  const status = useSearchProgress(isOpen)

  // ⌘K / Ctrl-K toggle.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const isOpenShortcut = e.key === 'k' && (e.metaKey || e.ctrlKey)
      if (!isOpenShortcut) return
      // Don't intercept when the user is typing in another input — except our
      // own palette input, where the dialog's own Escape handles dismissal.
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

  const searchQuery = useSearchQuery(query)
  const hits = useMemo<SearchHit[]>(() => searchQuery.data?.results ?? [], [searchQuery.data])
  const isLoading = searchQuery.isFetching && query.trim().length >= 2

  const onSelectHit = useCallback(
    (hit: SearchHit) => {
      // A hit on tool_use / tool_result / thinking content only has a visible
      // destination row in 'details' view mode; force-switch so the jump
      // lands on something the user can read. Text hits are visible in both
      // modes — leave the user's preference alone.
      if (hit.contentKind !== 'text') {
        setViewMode('details')
      }
      setActiveSessionId(hit.sessionId)
      if (hit.agentId) {
        setDrillStack([{ sessionId: hit.sessionId, agentId: hit.agentId }])
      } else {
        setDrillStack([])
      }
      requestJump({ sessionId: hit.sessionId, agentId: hit.agentId, turnUuid: hit.turnUuid })
    },
    [setViewMode, setActiveSessionId, setDrillStack, requestJump],
  )

  return (
    <CommandDialog
      open={isOpen}
      onOpenChange={(o) => (o ? open() : close())}
      shouldFilter={false}
    >
      <CommandInput
        placeholder="Search across all sessions…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList className="max-h-[400px]">
        {!query.trim() && (
          <div className="px-4 py-6 text-center text-xs text-muted-foreground">
            Type to search across all transcripts.
          </div>
        )}
        {query.trim().length === 1 && (
          <div className="px-4 py-6 text-center text-xs text-muted-foreground">
            Keep typing — searches start at 2 characters.
          </div>
        )}
        {query.trim().length >= 2 && !isLoading && hits.length === 0 && (
          <CommandEmpty>No matches in any session.</CommandEmpty>
        )}
        {isLoading && hits.length === 0 && (
          <div className="px-4 py-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Searching…
          </div>
        )}
        {hits.map((hit) => (
          <CommandItem
            key={`${hit.sessionId}:${hit.agentId ?? ''}:${hit.turnUuid}:${hit.contentKind}`}
            value={`${hit.sessionId}:${hit.agentId ?? ''}:${hit.turnUuid}:${hit.contentKind}`}
            onSelect={() => onSelectHit(hit)}
            className="flex flex-col items-start gap-1 py-2"
          >
            <div className="flex w-full items-center gap-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground truncate">{hit.sessionTitle}</span>
              {hit.agentId && (
                <span className="rounded bg-muted px-1 text-[10px]">subagent</span>
              )}
              <span className="ml-auto text-[10px] uppercase tracking-wide">
                {KIND_LABEL[hit.contentKind]}
              </span>
              <span className="text-[10px]">{formatTurnTimestamp(hit.timestamp)}</span>
            </div>
            <div
              className="text-xs leading-snug text-foreground/90 [&_mark]:bg-yellow-200 [&_mark]:text-yellow-950 [&_mark]:rounded-sm [&_mark]:px-0.5"
              dangerouslySetInnerHTML={{ __html: sanitizeSnippet(hit.snippetHtml) }}
            />
          </CommandItem>
        ))}
      </CommandList>
      {status?.isReconciling && (
        <div className="border-t px-3 py-2 text-[11px] text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-3 w-3 animate-spin" />
          {status.pendingSessions > 0
            ? `Indexing ${status.totalSessions} sessions, ${status.pendingSessions} pending…`
            : `Indexing ${status.totalSessions} sessions…`}
        </div>
      )}
    </CommandDialog>
  )
}
