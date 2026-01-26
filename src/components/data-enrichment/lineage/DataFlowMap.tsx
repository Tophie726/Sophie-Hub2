'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Loader2, ArrowLeft, Network } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useFlowData } from './hooks/useFlowData'
import { FlowCanvas } from './FlowCanvas'
import { MobileFlowList } from './MobileFlowList'

const easeOut: [number, number, number, number] = [0.22, 1, 0.36, 1]

interface DataFlowMapProps {
  onBack: () => void
}

/**
 * Main orchestrator for the Data Flow Map.
 * Switches between FlowCanvas (desktop >= 768px) and MobileFlowList (mobile).
 */
export function DataFlowMap({ onBack }: DataFlowMapProps) {
  const { data, isLoading, error, refresh } = useFlowData()
  const [isMobile, setIsMobile] = useState(false)

  // Detect viewport size
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    setIsMobile(mq.matches)

    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <p className="text-muted-foreground">{error}</p>
        <Button variant="outline" onClick={refresh}>
          Try Again
        </Button>
      </div>
    )
  }

  if (!data) return null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: easeOut }}
      className="flex flex-col h-full"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5"
          onClick={onBack}
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Back</span>
        </Button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Network className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <h2 className="font-semibold text-sm truncate">Data Flow Map</h2>
        </div>
        {/* Stats badges */}
        <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
          <span className="tabular-nums">
            {data.stats.mappedFields}/{data.stats.totalFields} fields
          </span>
          <span className="text-border">|</span>
          <span className="tabular-nums">
            {data.stats.totalSources} source{data.stats.totalSources !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {isMobile ? (
          <div className="overflow-y-auto h-full pt-4">
            <MobileFlowList data={data} />
          </div>
        ) : (
          <div className="p-4 h-full">
            <FlowCanvas data={data} />
          </div>
        )}
      </div>
    </motion.div>
  )
}
