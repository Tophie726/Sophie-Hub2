import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: string
  description?: string
  children?: React.ReactNode
  className?: string
}

export function PageHeader({ title, description, children, className }: PageHeaderProps) {
  return (
    <div
      className={cn('border-b border-border/40 bg-background/95 backdrop-blur sticky top-14 md:top-0 z-30', className)}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 md:px-8 min-h-[3.5rem] py-2 sm:py-0 sm:h-16">
        <div className="min-w-0">
          <h1 className="text-base md:text-lg font-semibold tracking-tight truncate" style={{ WebkitFontSmoothing: 'antialiased' }}>{title}</h1>
          {description && (
            <p className="text-xs md:text-sm text-muted-foreground truncate">{description}</p>
          )}
        </div>
        {children && (
          <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
            {children}
          </div>
        )}
      </div>
    </div>
  )
}
