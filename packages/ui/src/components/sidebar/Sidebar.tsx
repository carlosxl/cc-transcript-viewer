import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listSessions } from '@/api/sessions'
import type { SessionMeta } from '@/lib/types'
import { I } from '@/components/ui/icons'
import { Brand } from './Brand'
import { SearchButton } from './SearchButton'
import { ProjectGroup } from './ProjectGroup'

interface SidebarProps {
  activeSessionId: string | null
  onSelectSession: (sessionId: string) => void
}

interface Group {
  id: string
  name: string
  sessions: SessionMeta[]
  lastTs: number
}

/** Group by `worktreeOf ?? projectPath` so worktree sessions fold under parent. */
function groupSessions(sessions: SessionMeta[]): Group[] {
  const map = new Map<string, Group>()
  for (const s of sessions) {
    const key = s.worktreeOf ?? s.projectPath
    let g = map.get(key)
    if (!g) {
      const name = displayName(key)
      g = { id: key, name, sessions: [], lastTs: 0 }
      map.set(key, g)
    }
    g.sessions.push(s)
    const ts = Date.parse(s.lastTimestamp)
    if (Number.isFinite(ts) && ts > g.lastTs) g.lastTs = ts
  }
  for (const g of map.values()) {
    g.sessions.sort((a, b) => Date.parse(b.lastTimestamp) - Date.parse(a.lastTimestamp))
  }
  return [...map.values()].sort((a, b) => b.lastTs - a.lastTs)
}

function displayName(path: string): string {
  const trimmed = path.replace(/\/+$/, '')
  const parts = trimmed.split('/').filter(Boolean)
  return parts[parts.length - 1] ?? trimmed
}

export function Sidebar({ activeSessionId, onSelectSession }: SidebarProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['sessions'],
    queryFn: ({ signal }) => listSessions({ signal }),
  })

  const groups = useMemo(() => groupSessions(data?.sessions ?? []), [data])

  return (
    <>
      <Brand />
      <SearchButton />
      <div className="sb-list flex-1 overflow-y-auto px-0 pt-1 pb-4">
        {isLoading && <Loading />}
        {error && <Errored message={(error as Error).message} />}
        {!isLoading && !error && groups.length === 0 && <Empty />}
        {groups.map((g) => (
          <ProjectGroup
            key={g.id}
            id={g.id}
            name={g.name}
            sessions={g.sessions}
            activeSessionId={activeSessionId}
            onSelectSession={onSelectSession}
          />
        ))}
      </div>
    </>
  )
}

function Loading() {
  return (
    <div className="px-4 pt-3 font-mono text-[10.5px] text-[var(--text-3)]" style={{ letterSpacing: '0.05em' }}>
      Loading sessions…
    </div>
  )
}

function Errored({ message }: { message: string }) {
  return (
    <div className="px-4 pt-3 font-mono text-[10.5px] text-[var(--red)]">
      Couldn't load sessions: {message}
    </div>
  )
}

function Empty() {
  return (
    <div className="mt-3 flex items-center gap-1.5 px-2.5 py-1.5 font-mono text-[10.5px] text-[var(--text-3)]">
      <span className="text-[var(--text-3)]">
        <I.flask />
      </span>
      <span>No sessions yet</span>
    </div>
  )
}
