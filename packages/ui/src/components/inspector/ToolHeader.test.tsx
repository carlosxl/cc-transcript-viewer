import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import type { ToolInteraction, ToolUse } from '@cc-viewer/shared'
import { ToolHeader } from './ToolHeader'

afterEach(cleanup)

function makeInteraction(over: Partial<ToolInteraction> = {}): ToolInteraction {
  return {
    id: 't1:tu1',
    turnUuid: 't1',
    toolUseId: 'tu1',
    tool: 'Bash',
    resultTurnUuid: 't2',
    status: 'success',
    startedAt: '2026-05-12T00:00:00Z',
    durationMs: 1500,
    diff: null,
    preview: null,
    ...over,
  }
}

const TOOL_USE: ToolUse = {
  id: 'tu1',
  name: 'Bash',
  input: { command: 'echo hi', description: 'say hello' },
}

describe('ToolHeader', () => {
  it('renders the tool name, summary, and duration', () => {
    render(
      <ToolHeader
        interaction={makeInteraction()}
        toolUse={TOOL_USE}
        onJumpBack={() => {}}
        onClose={() => {}}
      />,
    )
    expect(screen.getByText('Bash')).toBeInTheDocument()
    expect(screen.getByText('echo hi')).toBeInTheDocument()
    expect(screen.getByText(/1\.5s/)).toBeInTheDocument()
  })

  it('renders the success status pill', () => {
    render(
      <ToolHeader
        interaction={makeInteraction()}
        toolUse={TOOL_USE}
        onJumpBack={() => {}}
        onClose={() => {}}
      />,
    )
    expect(screen.getByLabelText('Status: Succeeded')).toBeInTheDocument()
  })

  it('renders Failed pill for failures', () => {
    render(
      <ToolHeader
        interaction={makeInteraction({ status: 'fail' })}
        toolUse={TOOL_USE}
        onJumpBack={() => {}}
        onClose={() => {}}
      />,
    )
    expect(screen.getByLabelText('Status: Failed')).toBeInTheDocument()
  })

  it('renders Running pill for running interactions', () => {
    render(
      <ToolHeader
        interaction={makeInteraction({ status: 'running' })}
        toolUse={TOOL_USE}
        onJumpBack={() => {}}
        onClose={() => {}}
      />,
    )
    expect(screen.getByLabelText('Status: Running')).toBeInTheDocument()
  })

  it('calls onJumpBack when Jump back is clicked', () => {
    const onJumpBack = vi.fn()
    render(
      <ToolHeader
        interaction={makeInteraction()}
        toolUse={TOOL_USE}
        onJumpBack={onJumpBack}
        onClose={() => {}}
      />,
    )
    fireEvent.click(screen.getByLabelText('Jump back to message'))
    expect(onJumpBack).toHaveBeenCalledOnce()
  })

  it('calls onClose when Close is clicked', () => {
    const onClose = vi.fn()
    render(
      <ToolHeader
        interaction={makeInteraction()}
        toolUse={TOOL_USE}
        onJumpBack={() => {}}
        onClose={onClose}
      />,
    )
    fireEvent.click(screen.getByLabelText('Close inspector'))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
