import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SidebarDrawer } from './SidebarDrawer'

afterEach(() => cleanup())

describe('SidebarDrawer', () => {
  it('renders children when open', () => {
    render(
      <SidebarDrawer open onOpenChange={() => {}}>
        <div>Drawer body</div>
      </SidebarDrawer>,
    )
    expect(screen.getByText('Drawer body')).toBeInTheDocument()
  })

  it('does not render children when closed', () => {
    render(
      <SidebarDrawer open={false} onOpenChange={() => {}}>
        <div>Drawer body</div>
      </SidebarDrawer>,
    )
    expect(screen.queryByText('Drawer body')).toBeNull()
  })

  it('calls onOpenChange(false) on Escape', async () => {
    const onOpenChange = vi.fn()
    const user = userEvent.setup()
    render(
      <SidebarDrawer open onOpenChange={onOpenChange}>
        <div>x</div>
      </SidebarDrawer>,
    )
    await user.keyboard('{Escape}')
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('exposes an accessible label', () => {
    render(
      <SidebarDrawer open onOpenChange={() => {}}>
        <div>x</div>
      </SidebarDrawer>,
    )
    expect(screen.getByRole('dialog', { name: /sessions sidebar/i })).toBeInTheDocument()
  })
})
