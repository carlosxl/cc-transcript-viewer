import type { DiffBlock } from '@/lib/types'

interface BlockDiffProps {
  block: DiffBlock
  focused: boolean
  onClick: (e: React.MouseEvent) => void
}

export function BlockDiff({ block, focused, onClick }: BlockDiffProps) {
  return (
    <div
      className="diff cursor-pointer overflow-hidden rounded-sm border border-[var(--border-1)] bg-[var(--surface-1)] font-mono text-[11.5px] hover:border-[var(--border-2)]"
      data-active={focused || undefined}
      onClick={onClick}
      style={{
        borderColor: focused ? 'var(--accent-border)' : undefined,
        boxShadow: focused ? '0 0 0 1px var(--accent-border)' : undefined,
      }}
    >
      <div
        className="diff-head flex items-center gap-2 border-b border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1.5 text-[11px]"
      >
        <span className="path text-[var(--text-0)]">{block.path}</span>
        {block.lang && <span className="lang text-[var(--text-3)]">· {block.lang}</span>}
        <span className="nums ml-auto inline-flex gap-1.5">
          <span className="add" style={{ color: 'var(--green)' }}>
            +{block.adds}
          </span>
          <span className="del" style={{ color: 'var(--red)' }}>
            −{block.dels}
          </span>
        </span>
      </div>
      <div
        className="diff-body clipped relative max-h-60 overflow-hidden py-1"
        style={{
          WebkitMaskImage: 'linear-gradient(to bottom, black 80%, transparent)',
          maskImage: 'linear-gradient(to bottom, black 80%, transparent)',
        }}
      >
        {block.hunks.map((h, i) => {
          if (h.type === 'hunk') {
            return (
              <div
                key={i}
                className="diff-line hunk grid items-stretch py-1 px-2 text-[10.5px] text-[var(--text-3)] bg-[var(--surface-2)]"
                style={{ gridTemplateColumns: '1fr', lineHeight: 1.5 }}
              >
                {h.text}
              </div>
            )
          }
          const isAdd = h.type === 'add'
          const isDel = h.type === 'del'
          const sym = isAdd ? '+' : isDel ? '−' : ' '
          return (
            <div
              key={i}
              className="diff-line grid items-stretch"
              style={{
                gridTemplateColumns: '36px 36px 1fr',
                lineHeight: 1.5,
                background: isAdd ? 'var(--diff-add-bg)' : isDel ? 'var(--diff-del-bg)' : undefined,
              }}
            >
              <div className="gut text-right text-[10.5px] text-[var(--text-3)] px-1.5 select-none" style={{ paddingLeft: 8 }}>
                {h.n ?? ''}
              </div>
              <div
                className="gut text-right text-[10.5px] select-none px-1.5"
                style={{
                  color: isAdd ? 'var(--diff-add-fg)' : isDel ? 'var(--diff-del-fg)' : 'var(--text-3)',
                  background: isAdd ? 'var(--diff-add-mark)' : isDel ? 'var(--diff-del-mark)' : undefined,
                }}
              >
                {sym}
              </div>
              <div
                className="src px-2 overflow-x-auto"
                style={{
                  whiteSpace: 'pre',
                  color: isAdd ? 'var(--diff-add-fg)' : isDel ? 'var(--diff-del-fg)' : 'var(--text-0)',
                }}
              >
                {h.text}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
