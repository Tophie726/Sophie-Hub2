'use client'

import { cn } from '@/lib/utils'
import type { TextWidgetProps } from '@/lib/reporting/types'

export function TextWidget({ config, title }: TextWidgetProps) {
  const alignment = config.alignment || 'left'

  return (
    <div
      className={cn(
        'p-4 md:p-6 h-full antialiased',
        alignment === 'center' && 'text-center',
        alignment === 'right' && 'text-right',
      )}
    >
      {title && (
        <p className="text-sm font-medium text-foreground mb-2 text-wrap-balance">
          {title}
        </p>
      )}
      <div className="text-sm text-muted-foreground whitespace-pre-wrap">
        {config.content}
      </div>
    </div>
  )
}
