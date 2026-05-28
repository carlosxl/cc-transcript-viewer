import type { DiffBlock } from '@/lib/types'

interface BlockDiffProps {
  block: DiffBlock
}

export function BlockDiff({ block }: BlockDiffProps) {
  return (
    <div className="va-diff">
      <div className="va-diff-meta">
        <span className="path">{block.path}</span>
        {block.lang && <span className="lang">· {block.lang}</span>}
        <span className="add" style={{ marginLeft: 'auto' }}>+{block.adds}</span>
        <span className="del">−{block.dels}</span>
      </div>
      <div className="shared-diff-body dense">
        {block.hunks.map((h, i) => {
          if (h.type === 'hunk') {
            return (
              <div key={i} className="sdl hunk">
                {h.text}
              </div>
            )
          }
          const cls = h.type === 'add' ? 'add' : h.type === 'del' ? 'del' : 'ctx'
          const sym = h.type === 'add' ? '+' : h.type === 'del' ? '−' : ' '
          return (
            <div key={i} className={'sdl ' + cls}>
              <span className="ln">{h.n ?? ''}</span>
              <span className="mk">{sym}</span>
              <span className="src">{h.text}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
