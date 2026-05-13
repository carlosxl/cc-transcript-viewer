import { Star } from 'lucide-react'
import type { SessionMeta } from '@cc-viewer/shared'
import { compactNumber, relativeTime } from '@/lib/format'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useUIStore } from '@/stores/useUIStore'
import { cn } from '@/lib/utils'

interface SessionRowProps {
  session: SessionMeta
  active: boolean
  onSelect: (sessionId: string) => void
}

/**
 * Compact v2-aligned sidebar row (FR-029..FR-034).
 *
 * Height ≈32–36px, indented under the project header, no card border.
 * Active: accent-soft fill (`bg-accent`) — no left border or other indent.
 * Pinned: filled accent Star prefixes the title; non-pinned rows reserve
 *   no space for the star. The star is display-only here — toggling pin
 *   state lives on `TranscriptHeader`'s StarButton.
 * Live: pulsing green dot at row's top-right.
 * Token-count tooltip preserves the four-way breakdown (FR-033).
 */
export function SessionRow({ session, active, onSelect }: SessionRowProps) {
  const u = session.totalUsage
  const total = u.inputTokens + u.outputTokens + u.cacheCreationTokens + u.cacheReadTokens
  const breakdown = `In ${compactNumber(u.inputTokens)} / Out ${compactNumber(u.outputTokens)} / C+ ${compactNumber(u.cacheCreationTokens)} / C- ${compactNumber(u.cacheReadTokens)}`
  const pinned = useUIStore((s) => s.pinnedSessions.has(session.sessionId))

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Open session: ${session.title}`}
      aria-pressed={active}
      onClick={() => onSelect(session.sessionId)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect(session.sessionId)
        }
      }}
      className={cn(
        'relative pl-7 pr-3 py-1 cursor-pointer select-none',
        'hover:bg-accent',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1',
        active && 'bg-accent',
      )}
    >
      {/* Title (line 1) — 12.5px, single line, ellipsized; star prefix only when pinned */}
      <div className="text-[12.5px] font-medium truncate text-foreground leading-4 flex items-center gap-1.5">
        {pinned && (
          <Star
            className="w-3 h-3 shrink-0 text-primary"
            aria-hidden="true"
            fill="currentColor"
            strokeWidth={0}
          />
        )}
        <span className="truncate">{session.title}</span>
      </div>

      {/* Meta (line 2) — mono, 10.5px, muted */}
      <div className="font-mono text-[10.5px] text-muted-foreground leading-4 mt-0 flex items-center gap-1.5">
        <span>{relativeTime(session.lastTimestamp)}</span>
        <span aria-hidden="true">·</span>
        <span>{session.messageCount} msg</span>
        <span aria-hidden="true">·</span>
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="font-mono">{compactNumber(total)}</span>
            </TooltipTrigger>
            <TooltipContent side="bottom">{breakdown}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Live dot — only when isLive */}
      {session.isLive === true && (
        <span
          aria-hidden="true"
          className="absolute top-1.5 right-2 w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"
        />
      )}
    </div>
  )
}
