interface StatusBarProps {
  /** 1-based message index, or null when nothing is focused. */
  current: number | null
  /** Total visible rows in the transcript. */
  total: number
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center font-mono text-[10px] leading-none border border-border bg-card text-foreground rounded-[4px] px-[5px] py-[2px] mx-[1px]">
      {children}
    </kbd>
  )
}

/**
 * Footer status bar pinned to the bottom of the center column (Phase 3).
 * Mirrors the design's keyboard hints + `msg N / total` counter.
 */
export function StatusBar({ current, total }: StatusBarProps) {
  return (
    <div
      role="contentinfo"
      aria-label="Keyboard shortcuts"
      className="h-7 flex-shrink-0 flex items-center gap-3 px-4 border-t border-border bg-muted/60 font-mono text-[11px] text-muted-foreground"
    >
      <span><Kbd>j</Kbd>/<Kbd>k</Kbd> message</span>
      <span><Kbd>/</Kbd> or <Kbd>⌘K</Kbd> search</span>
      <span><Kbd>t</Kbd> theme</span>
      <span><Kbd>r</Kbd> report</span>
      <span><Kbd>Esc</Kbd> close</span>
      <span className="flex-1" />
      <span aria-live="polite">
        msg {current === null ? '—' : current} / {total}
      </span>
    </div>
  )
}
