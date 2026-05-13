import { Dialog as DialogPrimitive } from 'radix-ui'
import { cn } from '@/lib/utils'

export interface BottomSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
  className?: string
  /** Accessible label for the sheet container. */
  ariaLabel?: string
}

/**
 * Bottom-edge slide-up sheet for the inspector rail in narrow layouts
 * (Phase 8). Same Radix Dialog backing as SidebarDrawer.
 *
 * The visible drag-handle at the top is a click target (tap to close) — touch
 * drag gestures are out of scope for this phase per `08-narrow-and-polish.md`.
 */
export function BottomSheet({ open, onOpenChange, children, className, ariaLabel = 'Inspector' }: BottomSheetProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-foreground/40 data-[state=closed]:opacity-0 data-[state=open]:opacity-100 transition-opacity duration-200" />
        <DialogPrimitive.Content
          data-cc-bottom-sheet="true"
          aria-label={ariaLabel}
          className={cn(
            'fixed left-0 right-0 bottom-0 z-50 h-[78vh] bg-card border-t border-border-strong rounded-t-xl shadow-lg outline-none flex flex-col',
            'data-[state=closed]:translate-y-full data-[state=open]:translate-y-0 transition-transform duration-[260ms] ease-out',
            className,
          )}
        >
          <DialogPrimitive.Title className="sr-only">{ariaLabel}</DialogPrimitive.Title>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close inspector sheet"
            className="flex-shrink-0 py-2.5 flex justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
          >
            <span aria-hidden="true" className="block w-10 h-1 rounded-full bg-border-strong" />
          </button>
          <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
