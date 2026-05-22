import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ToolBlock, DiffBlock } from '@/lib/types'
import { Inspector } from './Inspector'
import { projectSessionView } from '@/hooks/useSessionView'
import { buildMultiTurnDetail } from '@/test/fixtures'
import { useFocus } from '@/stores/useFocus'

function focusBashTool() {
  const view = projectSessionView(buildMultiTurnDetail(), { id: 's', title: 't', isLive: false })
  const turn = view.turns[0]
  const request = turn.requests[0]
  const blockIdx = request.blocks.findIndex((b) => b.kind === 'tool_use')
  const block = request.blocks[blockIdx] as ToolBlock
  useFocus.getState().setBlock(`${request.id}:b${blockIdx}`, { bid: `${request.id}:b${blockIdx}`, block, request, turn })
}

function focusDiffBlock() {
  const view = projectSessionView(buildMultiTurnDetail(), { id: 's', title: 't', isLive: false })
  const turn = view.turns[2]
  const request = turn.requests[1]
  const blockIdx = request.blocks.findIndex((b) => b.kind === 'diff')
  const block = request.blocks[blockIdx] as DiffBlock
  useFocus.getState().setBlock(`${request.id}:b${blockIdx}`, { bid: `${request.id}:b${blockIdx}`, block, request, turn })
}

function focusRequestNode() {
  const view = projectSessionView(buildMultiTurnDetail(), { id: 's', title: 't', isLive: false })
  const turn = view.turns[0]
  const request = turn.requests[0]
  useFocus.getState().setNode(request.id, { kind: 'request', turn, request, idx: 1, total: 1 })
}

function focusUserPrompt() {
  const view = projectSessionView(buildMultiTurnDetail(), { id: 's', title: 't', isLive: false })
  const turn = view.turns[0]
  useFocus.getState().setNode(turn.userMsgId, { kind: 'user', turn })
}

describe('Inspector', () => {
  beforeEach(() => {
    useFocus.getState().reset()
  })

  it('renders the empty state when nothing is focused', () => {
    render(<Inspector onJumpToBlock={vi.fn()} />)
    expect(screen.getByText(/Click any tool capsule/i)).toBeInTheDocument()
  })

  it('renders the Tool view when a tool_use block is focused', () => {
    focusBashTool()
    render(<Inspector onJumpToBlock={vi.fn()} />)
    expect(screen.getByText('Bash')).toBeInTheDocument()
    expect(screen.getByText('Input')).toBeInTheDocument()
    expect(screen.getByText('Output')).toBeInTheDocument()
  })

  it('renders the Diff view when a diff block is focused', () => {
    focusDiffBlock()
    render(<Inspector onJumpToBlock={vi.fn()} />)
    // Diff inspector shows the file path somewhere in the crumb/header.
    expect(screen.getAllByText(/\/tmp\/a\.ts/).length).toBeGreaterThan(0)
  })

  it('renders the Request view when a request node is focused', () => {
    focusRequestNode()
    render(<Inspector onJumpToBlock={vi.fn()} />)
    expect(screen.getByText(/Blocks in this request/i)).toBeInTheDocument()
  })

  it('renders the User view when a user prompt is focused', () => {
    focusUserPrompt()
    render(<Inspector onJumpToBlock={vi.fn()} />)
    expect(screen.getByText(/do the thing/i)).toBeInTheDocument()
  })
})
