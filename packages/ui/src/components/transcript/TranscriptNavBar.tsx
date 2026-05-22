import { useMemo } from 'react'
import { I } from '@/components/ui/icons'
import type { SessionView, SessionTurn } from '@/lib/types'
import { fmtCost, fmtDuration, shortPreview } from '@/lib/format'
import { useFocus } from '@/stores/useFocus'

interface TranscriptNavBarProps {
  view: SessionView
  onTurnStep: (delta: -1 | 1) => void
  onReqStep: (delta: -1 | 1) => void
  onPromptStep: (delta: -1 | 1) => void
  onToolStep: (delta: -1 | 1) => void
  onOpenJumper?: (anchor: DOMRect) => void
}

export function TranscriptNavBar({
  view,
  onTurnStep,
  onReqStep,
  onPromptStep,
  onToolStep,
  onOpenJumper,
}: TranscriptNavBarProps) {
  const nodeMeta = useFocus((s) => s.nodeMeta)

  const focusedTurn: SessionTurn | undefined = nodeMeta?.turn ?? view.turns[view.turns.length - 1]
  const focusedRequestIdx = nodeMeta?.kind === 'request' ? nodeMeta.idx ?? -1 : -1
  const focusedTurnReqCount = focusedTurn?.requests.length ?? 0
  const focusedCost = useMemo(
    () => (focusedTurn ? focusedTurn.requests.reduce((s, r) => s + r.cost, 0) : 0),
    [focusedTurn],
  )
  const promptPreview = focusedTurn ? shortPreview(focusedTurn.prompt, 90) : ''
  void fmtDuration // reserved for future TTFT chip

  return (
    <div
      className="tx-nav sticky top-0 z-[4] flex items-center gap-2 border-b border-[var(--border)] bg-[var(--surface-1)] px-[22px] py-[7px] font-mono text-[11px]"
    >
      <Stepper title="Turn" onPrev={() => onTurnStep(-1)} onNext={() => onTurnStep(1)}>
        <button
          type="button"
          className="stepper-label flex h-full items-center gap-1 border-x border-[var(--border-1)] bg-transparent px-2 text-[11px] text-[var(--text-1)] hover:bg-[var(--surface-3)] hover:text-[var(--text-0)]"
          style={{ minWidth: 70 }}
          onClick={(e) => onOpenJumper?.(e.currentTarget.getBoundingClientRect())}
        >
          <span className="k mr-0.5 text-[10px] font-medium uppercase text-[var(--text-3)]" style={{ letterSpacing: '0.05em' }}>
            Turn
          </span>
          <span>{focusedTurn ? focusedTurn.id : '—'}</span>
          <span className="muted text-[10px] text-[var(--text-3)]">/{view.turns.length}</span>
        </button>
      </Stepper>

      <Stepper title="Request" onPrev={() => onReqStep(-1)} onNext={() => onReqStep(1)}>
        <StaticLabel k="Req" v={`${focusedRequestIdx >= 0 ? focusedRequestIdx : '—'}/${focusedTurnReqCount || '—'}`} />
      </Stepper>

      <Stepper title="User prompt (skips stderr)" onPrev={() => onPromptStep(-1)} onNext={() => onPromptStep(1)}>
        <StaticLabel k="Prompt" v="n / N" muted />
      </Stepper>

      <Stepper title="Tool call" onPrev={() => onToolStep(-1)} onNext={() => onToolStep(1)}>
        <StaticLabel k="Tool" v="[ ]" muted />
      </Stepper>

      <div className="tx-nav-divider h-4 w-[1px] bg-[var(--border-1)]" />
      <div className="tx-nav-prompt min-w-0 flex-1 truncate text-[12px] text-[var(--text-2)]">
        {focusedTurn ? (
          <span>
            <em className="not-italic text-[var(--text-3)]">"</em>
            {promptPreview}
            <em className="not-italic text-[var(--text-3)]">"</em>
          </span>
        ) : (
          <em className="not-italic text-[var(--text-3)]">No turn focused</em>
        )}
      </div>
      <div className="tx-nav-cost rounded-[3px] border border-[var(--border-1)] bg-[var(--surface-2)] px-[7px] py-[2px] font-mono text-[11px] whitespace-nowrap text-[var(--text-1)]">
        <span className="k mr-0.5 text-[var(--text-3)]">Turn cost</span> {fmtCost(focusedCost)}
      </div>
    </div>
  )
}

function Stepper({
  title,
  children,
  onPrev,
  onNext,
}: {
  title: string
  children: React.ReactNode
  onPrev: () => void
  onNext: () => void
}) {
  return (
    <div
      className="stepper inline-flex h-6 items-stretch overflow-hidden rounded-sm border border-[var(--border-1)] bg-[var(--surface-2)]"
      title={title}
    >
      <StepperBtn onClick={onPrev} aria-label={`prev ${title.toLowerCase()}`}>
        <I.chevronLeft />
      </StepperBtn>
      {children}
      <StepperBtn onClick={onNext} aria-label={`next ${title.toLowerCase()}`}>
        <I.chevronRight />
      </StepperBtn>
    </div>
  )
}

function StepperBtn({ children, onClick, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="stepper-btn inline-flex w-5 items-center justify-center text-[var(--text-2)] transition-colors hover:bg-[var(--surface-3)] hover:text-[var(--text-0)]"
      {...rest}
    >
      {children}
    </button>
  )
}

function StaticLabel({ k, v, muted }: { k: string; v: string; muted?: boolean }) {
  return (
    <span
      className="stepper-label inline-flex h-full items-center gap-1 border-x border-[var(--border-1)] px-2 text-[11px]"
      style={{ minWidth: 70, justifyContent: 'center', color: 'var(--text-1)' }}
    >
      <span className="k mr-0.5 text-[10px] font-medium uppercase text-[var(--text-3)]" style={{ letterSpacing: '0.05em' }}>
        {k}
      </span>
      <span style={{ color: muted ? 'var(--text-2)' : undefined }}>{v}</span>
    </span>
  )
}
