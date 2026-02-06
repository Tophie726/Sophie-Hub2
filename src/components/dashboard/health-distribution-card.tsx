'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, Loader2, Settings } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { useHealthDistributionQuery } from '@/lib/hooks/use-stats-query'

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

const BUCKET_HOVER_COLORS: Record<string, string> = {
  healthy: 'hover:bg-green-600',
  onboarding: 'hover:bg-blue-600',
  warning: 'hover:bg-amber-600',
  paused: 'hover:bg-gray-500',
  offboarding: 'hover:bg-orange-600',
  churned: 'hover:bg-red-600',
  unknown: 'hover:bg-purple-600',
  'no-data': 'hover:bg-gray-700',
}

export function HealthDistributionCard() {
  const router = useRouter()
  const { data, isLoading } = useHealthDistributionQuery()
  const [hoveredBucket, setHoveredBucket] = useState<string | null>(null)

  const handleBucketClick = (bucketId: string) => {
    // Map bucket to status filter value
    const statusMap: Record<string, string> = {
      healthy: 'active',
      onboarding: 'onboarding',
      warning: 'warning',
      paused: 'paused',
      offboarding: 'offboarding',
      churned: 'churned',
      unknown: 'unknown',
      'no-data': 'no-data',
    }
    const status = statusMap[bucketId] || bucketId
    router.push(`/partners?health=${status}`)
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Partner Health</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!data) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Partner Health</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground py-4">Failed to load health distribution</p>
        </CardContent>
      </Card>
    )
  }

  // Filter out buckets with 0 count for display
  const nonEmptyBuckets = data.buckets.filter(b => b.count > 0)
  const totalWithData = nonEmptyBuckets.reduce((sum, b) => sum + b.count, 0)

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">Partner Health</CardTitle>
          {data.unmappedCount > 0 && (
            <Link
              href="/settings"
              className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-500 hover:text-amber-700 dark:hover:text-amber-400"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              {data.unmappedCount} unmapped
            </Link>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Distribution across {data.total.toLocaleString()} partners
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stacked Bar */}
        <div className="h-8 flex rounded-lg overflow-hidden bg-muted">
          {nonEmptyBuckets.map((bucket) => {
            const percentage = totalWithData > 0 ? (bucket.count / totalWithData) * 100 : 0
            if (percentage < 1) return null // Skip very small segments

            return (
              <motion.button
                key={bucket.id}
                className={cn(
                  'h-full transition-all cursor-pointer relative',
                  BUCKET_BG_COLORS[bucket.id],
                  BUCKET_HOVER_COLORS[bucket.id]
                )}
                style={{ width: `${percentage}%` }}
                onClick={() => handleBucketClick(bucket.id)}
                onMouseEnter={() => setHoveredBucket(bucket.id)}
                onMouseLeave={() => setHoveredBucket(null)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                title={`${bucket.label}: ${bucket.count} partners (${percentage.toFixed(1)}%)`}
              >
                {hoveredBucket === bucket.id && percentage >= 10 && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute inset-0 flex items-center justify-center text-white text-xs font-medium"
                  >
                    {bucket.count}
                  </motion.span>
                )}
              </motion.button>
            )
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {data.buckets
            .filter(b => b.count > 0 || b.id === 'healthy' || b.id === 'churned')
            .map((bucket) => (
              <button
                key={bucket.id}
                onClick={() => handleBucketClick(bucket.id)}
                className={cn(
                  'flex items-center gap-1.5 text-xs transition-opacity',
                  bucket.count === 0 ? 'opacity-40' : 'hover:opacity-80'
                )}
              >
                <div className={cn('w-2.5 h-2.5 rounded-full', BUCKET_BG_COLORS[bucket.id])} />
                <span className="text-muted-foreground">
                  {bucket.label}
                </span>
                <span className="font-medium">{bucket.count}</span>
              </button>
            ))}
        </div>

        {/* Settings Link */}
        <div className="pt-2 border-t border-border">
          <Link
            href="/settings"
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Settings className="h-3 w-3" />
            Manage status mappings
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
