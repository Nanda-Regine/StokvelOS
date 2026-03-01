import { cn } from '@/lib/utils'

interface CardProps {
  children: React.ReactNode
  className?: string
  hover?: boolean
}

interface CardHeaderProps {
  title: string
  action?: React.ReactNode
  subtitle?: string
}

export function Card({ children, className, hover = false }: CardProps) {
  return (
    <div className={cn('card', hover && 'transition-transform hover:-translate-y-0.5', className)}>
      {children}
    </div>
  )
}

export function CardHeader({ title, action, subtitle }: CardHeaderProps) {
  return (
    <div className="card-header">
      <div>
        <span className="card-title">{title}</span>
        {subtitle && (
          <p className="text-xs mt-0.5" style={{ color: '#6b7280' }}>{subtitle}</p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}

export function CardBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('card-body', className)}>{children}</div>
}
