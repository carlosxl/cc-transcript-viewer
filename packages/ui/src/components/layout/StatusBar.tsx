import { useFocus } from '@/stores/useFocus'
import { useSessionStack } from '@/stores/useSessionStack'
import { STATUS_HINTS } from '@/lib/shortcuts'
import { shortPreview } from '@/lib/format'

function Crumb() {
  const nodeMeta = useFocus((s) => s.nodeMeta)
  const blockMeta = useFocus((s) => s.blockMeta)
  const view = useSessionStack((s) => s.stack[s.stack.length - 1]?.view ?? null)

  if (!view) {
    return <span className="text-[var(--text-3)]">no session</span>
  }

  if (blockMeta) {
    const { block, request, turn } = blockMeta
    const kind = block.kind === 'tool_use' ? `tool_use · ${block.name}` : block.kind === 'diff' ? `diff · ${block.path}` : block.kind
    return (
      <span className="crumb inline-flex items-center gap-1.5">
        <span>Turn {turn.id}</span>
        <span className="sep text-[var(--text-disabled)]">›</span>
        <span>Req {shortReq(request.id)}</span>
        <span className="sep text-[var(--text-disabled)]">›</span>
        <span className="focus text-[var(--text-0)]">{kind}</span>
      </span>
    )
  }

  if (nodeMeta) {
    const { kind, turn, request, idx, total } = nodeMeta
    if (kind === 'user') {
      return (
        <span className="crumb inline-flex items-center gap-1.5">
          <span>Turn {turn.id}</span>
          <span className="sep text-[var(--text-disabled)]">›</span>
          <span className="focus text-[var(--text-0)]">user message</span>
          {turn.prompt && (
            <>
              <span className="sep text-[var(--text-disabled)]">·</span>
              <span className="text-[var(--text-3)]">{shortPreview(turn.prompt, 48)}</span>
            </>
          )}
        </span>
      )
    }
    return (
      <span className="crumb inline-flex items-center gap-1.5">
        <span>Turn {turn.id}</span>
        <span className="sep text-[var(--text-disabled)]">›</span>
        <span className="focus text-[var(--text-0)]">
          Request {request ? shortReq(request.id) : '—'}
          {idx != null && total != null ? ` (${idx}/${total})` : ''}
        </span>
      </span>
    )
  }

  return <span className="text-[var(--text-3)]">{view.title}</span>
}

function shortReq(id: string): string {
  return id.length > 8 ? `${id.slice(0, 8)}…` : id
}

export function StatusBar() {
  return (
    <footer
      className="status flex items-center gap-3.5 border-t border-[var(--border)] bg-[var(--surface-1)] px-3.5 font-mono text-[10.5px] text-[var(--text-2)]"
      style={{ height: 26 }}
    >
      <Crumb />
      <span className="hints ml-auto inline-flex gap-4">
        {STATUS_HINTS.map((h, i) => (
          <span key={i} className="hint inline-flex items-center gap-1.5">
            <span className="kg inline-flex gap-[2px]">
              {h.keys.map((k, j) => (
                <kbd
                  key={j}
                  className="rounded-[3px] border border-[var(--border-1)] bg-[var(--surface-1)] px-[4px] text-[10px] leading-[1.2] text-[var(--text-2)]"
                >
                  {k}
                </kbd>
              ))}
            </span>
            <span className="text-[var(--text-2)]">{h.label}</span>
          </span>
        ))}
      </span>
    </footer>
  )
}
