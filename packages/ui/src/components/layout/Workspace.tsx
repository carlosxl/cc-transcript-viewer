import { useRef, type ReactNode, type RefObject } from 'react'

interface WorkspaceProps {
  sidebar: ReactNode
  transcript: (bodyRef: RefObject<HTMLDivElement | null>) => ReactNode
  status: ReactNode
}

/**
 * Two-pane workspace shell: sidebar (260px) · transcript (1fr).
 *
 * Owns the transcript bodyRef so the keyboard layer (App.tsx) and scroll
 * helpers stay coherent across re-renders — the prop is rendered via a
 * function so children mount with the same ref instance.
 */
export function Workspace({ sidebar, transcript, status }: WorkspaceProps) {
  const bodyRef = useRef<HTMLDivElement | null>(null)

  return (
    <div className="app grid h-screen min-h-0 grid-rows-[1fr_26px] bg-[var(--surface-0)] text-[var(--text-0)]">
      <div
        className="workspace grid min-h-0"
        style={{ gridTemplateColumns: '260px 1fr' }}
      >
        <aside className="sidebar flex min-h-0 flex-col border-r border-[var(--border)] bg-[var(--surface-1)]">
          {sidebar}
        </aside>
        <main className="transcript flex min-h-0 flex-col bg-[var(--surface-0)] overflow-hidden">
          {transcript(bodyRef)}
        </main>
      </div>
      {status}
    </div>
  )
}
