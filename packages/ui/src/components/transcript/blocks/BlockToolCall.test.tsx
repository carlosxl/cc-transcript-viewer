import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BlockToolCall } from './BlockToolCall'
import type { ToolBlock } from '@/lib/types'

function makeBlock(overrides: Partial<ToolBlock>): ToolBlock {
  return {
    kind: 'tool_use',
    toolUseId: 'tu-1',
    name: 'Agent',
    input: {},
    status: 'ok',
    durationMs: null,
    isSubagent: false,
    ...overrides,
  }
}

describe('BlockToolCall', () => {
  it('renders a worktree pill when Agent.input.isolation === "worktree"', () => {
    const block = makeBlock({ input: { isolation: 'worktree' } })
    render(<BlockToolCall block={block} focused={false} onClick={() => {}} />)
    expect(screen.getByText('worktree')).toBeTruthy()
  })

  it('omits the worktree pill when isolation is absent', () => {
    const block = makeBlock({ input: { description: 'something' } })
    render(<BlockToolCall block={block} focused={false} onClick={() => {}} />)
    expect(screen.queryByText('worktree')).toBeNull()
  })

  it('omits the worktree pill for non-Agent tools even with isolation set', () => {
    const block = makeBlock({ name: 'Bash', input: { isolation: 'worktree' } })
    render(<BlockToolCall block={block} focused={false} onClick={() => {}} />)
    expect(screen.queryByText('worktree')).toBeNull()
  })

  it('renders a retry pill when retryOf is set', () => {
    const block = makeBlock({ name: 'Read', retryOf: 'prev-tu' })
    render(<BlockToolCall block={block} focused={false} onClick={() => {}} />)
    expect(screen.getByText('↻ retry')).toBeTruthy()
  })

  it('renders the ExitPlanMode plan as markdown beneath the call line', () => {
    const block = makeBlock({
      name: 'ExitPlanMode',
      input: { plan: '# My plan\n\n- step one\n- step two' },
    })
    const { container } = render(<BlockToolCall block={block} focused={false} onClick={() => {}} />)
    // Heading + list items rendered → user can actually read the plan.
    expect(screen.getByRole('heading', { name: 'My plan' })).toBeTruthy()
    expect(screen.getByText('step one')).toBeTruthy()
    expect(screen.getByText('step two')).toBeTruthy()
    expect(container.querySelector('.va-plan-body')).toBeTruthy()
  })

  it('omits the plan body for non-ExitPlanMode tools', () => {
    const block = makeBlock({ name: 'Bash', input: { command: 'echo hi', plan: 'not the plan' } })
    const { container } = render(<BlockToolCall block={block} focused={false} onClick={() => {}} />)
    expect(container.querySelector('.va-plan-body')).toBeNull()
  })
})
