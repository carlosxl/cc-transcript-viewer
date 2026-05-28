import { I } from '@/components/ui/icons'
import { useOverlays } from '@/stores/useOverlays'

export function SearchButton() {
  const openSearch = useOverlays((s) => s.openSearch)
  return (
    <button
      type="button"
      onClick={openSearch}
      className="sb-search mx-2.5 mb-2.5 flex min-w-0 items-center gap-2 whitespace-nowrap rounded-sm border border-[var(--border-1)] bg-[var(--surface-2)] px-2.5 py-1.5 text-[12px] text-[var(--text-2)] transition-colors hover:border-[var(--border-2)] hover:bg-[var(--surface-3)] hover:text-[var(--text-1)]"
    >
      <I.search />
      <span className="flex-1 overflow-hidden text-left text-ellipsis">Search sessions, tools, files…</span>
      <span className="sb-search-kbd inline-flex flex-shrink-0 gap-[2px]">
        <Kbd>⌘</Kbd>
        <Kbd>K</Kbd>
      </span>
    </button>
  )
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="kbd inline-block rounded-[3px] border border-[var(--border-1)] bg-[var(--surface-1)] px-[4px] font-mono text-[10px] leading-[1.3] text-[var(--text-2)]"
      style={{ borderBottomWidth: 2, minWidth: 14, textAlign: 'center' }}
    >
      {children}
    </span>
  )
}
