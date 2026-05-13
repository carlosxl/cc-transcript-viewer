import { useEffect, useState } from 'react'
import { Wrench, BarChart3, FolderOpen } from 'lucide-react'
import { useNavigationStore } from '@/stores/useNavigationStore'
import { cn } from '@/lib/utils'
import { Inspector } from './Inspector'
import { TokensPanel } from './tabs/TokensPanel'
import { FilesPanel } from './tabs/FilesPanel'

type Tab = 'inspector' | 'tokens' | 'files'

const TABS: { id: Tab; label: string; icon: typeof Wrench }[] = [
  { id: 'inspector', label: 'Inspector', icon: Wrench },
  { id: 'tokens', label: 'Tokens', icon: BarChart3 },
  { id: 'files', label: 'Files', icon: FolderOpen },
]

/**
 * Right-rail container. Three tabs — Inspector / Tokens / Files. Selecting an
 * interaction (capsule click / diff click) forces the rail back to the
 * Inspector tab so the user sees the data they asked for.
 */
export function RightRail() {
  const [tab, setTab] = useState<Tab>('inspector')
  const selectedInteractionId = useNavigationStore((s) => s.selectedInteractionId)

  useEffect(() => {
    if (selectedInteractionId) setTab('inspector')
  }, [selectedInteractionId])

  return (
    <aside
      aria-label="Inspector rail"
      className="h-full flex flex-col bg-card border-l border-border"
    >
      <div
        role="tablist"
        aria-label="Inspector rail tabs"
        className="flex border-b border-border bg-[var(--surface-2)]"
      >
        {TABS.map((t) => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button
              key={t.id}
              role="tab"
              type="button"
              aria-selected={active}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 text-[11.5px] border-b-2',
                active
                  ? 'font-semibold text-foreground bg-background border-primary'
                  : 'font-medium text-muted-foreground border-transparent hover:text-foreground',
              )}
            >
              <Icon className="w-3 h-3" aria-hidden="true" />
              {t.label}
            </button>
          )
        })}
      </div>
      <div className="flex-1 min-h-0 overflow-hidden" role="tabpanel">
        {tab === 'inspector' && <Inspector />}
        {tab === 'tokens' && <TokensPanel />}
        {tab === 'files' && <FilesPanel />}
      </div>
    </aside>
  )
}
