import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { InspectorEmpty } from './InspectorEmpty'

afterEach(cleanup)

describe('InspectorEmpty', () => {
  it('renders the tool-inspector heading and hint', () => {
    render(<InspectorEmpty />)
    expect(screen.getByText('Tool inspector')).toBeInTheDocument()
    expect(screen.getByText(/Click any tool capsule or diff/)).toBeInTheDocument()
  })

  it('renders the hint chips for the canonical tools', () => {
    render(<InspectorEmpty />)
    for (const tool of ['Bash', 'Read', 'Edit', 'Grep']) {
      expect(screen.getByText(tool)).toBeInTheDocument()
    }
  })
})
