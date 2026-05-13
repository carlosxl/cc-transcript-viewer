import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { CommandBlock } from './CommandBlock'
import type { Turn } from '@cc-viewer/shared'

afterEach(cleanup)

function turnWith(text: string): Turn {
  return {
    uuid: 't', parentUuid: null, timestamp: '2026-05-09T17:29:42Z',
    role: 'user', textBlocks: [text], thinkingBlocks: [],
    toolUses: [], toolResults: [], isMeta: false, agentId: null,
  }
}

describe('CommandBlock', () => {
  it('renders the command name in primary color', () => {
    render(<CommandBlock turn={turnWith('<command-name>/clear</command-name>')} />)
    expect(screen.getByText('/clear')).toBeInTheDocument()
  })

  it('renders args when present', () => {
    render(<CommandBlock turn={turnWith(
      '<command-name>/sec</command-name><command-args>master branch</command-args>'
    )} />)
    expect(screen.getByText('/sec')).toBeInTheDocument()
    expect(screen.getByText('master branch')).toBeInTheDocument()
  })

  it('renders nothing for non-command text', () => {
    const { container } = render(<CommandBlock turn={turnWith('plain prose')} />)
    expect(container.textContent).toBe('')
  })
})
