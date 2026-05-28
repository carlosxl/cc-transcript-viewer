interface LiveTailToastProps {
  /** Click handler — fires the same path as Shift+G (consume pending + scroll). */
  onFollow: () => void
}

export function LiveTailToast({ onFollow }: LiveTailToastProps) {
  return (
    <div
      className="live-toast absolute bottom-[14px] left-1/2 inline-flex cursor-pointer items-center gap-2 text-[12px]"
      style={{
        transform: 'translate(-50%, 0)',
        background: 'var(--surface-3)',
        border: '1px solid var(--border-2)',
        color: 'var(--text-0)',
        padding: '6px 10px 6px 12px',
        borderRadius: 99,
        boxShadow: 'var(--shadow-popover)',
        animation: 'toast-in 200ms ease-out',
      }}
      onClick={onFollow}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onFollow()
        }
      }}
    >
      <span
        className="dot inline-block"
        style={{
          width: 6,
          height: 6,
          borderRadius: 99,
          background: 'var(--green)',
          animation: 'live-pulse 1.6s ease-out infinite',
        }}
      />
      <span>New Turn arrived</span>
      <kbd
        className="font-mono"
        style={{
          fontSize: 10,
          color: 'var(--text-2)',
          background: 'var(--surface-1)',
          border: '1px solid var(--border-1)',
          padding: '1px 4px',
          borderRadius: 3,
        }}
      >
        Shift+G
      </kbd>
      <span style={{ color: 'var(--text-3)' }}>to follow</span>
    </div>
  )
}
