import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { DiffBlock } from './DiffBlock'
import { useNavigationStore } from '@/stores/useNavigationStore'
import type { ToolInteraction, ToolUse } from '@cc-viewer/shared'

beforeEach(() => {
  useNavigationStore.setState({
    drillStack: [],
    focusedMsgIndex: 0,
    selectedInteractionId: null,
  })
})

afterEach(cleanup)

function makeInteraction(over: Partial<ToolInteraction> = {}): ToolInteraction {
  return {
    id: 't-1:tu-1',
    turnUuid: 't-1',
    toolUseId: 'tu-1',
    tool: 'Edit',
    resultTurnUuid: 't-2',
    status: 'success',
    startedAt: '2026-05-09T00:00:00Z',
    durationMs: 100,
    diff: { filePath: 'src/foo.ts', added: 1, removed: 1 },
    preview: null,
    ...over,
  }
}

function makeEditUse(): ToolUse {
  return {
    id: 'tu-1',
    name: 'Edit',
    input: { file_path: 'src/foo.ts', old_string: 'const a = 1', new_string: 'const a = 2' },
  }
}

describe('DiffBlock', () => {
  it('renders file path and +N/−N header', () => {
    render(<DiffBlock interaction={makeInteraction()} toolUse={makeEditUse()} />)
    expect(screen.getByText('src/foo.ts')).toBeInTheDocument()
    expect(screen.getByText('+1')).toBeInTheDocument()
    expect(screen.getByText('−1')).toBeInTheDocument()
  })

  it('renders an add row for the new line and an rm row for the old line', () => {
    render(<DiffBlock interaction={makeInteraction()} toolUse={makeEditUse()} />)
    expect(screen.getByText('const a = 1')).toBeInTheDocument()
    expect(screen.getByText('const a = 2')).toBeInTheDocument()
  })

  it('click selects the interaction in the navigation store', () => {
    render(<DiffBlock interaction={makeInteraction()} toolUse={makeEditUse()} />)
    fireEvent.click(screen.getByRole('button'))
    expect(useNavigationStore.getState().selectedInteractionId).toBe('t-1:tu-1')
  })

  it('returns nothing when diff is null', () => {
    const { container } = render(
      <DiffBlock interaction={makeInteraction({ diff: null })} toolUse={makeEditUse()} />,
    )
    expect(container.textContent).toBe('')
  })

  it('Write tool renders all content lines as adds', () => {
    const tu: ToolUse = {
      id: 'tu-1',
      name: 'Write',
      input: { file_path: 'x.md', content: 'line1\nline2' },
    }
    render(
      <DiffBlock
        interaction={makeInteraction({ tool: 'Write', diff: { filePath: 'x.md', added: 2, removed: 0 } })}
        toolUse={tu}
      />,
    )
    expect(screen.getByText('line1')).toBeInTheDocument()
    expect(screen.getByText('line2')).toBeInTheDocument()
  })
})
