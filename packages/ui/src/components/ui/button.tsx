import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-1 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'bg-[var(--surface-2)] text-[var(--text-0)] border border-[var(--border-1)] hover:bg-[var(--surface-3)] hover:border-[var(--border-2)]',
        primary:
          'bg-[var(--accent)] text-white hover:bg-[var(--accent-2)]',
        ghost:
          'text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text-0)]',
        icon:
          'text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text-0)] hover:border-[var(--border-1)] border border-transparent',
      },
      size: {
        default: 'h-7 px-3 text-xs',
        sm: 'h-6 px-2 text-[11px]',
        icon: 'h-7 w-7',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...rest }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp className={cn(buttonVariants({ variant, size }), className)} ref={ref} {...rest} />
    )
  },
)
Button.displayName = 'Button'

export { buttonVariants }
