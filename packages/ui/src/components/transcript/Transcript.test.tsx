import { describe, it, expect, beforeEach, vi } from 'vitest'
import { forwardRef, useImperativeHandle, useRef } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import type { SessionView } from '@/lib/types'
import { projectSessionView } from '@/hooks/useSessionView'
import { buildMultiTurnDetail } from '@/test/fixtures'
import { useFocus } from '@/stores/useFocus'
import { useSessionStack } from '@/stores/useSessionStack'
import { useCompact } from '@/stores/useCompact'

// In jsdom, react-virtuoso never measures viewport size and skips rendering its
// items. Mock it to render every row eagerly so we can drive click events.
vi.mock('react-virtuoso', () => {
  const Virtuoso = forwardRef(function MockVirtuoso(
    props: {
      data?: unknown[]
      itemContent: (i: number, row: unknown) => React.ReactNode
      scrollerRef?: (el: HTMLDivElement | null) => void
      computeItemKey?: (i: number, row: unknown) => string | number
    },
    ref,
  ) {
    const rows = props.data ?? []
    useImperativeHandle(ref, () => ({
      scrollToIndex: () => {},
      scrollTo: () => {},
    }))
    return (
      <div
        data-testid="virtuoso-mock"
        ref={(el) => {
          props.scrollerRef?.(el as HTMLDivElement | null)
        }}
      >
        {rows.map((row, i) => (
          <div key={props.computeItemKey?.(i, row) ?? i}>{props.itemContent(i, row)}</div>
        ))}
      </div>
    )
  })
  return { Virtuoso }
})

import { Transcript } from './Transcript'

function Harness({ view }: { view: SessionView }) {
  const bodyRef = useRef<HTMLDivElement | null>(null)
  return <Transcript view={view} livePending={false} bodyRef={bodyRef} />
}

describe('Transcript', () => {
  beforeEach(() => {
    useFocus.getState().reset()
    useSessionStack.setState({ stack: [] })
    // These tests assert on detail-mode markup (tool capsules, diff bodies).
    // Compact mode is the default since it's the more common reading mode.
    useCompact.setState({ compact: false })
    if (!('requestAnimationFrame' in globalThis)) {
      ;(globalThis as { requestAnimationFrame?: typeof requestAnimationFrame }).requestAnimationFrame = (cb) =>
        setTimeout(cb, 0) as unknown as number
    }
  })

  it('renders user prompts, requests, and each tool block kind', () => {
    const view = projectSessionView(buildMultiTurnDetail(), { id: 's', title: 'Demo', isLive: false })
    render(<Harness view={view} />)
    // Session title appears in the header.
    expect(screen.getByText('Demo')).toBeInTheDocument()
    // Each prompt appears at minimum once (user turn node + possibly the nav-bar preview).
    expect(screen.getAllByText('do the thing').length).toBeGreaterThan(0)
    expect(screen.getAllByText('now patch the file').length).toBeGreaterThan(0)
    // Tool capsules: Bash and Agent labels.
    expect(screen.getAllByText('Bash').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Agent').length).toBeGreaterThan(0)
    // Diff block path.
    expect(screen.getAllByText('/tmp/a.ts').length).toBeGreaterThan(0)
  })

  it('clicking a tool capsule sets useFocus.blockId on the matching request:block id', () => {
    const view = projectSessionView(buildMultiTurnDetail(), { id: 's', title: 'Demo', isLive: false })
    render(<Harness view={view} />)
    // First tool_use is Bash on request a-a; bid is a-a:b1 (block 0 is text "ok, running ls").
    const bashLabel = screen.getAllByText('Bash')[0]
    fireEvent.click(bashLabel)
    expect(useFocus.getState().blockId).toBe('a-a:b1')
    expect(useFocus.getState().nodeId).toBe('a-a')
  })

  it('does not crash for an empty SessionView', () => {
    const view: SessionView = {
      id: 'e',
      title: 'Empty',
      model: '',
      isLive: false,
      turns: [],
      rows: [],
    }
    render(<Harness view={view} />)
    expect(screen.getByText('Empty')).toBeInTheDocument()
  })
})

// Silence the unused-import warning under strict TS — vi is used implicitly when extending globals.
void vi
