import { Wrench } from 'lucide-react'

const HINT_TOOLS = ['Bash', 'Read', 'Edit', 'Grep']

/**
 * Empty inspector state shown when no `ToolInteraction` is selected. Mirrors
 * `workspace-inspector.jsx` empty state — dashed circle icon, hint, tool chips.
 */
export function InspectorEmpty() {
  return (
    <div
      role="status"
      aria-label="Tool inspector — no selection"
      className="h-full flex flex-col items-center justify-center text-center px-8 gap-3.5 text-muted-foreground"
    >
      <div
        aria-hidden="true"
        className="w-[54px] h-[54px] rounded-full bg-[var(--surface-2)] border border-dashed border-[var(--border-strong)] flex items-center justify-center"
      >
        <Wrench className="w-[22px] h-[22px] text-[var(--text-4)]" />
      </div>
      <div>
        <div className="text-[13.5px] font-semibold text-[var(--text-2)]">Inspector</div>
        <div className="mt-1 text-xs leading-relaxed max-w-[280px]">
          Use{' '}
          <kbd className="font-mono text-[10.5px] border border-border rounded-sm px-1 bg-[var(--surface)]">j</kbd>
          /
          <kbd className="font-mono text-[10.5px] border border-border rounded-sm px-1 bg-[var(--surface)]">k</kbd>
          {' '}to browse turns, or click any tool capsule or diff to inspect arguments, results, and changes.
        </div>
      </div>
      <div className="flex gap-1.5 flex-wrap justify-center mt-1">
        {HINT_TOOLS.map((t) => (
          <span
            key={t}
            className="font-mono text-[10.5px] px-2 py-[3px] border border-border rounded-full text-muted-foreground bg-[var(--surface)]"
          >
            {t}
          </span>
        ))}
      </div>
    </div>
  )
}
