export function Brand() {
  return (
    <div className="sb-brand flex min-w-0 items-center gap-2 px-3 pt-3.5 pb-2.5">
      <div
        className="sb-brand-mark grid h-[22px] w-[22px] place-items-center rounded-sm font-mono text-[11px] font-semibold text-white"
        style={{
          background: 'linear-gradient(140deg, var(--accent) 0%, oklch(0.55 0.18 270) 100%)',
          letterSpacing: '-0.02em',
          boxShadow: '0 1px 0 rgba(255,255,255,0.15) inset, 0 0 0 1px rgba(0,0,0,0.2)',
        }}
      >
        cc
      </div>
      <div
        className="sb-brand-name min-w-0 flex-1 truncate text-[13px] font-semibold"
        style={{ letterSpacing: '-0.005em' }}
      >
        cc-transcript-viewer
      </div>
      <div className="sb-brand-tag ml-auto rounded-[3px] border border-[var(--border-1)] px-1.5 py-[2px] font-mono text-[10px] text-[var(--text-3)]">
        local
      </div>
    </div>
  )
}
