'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface BucketData {
  id: string
  label: string
  color: string
  count: number
}

interface DistributionData {
  buckets: BucketData[]
  total: number
}

const BUCKET_BG_COLORS: Record<string, string> = {
  healthy: 'bg-green-500',
  onboarding: 'bg-blue-500',
  warning: 'bg-amber-500',
  paused: 'bg-gray-400',
  offboarding: 'bg-orange-500',
  churned: 'bg-red-500',
  unknown: 'bg-purple-500',
  'no-data': 'bg-gray-600',
}

interface HealthBarCompactProps {
  onBucketClick?: (bucketId: string) => void
}

export function HealthBarCompact({ onBucketClick }: HealthBarCompactProps) {
  const router = useRouter()
  const [data, setData] = useState<DistributionData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch('/api/stats/health-distribution')
      if (response.ok) {
        const json = await response.json()
        setData(json.data || json)
      }
    } catch (error) {
      console.error('Failed to fetch health distribution:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleBucketClick = (bucketId: string) => {
    if (onBucketClick) {
      onBucketClick(bucketId)
    } else {
      // Default: navigate to partners with health filter
      const statusMap: Record<string, string> = {
        healthy: 'active',
        onboarding: 'onboarding',
        warning: 'at_risk',
        paused: 'paused',
        offboarding: 'offboarding',
        churned: 'churned',
      }
      const status = statusMap[bucketId]
      if (status) {
        router.push(`/partners?status=${status}`)
      }
    }
  }

  // Don't show anything while loading - avoids redundant spinner
  if (isLoading) {
    return null
  }

  if (!data) return null

  // Filter out buckets with 0 count
  const nonEmptyBuckets = data.buckets.filter(b => b.count > 0)
  const totalWithData = nonEmptyBuckets.reduce((sum, b) => sum + b.count, 0)

  if (totalWithData === 0) return null

  return (
    <TooltipProvider delayDuration={100}>
      <div className="flex items-center gap-3">
        {/* Compact stacked bar */}
        <div className="h-6 w-40 flex rounded-md overflow-hidden bg-muted/50">
          {nonEmptyBuckets.map((bucket) => {
            const percentage = totalWithData > 0 ? (bucket.count / totalWithData) * 100 : 0
            if (percentage < 2) return null // Skip very small segments

            return (
              <Tooltip key={bucket.id}>
                <TooltipTrigger asChild>
                  <button
                    className={cn(
                      'h-full transition-all hover:opacity-80',
                      BUCKET_BG_COLORS[bucket.id]
                    )}
                    style={{ width: `${percentage}%` }}
                    onClick={() => handleBucketClick(bucket.id)}
                  />
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  <span className="font-medium">{bucket.label}</span>: {bucket.count} partners ({percentage.toFixed(0)}%)
                </TooltipContent>
              </Tooltip>
            )
          })}
        </div>

        {/* Mini legend - just the key buckets */}
        <div className="hidden lg:flex items-center gap-2 text-xs text-muted-foreground">
          {data.buckets
            .filter(b => ['healthy', 'warning', 'churned'].includes(b.id) && b.count > 0)
            .map((bucket) => (
              <button
                key={bucket.id}
                onClick={() => handleBucketClick(bucket.id)}
                className="flex items-center gap-1 hover:text-foreground transition-colors"
              >
                <div className={cn('w-2 h-2 rounded-full', BUCKET_BG_COLORS[bucket.id])} />
                <span>{bucket.count}</span>
              </button>
            ))}
        </div>
      </div>
    </TooltipProvider>
  )
}
