import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { ToolResultRow } from './ToolResultRow'
import type { Turn } from '@cc-viewer/shared'

afterEach(cleanup)

function turnWithResult(is_error: boolean): Turn {
  return {
    uuid: 't', parentUuid: null, timestamp: '2026-04-26T00:00:00Z',
    role: 'user', textBlocks: [], thinkingBlocks: [], toolUses: [],
    toolResults: [{ tool_use_id: 'tu-1', content: 'output', is_error: is_error || undefined }],
    isMeta: false, agentId: null,
  }
}

describe('ToolResultRow', () => {
  it('non-error: no destructive border, no AlertCircle', () => {
    const { container } = render(
      <ToolResultRow turn={turnWithResult(false)} toolUseId="tu-1" />
    )
    expect(container.querySelector('[data-error="true"]')).toBeNull()
  })

  it('is_error: renders border-l-destructive AND AlertCircle (D-07 / VIEW-06)', () => {
    const { container } = render(
      <ToolResultRow turn={turnWithResult(true)} toolUseId="tu-1" />
    )
    const block = container.querySelector('[data-error="true"]')
    expect(block).not.toBeNull()
    expect(block!.className).toMatch(/border-l-destructive/)
    expect(container.querySelector('svg.lucide-circle-alert, svg[class*="alert-circle"], svg[class*="circle-alert"]')).not.toBeNull()
  })

  it('renders the result content inline (no expand/collapse)', () => {
    render(<ToolResultRow turn={turnWithResult(false)} toolUseId="tu-1" />)
    expect(screen.getByText('output')).toBeInTheDocument()
  })

  it('renders an "unmatched" badge when unmatched=true', () => {
    render(<ToolResultRow turn={turnWithResult(false)} toolUseId="tu-1" unmatched />)
    expect(screen.getByText(/unmatched/i)).toBeInTheDocument()
  })

  it('omits the unmatched badge by default', () => {
    render(<ToolResultRow turn={turnWithResult(false)} toolUseId="tu-1" />)
    expect(screen.queryByText(/unmatched/i)).toBeNull()
  })
})
