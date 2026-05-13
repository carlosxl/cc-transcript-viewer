import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, act } from '@testing-library/react'

// Mock the rail's child surfaces — RightRail's job is just dispatching to the
// right one based on selection / focus state.
vi.mock('./Inspector', () => ({
  Inspector: () => <div data-testid="inspector-mock">inspector</div>,
}))
vi.mock('./MessageInspector', () => ({
  MessageInspector: () => <div data-testid="message-inspector-mock">message-inspector</div>,
}))
vi.mock('./InspectorEmpty', () => ({
  InspectorEmpty: () => <div data-testid="inspector-empty-mock">empty</div>,
}))

// Stub the focused-turn hook so the rail's branch logic is exercised without
// dragging react-query / session caches into this test.
const useFocusedTurnMock = vi.fn<() => { turn: { uuid: string; role: 'user' | 'assistant' } } | null>()
vi.mock('@/hooks/useFocusedTurn', () => ({
  useFocusedTurn: () => useFocusedTurnMock(),
}))

import { RightRail } from './RightRail'
import { useNavigationStore } from '@/stores/useNavigationStore'

beforeEach(() => {
  useNavigationStore.setState({
    drillStack: [],
    focusedMsgIndex: -1,
    selectedInteractionId: null,
  })
  useFocusedTurnMock.mockReset()
  useFocusedTurnMock.mockReturnValue(null)
})

afterEach(cleanup)

describe('RightRail — priority chain', () => {
  it('renders no tab strip when nothing is selected and no row is focused', () => {
    render(<RightRail />)
    expect(screen.queryByRole('tablist')).toBeNull()
    expect(screen.queryByRole('tab')).toBeNull()
    expect(screen.getByTestId('inspector-empty-mock')).toBeInTheDocument()
  })

  it('renders the tool Inspector when a tool/diff is selected (drill-in wins)', () => {
    act(() => {
      useNavigationStore.setState({ selectedInteractionId: 't1:tu1' })
    })
    useFocusedTurnMock.mockReturnValue({ turn: { uuid: 'aaaa', role: 'assistant' } })
    render(<RightRail />)
    expect(screen.getByTestId('inspector-mock')).toBeInTheDocument()
    expect(screen.queryByTestId('message-inspector-mock')).toBeNull()
    expect(screen.queryByRole('tablist')).toBeNull()
  })

  it('renders the MessageInspector when a turn is focused and no drill-in is active', () => {
    useFocusedTurnMock.mockReturnValue({ turn: { uuid: 'aaaa', role: 'assistant' } })
    render(<RightRail />)
    expect(screen.getByTestId('message-inspector-mock')).toBeInTheDocument()
    expect(screen.queryByTestId('inspector-mock')).toBeNull()
    expect(screen.queryByRole('tablist')).toBeNull()
  })
})
