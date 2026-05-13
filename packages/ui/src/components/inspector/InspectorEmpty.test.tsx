import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { InspectorEmpty } from './InspectorEmpty'

afterEach(cleanup)

describe('InspectorEmpty', () => {
  it('renders the inspector heading and j/k-plus-click hint', () => {
    render(<InspectorEmpty />)
    expect(screen.getByText('Inspector')).toBeInTheDocument()
    // Hint copy spans the j/k <kbd> elements — match the click half.
    expect(screen.getByText(/click any tool capsule or diff/i)).toBeInTheDocument()
  })

  it('renders the hint chips for the canonical tools', () => {
    render(<InspectorEmpty />)
    for (const tool of ['Bash', 'Read', 'Edit', 'Grep']) {
      expect(screen.getByText(tool)).toBeInTheDocument()
    }
  })

  // SC-006 — copy must not reference the removed Tokens/Files rail tabs.
  // The tool-name hint chips Bash/Read/Edit/Grep are excluded from this check.
  it('does not reference the removed rail tabs in user-visible body copy', () => {
    render(<InspectorEmpty />)
    const status = screen.getByRole('status')
    // Strip the hint chips (Bash/Read/Edit/Grep) before scanning the body copy.
    const chipTexts = new Set(['Bash', 'Read', 'Edit', 'Grep'])
    const bodyText = Array.from(status.querySelectorAll('*'))
      .filter((el) => el.children.length === 0 && !chipTexts.has(el.textContent?.trim() ?? ''))
      .map((el) => el.textContent ?? '')
      .join(' ')
    for (const forbidden of ['Tokens', 'Files', 'tabs', 'moved']) {
      expect(bodyText).not.toContain(forbidden)
    }
    // 'tab' is a substring of 'tablist'/'tabs' — assert no standalone reference.
    expect(bodyText).not.toMatch(/\btab\b/i)
  })

  it('uses the spec-mandated aria-label on the status element', () => {
    render(<InspectorEmpty />)
    expect(screen.getByRole('status')).toHaveAttribute(
      'aria-label',
      'Tool inspector — no selection',
    )
  })
})
