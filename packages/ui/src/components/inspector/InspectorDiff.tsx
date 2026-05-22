import type { DiffBlock, FocusedBlockMeta } from '@/lib/types'
import { I } from '@/components/ui/icons'
import { CrumbStrip } from './CrumbStrip'

export function InspectorDiff({ meta }: { meta: FocusedBlockMeta }) {
  const block = meta.block as DiffBlock
  const { request, turn } = meta
  const copyPath = () => {
    try {
      navigator.clipboard?.writeText(block.path)
    } catch {
      /* clipboard might be blocked; ignore */
    }
  }
  return (
    <>
      <CrumbStrip
        kind="DIFF"
        parent={`REQUEST ${request.id.slice(0, 8)} › TURN ${turn.id.slice(0, 8)}`}
        title={block.path}
        sub={`${block.lang ? block.lang + ' · ' : ''}+${block.adds} −${block.dels}`}
      />
      <div className="ins-body flex-1 overflow-y-auto">
        <div className="ins-tool-section border-b border-[var(--border)] px-[18px] py-3.5">
          <div className="flex items-center justify-between">
            <div
              className="ins-section-title flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase text-[var(--text-3)]"
              style={{ letterSpacing: '0.07em' }}
            >
              Full diff
            </div>
            <button
              type="button"
              onClick={copyPath}
              className="export-btn inline-flex items-center gap-1 rounded-[3px] border border-[var(--border-1)] bg-[var(--surface-2)] px-2 py-1 font-mono text-[10px] uppercase text-[var(--text-1)] hover:bg-[var(--surface-3)] hover:text-[var(--text-0)]"
              style={{ letterSpacing: '0.06em' }}
            >
              <I.copy /> Copy path
            </button>
          </div>
          <div className="diff mt-2 overflow-hidden rounded-sm border border-[var(--border-1)] bg-[var(--surface-1)] font-mono text-[11.5px]">
            <div className="diff-body no-clip py-1">
              {block.hunks.map((h, i) => {
                if (h.type === 'hunk') {
                  return (
                    <div
                      key={i}
                      className="diff-line hunk grid items-stretch px-2 py-1 text-[10.5px] text-[var(--text-3)] bg-[var(--surface-2)]"
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
                    <div className="gut select-none px-1.5 text-right text-[10.5px] text-[var(--text-3)]" style={{ paddingLeft: 8 }}>
                      {h.n ?? ''}
                    </div>
                    <div
                      className="gut select-none px-1.5 text-right text-[10.5px]"
                      style={{
                        color: isAdd ? 'var(--diff-add-fg)' : isDel ? 'var(--diff-del-fg)' : 'var(--text-3)',
                        background: isAdd ? 'var(--diff-add-mark)' : isDel ? 'var(--diff-del-mark)' : undefined,
                      }}
                    >
                      {sym}
                    </div>
                    <div
                      className="src overflow-x-auto px-2"
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
        </div>
      </div>
    </>
  )
}
