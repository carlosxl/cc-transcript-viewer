import type { TurnRef } from '@cc-viewer/shared'

interface FileTimelineProps {
  reads: TurnRef[]
  writes: TurnRef[]
  /** Session-wide window so different files share the same x-axis. */
  startMs: number
  endMs: number
  onJump?: (turnUuid: string) => void
}

interface Marker {
  turnUuid: string
  kind: 'read' | 'write'
  /** Position 0..100 (percent). */
  pos: number
  timestamp: string
}

/**
 * Read/write event markers laid out along a horizontal track. Read markers use
 * the user-rail tint, writes use the brand tint. Position is the event's
 * timestamp linearly normalized inside the session window — same axis for
 * every file in the panel so eye-scanning down the list lines up.
 *
 * When `startMs === endMs` (single-turn session) or any single timestamp is
 * unparseable, that event falls back to a fixed offset to stay visible.
 */
export function FileTimeline({ reads, writes, startMs, endMs, onJump }: FileTimelineProps) {
  const span = Math.max(1, endMs - startMs)
  const markers: Marker[] = [
    ...reads.map((r) => toMarker(r, 'read', startMs, span)),
    ...writes.map((w) => toMarker(w, 'write', startMs, span)),
  ]

  return (
    <div className="relative h-3.5 rounded-full bg-[var(--surface-3)] overflow-hidden">
      {markers.map((m, i) => {
        const Tag = onJump ? 'button' : 'span'
        const title = `${m.kind === 'read' ? 'Read' : 'Write'}${m.timestamp ? ` · ${m.timestamp}` : ''}`
        return (
          <Tag
            key={m.turnUuid + ':' + m.kind + ':' + i}
            type={onJump ? ('button' as const) : undefined}
            onClick={onJump ? () => onJump(m.turnUuid) : undefined}
            aria-label={title}
            title={title}
            className={
              'absolute top-px h-3 w-[7px] rounded-[2px] border border-[var(--surface)] ' +
              (onJump ? 'cursor-pointer hover:scale-110 transition-transform ' : '') +
              (m.kind === 'write'
                ? 'bg-[var(--brand)]'
                : 'bg-[var(--user-rail)]')
            }
            style={{ left: `calc(${m.pos.toFixed(2)}% - 3.5px)` }}
          />
        )
      })}
    </div>
  )
}

function toMarker(ref: TurnRef, kind: Marker['kind'], startMs: number, span: number): Marker {
  const t = Date.parse(ref.timestamp)
  let pos = 50
  if (Number.isFinite(t)) {
    const ratio = (t - startMs) / span
    pos = Math.min(100, Math.max(0, ratio * 100))
  }
  return { turnUuid: ref.turnUuid, kind, pos, timestamp: ref.timestamp }
}
