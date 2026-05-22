import type { FocusedBlockMeta, ToolBlock } from '@/lib/types'
import { fmtDuration } from '@/lib/format'
import { CrumbStrip } from './CrumbStrip'
import { SubagentDrill } from './SubagentDrill'

interface InspectorToolProps {
  meta: FocusedBlockMeta
  /**
   * Drill into the subagent this tool spawned (US2 wiring; US7 owns the
   * visible CTA — T084).
   */
  onDrillSubagent?: (block: ToolBlock) => void
}

export function InspectorTool({ meta, onDrillSubagent }: InspectorToolProps) {
  const block = meta.block as ToolBlock
  const { request, turn } = meta
  return (
    <>
      <CrumbStrip
        kind="TOOL_USE"
        parent={`REQUEST ${request.id.slice(0, 8)} › TURN ${turn.id.slice(0, 8)}`}
        title={block.name}
        sub={`${fmtDuration(block.durationMs)} · ${block.status === 'err' ? 'error' : block.status === 'run' ? 'running' : 'ok'}`}
      />
      <div className="ins-body flex-1 overflow-y-auto">
        <div className="ins-tool-section border-b border-[var(--border)] px-[18px] py-3.5">
          <SectionTitle>Input</SectionTitle>
          <pre className="ins-pre mt-2 overflow-auto rounded-sm border border-[var(--border-1)] bg-[var(--surface-0)] p-3 font-mono text-[11px] leading-[1.55] whitespace-pre-wrap break-words text-[var(--text-1)]" style={{ maxHeight: 280 }}>
            {fmtJson(block.input)}
          </pre>
        </div>
        <div className="ins-tool-section border-b border-[var(--border)] px-[18px] py-3.5">
          <SectionTitle>Output</SectionTitle>
          <pre
            className="ins-pre mt-2 overflow-auto rounded-sm border bg-[var(--surface-0)] p-3 font-mono text-[11px] leading-[1.55] whitespace-pre-wrap break-words"
            style={{
              maxHeight: 280,
              borderColor: block.status === 'err' ? 'oklch(0.7 0.18 25 / 0.3)' : 'var(--border-1)',
              color: block.status === 'err' ? 'var(--diff-del-fg)' : 'var(--text-1)',
            }}
          >
            {block.output ?? <span className="italic text-[var(--text-3)]">(no output captured)</span>}
          </pre>
        </div>
        {block.isSubagent && (
          <div className="ins-tool-section px-[18px] py-3.5">
            <SubagentDrill
              metrics={block.subagentMetrics}
              model={request.model}
              onClick={() => onDrillSubagent?.(block)}
            />
          </div>
        )}
      </div>
    </>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="ins-section-title flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase text-[var(--text-3)]"
      style={{ letterSpacing: '0.07em' }}
    >
      {children}
    </div>
  )
}

function fmtJson(v: unknown): string {
  try {
    return JSON.stringify(v, null, 2)
  } catch {
    return String(v)
  }
}
