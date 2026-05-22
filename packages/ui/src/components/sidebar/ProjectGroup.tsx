import { useState } from 'react'
import type { SessionMeta } from '@/lib/types'
import { I } from '@/components/ui/icons'
import { SessionRow } from './SessionRow'

interface ProjectGroupProps {
  id: string
  name: string
  sessions: SessionMeta[]
  activeSessionId: string | null
  onSelectSession: (sessionId: string) => void
}

export function ProjectGroup({ id, name, sessions, activeSessionId, onSelectSession }: ProjectGroupProps) {
  const [collapsed, setCollapsed] = useState(false)
  return (
    <div className="sb-group mt-2" data-id={id} data-collapsed={collapsed || undefined}>
      <div
        className="sb-group-header flex cursor-pointer items-center gap-1.5 px-2.5 py-1.5 pl-2.5 font-mono text-[10.5px] font-medium text-[var(--text-3)] uppercase select-none"
        style={{ letterSpacing: '0.08em' }}
        onClick={() => setCollapsed((c) => !c)}
      >
        <span
          className="sb-group-chev inline-flex w-[10px] text-[var(--text-3)]"
          style={{ transform: collapsed ? 'rotate(-90deg)' : 'none', transition: 'transform 120ms' }}
        >
          <I.chevronDown />
        </span>
        <span className="sb-folder-ico text-[var(--text-3)]">
          <I.folder />
        </span>
        <span
          className="sb-group-name flex-1 truncate font-sans text-[11.5px] font-semibold normal-case text-[var(--text-1)] data-[collapsed=true]:text-[var(--text-2)]"
          style={{ letterSpacing: 0 }}
        >
          {name}
        </span>
        <span className="sb-group-count rounded-full bg-[var(--surface-2)] px-1.5 py-[1px] font-mono text-[10px] text-[var(--text-3)]">
          {sessions.length}
        </span>
      </div>
      {!collapsed &&
        sessions.map((s) => (
          <SessionRow
            key={s.sessionId}
            session={s}
            active={s.sessionId === activeSessionId}
            onClick={() => onSelectSession(s.sessionId)}
          />
        ))}
    </div>
  )
}
