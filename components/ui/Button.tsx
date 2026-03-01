import { cn } from '@/lib/utils'
import { forwardRef } from 'react'

type Variant = 'primary' | 'gold' | 'outline' | 'ghost' | 'danger'
type Size    = 'sm' | 'md' | 'lg'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
}

const variantClasses: Record<Variant, string> = {
  primary: 'btn-primary',
  gold:    'btn-gold',
  outline: 'btn-outline',
  ghost:   'btn-ghost',
  danger:  'btn-danger',
}

const sizeClasses: Record<Size, string> = {
  sm: 'btn-sm',
  md: 'btn-md',
  lg: 'btn-lg',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, children, className, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn('btn', variantClasses[variant], sizeClasses[size], className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <span className="flex items-center gap-1.5">
            <span className="ai-dot" />
            <span className="ai-dot" />
            <span className="ai-dot" />
          </span>
        ) : children}
      </button>
    )
  }
)

Button.displayName = 'Button'
