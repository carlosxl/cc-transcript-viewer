import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BottomSheet } from './BottomSheet'

afterEach(() => cleanup())

describe('BottomSheet', () => {
  it('renders children when open', () => {
    render(
      <BottomSheet open onOpenChange={() => {}}>
        <div>Sheet body</div>
      </BottomSheet>,
    )
    expect(screen.getByText('Sheet body')).toBeInTheDocument()
  })

  it('does not render children when closed', () => {
    render(
      <BottomSheet open={false} onOpenChange={() => {}}>
        <div>Sheet body</div>
      </BottomSheet>,
    )
    expect(screen.queryByText('Sheet body')).toBeNull()
  })

  it('drag-handle button closes the sheet', async () => {
    const onOpenChange = vi.fn()
    const user = userEvent.setup()
    render(
      <BottomSheet open onOpenChange={onOpenChange}>
        <div>x</div>
      </BottomSheet>,
    )
    await user.click(screen.getByRole('button', { name: /close inspector sheet/i }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('Escape closes the sheet', async () => {
    const onOpenChange = vi.fn()
    const user = userEvent.setup()
    render(
      <BottomSheet open onOpenChange={onOpenChange}>
        <div>x</div>
      </BottomSheet>,
    )
    await user.keyboard('{Escape}')
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
