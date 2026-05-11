import type { SessionMeta } from '@cc-viewer/shared'
import { compactNumber, relativeTime } from '@/lib/format'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface SessionRowProps {
  session: SessionMeta
  active: boolean
  onSelect: (sessionId: string) => void
}

/**
 * Single sidebar row. 52px tall (UI-SPEC §"Spacing Scale"):
 *   title 20px (14px/600 + line-height) + meta 16px (12px/400 muted) + 8px padding top/bottom.
 *
 * Live dot (D-24): 8px green-500 with animate-pulse, ONLY rendered when isLive === true.
 * Active highlight (D-25): 2px primary left-border + accent background.
 * Token tooltip (D-23 / UI-SPEC line 281): four-way breakdown on hover.
 */
export function SessionRow({ session, active, onSelect }: SessionRowProps) {
  const u = session.totalUsage
  const total = u.inputTokens + u.outputTokens + u.cacheCreationTokens + u.cacheReadTokens
  const breakdown = `In ${compactNumber(u.inputTokens)} / Out ${compactNumber(u.outputTokens)} / C+ ${compactNumber(u.cacheCreationTokens)} / C- ${compactNumber(u.cacheReadTokens)}`

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
        'relative h-[52px] px-4 py-2 cursor-pointer select-none',
        'border-l-2 border-transparent',
        'hover:bg-accent',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1',
        active && 'border-primary bg-accent',
      )}
    >
      {/* Title (line 1) — 14px/600, truncated */}
      <div className="text-sm font-semibold truncate text-foreground leading-5">
        {session.title}
      </div>

      {/* Meta (line 2) — 12px/400 muted */}
      <div className="text-xs font-normal text-muted-foreground leading-4 mt-0.5 flex items-center gap-2">
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

      {/* Live dot — only when isLive (no DOM otherwise per UI-SPEC line 268) */}
      {session.isLive === true && (
        <span
          aria-hidden="true"
          className="absolute top-3 right-3 w-2 h-2 rounded-full bg-green-500 animate-pulse"
        />
      )}
    </div>
  )
}
