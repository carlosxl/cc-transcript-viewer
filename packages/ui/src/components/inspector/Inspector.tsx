import { useCallback, useEffect, useState } from 'react'
import { Terminal, Check } from 'lucide-react'
import { useUIStore } from '@/stores/useUIStore'
import { useNavigationStore } from '@/stores/useNavigationStore'
import { useSearchStore } from '@/stores/useSearchStore'
import { useSelectedInteraction } from '@/hooks/useSelectedInteraction'
import { formatCommand } from '@/lib/formatCommand'
import { cn } from '@/lib/utils'
import { InspectorEmpty } from './InspectorEmpty'
import { ToolHeader } from './ToolHeader'
import { CallTab } from './tabs/CallTab'
import { ResultTab } from './tabs/ResultTab'
import { PreviewTab } from './tabs/PreviewTab'
import { DiffTab } from './tabs/DiffTab'
import { RawTab } from './tabs/RawTab'
import type { SelectedInteraction } from '@/hooks/useSelectedInteraction'

type TabId = 'call' | 'result' | 'preview' | 'diff' | 'raw'

interface TabSpec {
  id: TabId
  label: string
}

function buildTabs(selected: SelectedInteraction): TabSpec[] {
  const tabs: TabSpec[] = [
    { id: 'call', label: 'Call' },
    { id: 'result', label: 'Result' },
  ]
  if (selected.toolUse.name === 'Read' && selected.toolResult) {
    tabs.push({ id: 'preview', label: 'Preview' })
  }
  if (selected.interaction.diff) {
    tabs.push({ id: 'diff', label: 'Diff' })
  }
  tabs.push({ id: 'raw', label: 'Raw' })
  return tabs
}

function defaultTab(selected: SelectedInteraction): TabId {
  if (selected.interaction.diff) return 'diff'
  if (selected.toolUse.name === 'Read' && selected.toolResult) return 'preview'
  return 'result'
}

/**
 * Tool inspector — renders `<InspectorEmpty/>` when no interaction is
 * selected, otherwise a header + tab strip + tab body bound to the current
 * `selectedInteractionId`.
 */
export function Inspector() {
  const selected = useSelectedInteraction()
  const setSelectedInteractionId = useNavigationStore((s) => s.setSelectedInteractionId)
  const activeSessionId = useUIStore((s) => s.activeSessionId)
  const drillStack = useNavigationStore((s) => s.drillStack)
  const requestJump = useSearchStore((s) => s.requestJump)

  const [tab, setTab] = useState<TabId>('result')
  const [copied, setCopied] = useState(false)
  const interactionId = selected?.interaction.id ?? null

  // Reset to the default tab whenever the selected interaction changes.
  useEffect(() => {
    if (selected) setTab(defaultTab(selected))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interactionId])

  const onCopy = useCallback(async () => {
    if (!selected) return
    const text = formatCommand(selected.toolUse)
    try {
      await navigator.clipboard?.writeText(text)
    } catch {
      // Clipboard API unavailable (Safari private mode, jsdom) — swallow.
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [selected])

  const onJumpBack = useCallback(() => {
    if (!selected || !activeSessionId) return
    const drillTop = drillStack[drillStack.length - 1]
    requestJump({
      sessionId: drillTop?.sessionId ?? activeSessionId,
      agentId: drillTop?.agentId ?? null,
      turnUuid: selected.interaction.turnUuid,
      interactionId: selected.interaction.id,
    })
  }, [selected, activeSessionId, drillStack, requestJump])

  const onClose = useCallback(() => {
    setSelectedInteractionId(null)
  }, [setSelectedInteractionId])

  if (!selected) return <InspectorEmpty />

  const tabs = buildTabs(selected)
  // If the active tab is no longer available (e.g. Preview after Read result loaded then session change), fall back to default.
  const activeTab: TabId = tabs.some((t) => t.id === tab) ? tab : defaultTab(selected)

  return (
    <div className="flex flex-col h-full">
      <ToolHeader
        interaction={selected.interaction}
        toolUse={selected.toolUse}
        onJumpBack={onJumpBack}
        onClose={onClose}
      />
      <div className="flex items-center border-b border-border bg-[var(--surface-2)] pl-3 pr-2">
        <div className="flex" role="tablist" aria-label="Inspector tabs">
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={activeTab === t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'px-2.5 py-2 text-xs border-b-2',
                activeTab === t.id
                  ? 'font-semibold text-foreground border-primary'
                  : 'font-medium text-muted-foreground border-transparent hover:text-foreground',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex items-center gap-1 h-6 px-2 text-[11px] rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Copy command to clipboard"
        >
          {copied ? <Check className="w-3 h-3" aria-hidden="true" /> : <Terminal className="w-3 h-3" aria-hidden="true" />}
          {copied ? 'Copied!' : 'Copy command'}
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-auto p-3.5 bg-[var(--surface-inset)]">
        {activeTab === 'call' && <CallTab toolUse={selected.toolUse} />}
        {activeTab === 'result' && (
          <ResultTab interaction={selected.interaction} toolResult={selected.toolResult} />
        )}
        {activeTab === 'preview' && (
          <PreviewTab
            interaction={selected.interaction}
            toolResult={selected.toolResult}
            onSwitchToRaw={() => setTab('raw')}
          />
        )}
        {activeTab === 'diff' && (
          <DiffTab interaction={selected.interaction} toolUse={selected.toolUse} />
        )}
        {activeTab === 'raw' && (
          <RawTab
            interaction={selected.interaction}
            toolUse={selected.toolUse}
            toolResult={selected.toolResult}
          />
        )}
      </div>
    </div>
  )
}
