import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'

// Mock the tab children — RightRail's job is tab routing, not panel behavior.
vi.mock('./Inspector', () => ({
  Inspector: () => <div data-testid="inspector-mock">inspector</div>,
}))
vi.mock('./tabs/TokensPanel', () => ({
  TokensPanel: () => <div data-testid="tokens-mock">tokens</div>,
}))
vi.mock('./tabs/FilesPanel', () => ({
  FilesPanel: () => <div data-testid="files-mock">files</div>,
}))

import { RightRail } from './RightRail'
import { useNavigationStore } from '@/stores/useNavigationStore'

beforeEach(() => {
  useNavigationStore.setState({
    drillStack: [],
    focusedMsgIndex: 0,
    selectedInteractionId: null,
  })
})

afterEach(cleanup)

describe('RightRail', () => {
  it('renders the three tab buttons', () => {
    render(<RightRail />)
    expect(screen.getByRole('tab', { name: /Inspector/ })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Tokens/ })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Files/ })).toBeInTheDocument()
  })

  it('defaults to the Inspector tab', () => {
    render(<RightRail />)
    expect(screen.getByTestId('inspector-mock')).toBeInTheDocument()
  })

  it('switches to Tokens panel when clicked', () => {
    render(<RightRail />)
    fireEvent.click(screen.getByRole('tab', { name: /Tokens/ }))
    expect(screen.getByTestId('tokens-mock')).toBeInTheDocument()
  })

  it('switches to Files panel when clicked', () => {
    render(<RightRail />)
    fireEvent.click(screen.getByRole('tab', { name: /Files/ }))
    expect(screen.getByTestId('files-mock')).toBeInTheDocument()
  })

  it('selecting an interaction forces switch to Inspector', () => {
    render(<RightRail />)
    fireEvent.click(screen.getByRole('tab', { name: /Tokens/ }))
    expect(screen.queryByTestId('inspector-mock')).not.toBeInTheDocument()
    act(() => {
      useNavigationStore.setState({ selectedInteractionId: 't1:tu1' })
    })
    expect(screen.getByTestId('inspector-mock')).toBeInTheDocument()
  })
})
