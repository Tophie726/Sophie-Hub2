'use client'

import { useRef, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Table, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SheetTab {
  id: string
  name: string
  rowCount?: number
  columnCount?: number
  isMapped?: boolean
  primaryEntity?: 'partners' | 'staff' | 'asins' | null
}

interface SheetTabBarProps {
  tabs: SheetTab[]
  activeTabId: string | null
  onSelectTab: (tabId: string) => void
}

const easeOut: [number, number, number, number] = [0.22, 1, 0.36, 1]

const entityColors = {
  partners: 'bg-blue-500',
  staff: 'bg-green-500',
  asins: 'bg-orange-500',
}

export function SheetTabBar({
  tabs,
  activeTabId,
  onSelectTab,
}: SheetTabBarProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 })

  // Update active indicator position
  useEffect(() => {
    if (!activeTabId || !containerRef.current) return

    const activeTab = containerRef.current.querySelector(
      `[data-tab-id="${activeTabId}"]`
    ) as HTMLElement

    if (activeTab) {
      setIndicatorStyle({
        left: activeTab.offsetLeft,
        width: activeTab.offsetWidth,
      })
    }
  }, [activeTabId, tabs])

  return (
    <div className="relative bg-muted/20 px-4">
      {/* Tab Container */}
      <div
        ref={containerRef}
        className="flex items-stretch gap-1 overflow-x-auto scrollbar-hide py-2"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId

          return (
            <motion.button
              key={tab.id}
              data-tab-id={tab.id}
              onClick={() => onSelectTab(tab.id)}
              initial={false}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={{ duration: 0.15, ease: easeOut }}
              className={cn(
                'relative flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors',
                isActive
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
              )}
            >
              {/* Entity indicator dot */}
              {tab.primaryEntity && (
                <div className={cn(
                  'h-2 w-2 rounded-full flex-shrink-0',
                  entityColors[tab.primaryEntity]
                )} />
              )}

              {/* Tab icon */}
              {!tab.primaryEntity && (
                <Table className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
              )}

              {/* Tab name */}
              <span className="truncate max-w-[120px]">{tab.name}</span>

              {/* Mapped indicator */}
              {tab.isMapped && (
                <Check className="h-3 w-3 flex-shrink-0 text-green-500" />
              )}
            </motion.button>
          )
        })}
      </div>

      {/* Active Tab Indicator - subtle underline */}
      {activeTabId && (
        <motion.div
          initial={false}
          animate={{
            left: indicatorStyle.left,
            width: indicatorStyle.width,
            opacity: 1,
          }}
          transition={{ duration: 0.2, ease: easeOut }}
          className="absolute bottom-0 h-0.5 bg-primary/50 rounded-full"
        />
      )}
    </div>
  )
}
