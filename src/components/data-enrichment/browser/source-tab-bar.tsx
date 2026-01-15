'use client'

import { useRef, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, FileSpreadsheet, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface DataSource {
  id: string
  name: string
  tabCount: number
}

interface SourceTabBarProps {
  sources: DataSource[]
  activeSourceId: string | null
  onSelectSource: (sourceId: string) => void
  onAddSource: () => void
  onCloseSource?: (sourceId: string) => void
}

const easeOut: [number, number, number, number] = [0.22, 1, 0.36, 1]

export function SourceTabBar({
  sources,
  activeSourceId,
  onSelectSource,
  onAddSource,
  onCloseSource,
}: SourceTabBarProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 })

  // Update active indicator position
  useEffect(() => {
    if (!activeSourceId || !containerRef.current) return

    const activeTab = containerRef.current.querySelector(
      `[data-source-id="${activeSourceId}"]`
    ) as HTMLElement

    if (activeTab) {
      setIndicatorStyle({
        left: activeTab.offsetLeft,
        width: activeTab.offsetWidth,
      })
    }
  }, [activeSourceId, sources])

  return (
    <div className="relative border-b bg-muted/30">
      {/* Tab Container */}
      <div
        ref={containerRef}
        className="flex items-stretch overflow-x-auto scrollbar-hide"
      >
        {sources.map((source) => {
          const isActive = source.id === activeSourceId

          return (
            <motion.button
              key={source.id}
              data-source-id={source.id}
              onClick={() => onSelectSource(source.id)}
              initial={false}
              whileHover={{ backgroundColor: 'rgba(0,0,0,0.02)' }}
              className={cn(
                'relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors',
                'border-r border-border/50 min-w-[140px] max-w-[200px]',
                isActive
                  ? 'text-foreground bg-background'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <FileSpreadsheet className={cn(
                'h-4 w-4 flex-shrink-0',
                isActive ? 'text-green-600' : 'text-muted-foreground'
              )} />
              <span className="truncate flex-1 text-left">{source.name}</span>

              {/* Tab count badge */}
              <span className={cn(
                'flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded-full',
                isActive
                  ? 'bg-green-500/10 text-green-600'
                  : 'bg-muted text-muted-foreground'
              )}>
                {source.tabCount}
              </span>

              {/* Close button (optional) */}
              {onCloseSource && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onCloseSource(source.id)
                  }}
                  className="flex-shrink-0 p-0.5 rounded hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </motion.button>
          )
        })}

        {/* Add Source Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onAddSource}
          className="h-auto px-4 py-3 rounded-none border-r border-border/50 text-muted-foreground hover:text-foreground"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Active Tab Indicator */}
      {activeSourceId && (
        <motion.div
          layoutId="activeSourceIndicator"
          initial={false}
          animate={{
            left: indicatorStyle.left,
            width: indicatorStyle.width,
          }}
          transition={{ duration: 0.2, ease: easeOut }}
          className="absolute bottom-0 h-0.5 bg-green-500"
        />
      )}
    </div>
  )
}
