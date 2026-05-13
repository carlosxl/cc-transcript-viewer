import { Dialog as DialogPrimitive } from 'radix-ui'
import { cn } from '@/lib/utils'

export interface SidebarDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
  className?: string
}

/**
 * Left-edge slide-out drawer for the sidebar in narrow layouts (Phase 8).
 * Wraps Radix Dialog so we inherit focus trap, Escape, and overlay-click-close.
 * Visual transitions live in `index.css` under the `[data-cc-drawer-side]`
 * selector so reduced-motion gates apply uniformly.
 */
export function SidebarDrawer({ open, onOpenChange, children, className }: SidebarDrawerProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-foreground/40 data-[state=closed]:opacity-0 data-[state=open]:opacity-100 transition-opacity duration-200" />
        <DialogPrimitive.Content
          data-cc-drawer-side="left"
          aria-label="Sessions sidebar"
          className={cn(
            'fixed left-0 top-0 bottom-0 z-50 w-[min(320px,85vw)] bg-card border-r border-border shadow-lg outline-none',
            'data-[state=closed]:-translate-x-full data-[state=open]:translate-x-0 transition-transform duration-200 ease-out',
            className,
          )}
        >
          <DialogPrimitive.Title className="sr-only">Sessions sidebar</DialogPrimitive.Title>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
