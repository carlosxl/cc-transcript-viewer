import { useRef, type ReactNode, type RefObject } from 'react'
import { useWorkspace } from '@/stores/useWorkspace'

interface WorkspaceProps {
  sidebar: ReactNode
  transcript: (bodyRef: RefObject<HTMLDivElement | null>) => ReactNode
  inspector: ReactNode
  status: ReactNode
}

/**
 * Three-pane workspace shell per the design's grid:
 *   sidebar (260px) · transcript (1fr) · inspector (380px)
 *
 * Inspector visibility is driven by useWorkspace.inspectorOpen. When hidden,
 * the grid collapses to two columns and `data-inspector-hidden` flips on
 * the wrapper for any descendant styles that key off it.
 *
 * Owns the transcript bodyRef so the keyboard layer (App.tsx) and scroll
 * helpers stay coherent across re-renders — the prop is rendered via a
 * function so children mount with the same ref instance.
 */
export function Workspace({ sidebar, transcript, inspector, status }: WorkspaceProps) {
  const inspectorOpen = useWorkspace((s) => s.inspectorOpen)
  const bodyRef = useRef<HTMLDivElement | null>(null)

  return (
    <div className="app grid h-screen min-h-0 grid-rows-[1fr_26px] bg-[var(--surface-0)] text-[var(--text-0)]">
      <div
        className="workspace grid min-h-0"
        style={{ gridTemplateColumns: inspectorOpen ? '260px 1fr 380px' : '260px 1fr' }}
        data-inspector-hidden={!inspectorOpen}
      >
        <aside className="sidebar flex min-h-0 flex-col border-r border-[var(--border)] bg-[var(--surface-1)]">
          {sidebar}
        </aside>
        <main className="transcript flex min-h-0 flex-col bg-[var(--surface-0)] overflow-hidden">
          {transcript(bodyRef)}
        </main>
        {inspectorOpen && (
          <section className="inspector flex min-h-0 flex-col border-l border-[var(--border)] bg-[var(--surface-1)]">
            {inspector}
          </section>
        )}
      </div>
      {status}
    </div>
  )
}
