'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ArrowRight, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PortfolioCardProps {
  moduleSlug: string
}

export function PortfolioCard({ moduleSlug }: PortfolioCardProps) {
  if (moduleSlug !== 'amazon-reporting') return null
  return <PortfolioCardInner moduleSlug={moduleSlug} />
}

function PortfolioCardInner({ moduleSlug }: { moduleSlug: string }) {
  const [brandCount, setBrandCount] = useState<number | null>(null)

  const fetchMappings = useCallback(async () => {
    try {
      const res = await fetch('/api/bigquery/partner-mappings')
      if (!res.ok) return
      const json = await res.json()
      setBrandCount(json.data?.count ?? 0)
    } catch {
      // Silent fail
    }
  }, [])

  useEffect(() => {
    fetchMappings()
  }, [fetchMappings])

  return (
    <Link
      href={`/admin/modules/${moduleSlug}/portfolio`}
      className={cn(
        'flex items-center justify-between rounded-lg px-4 py-3 transition-colors',
        'hover:bg-muted/40 active:scale-[0.997]',
        'group',
      )}
      style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.08)' }}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted shrink-0">
          <Users className="h-4 w-4 text-muted-foreground" />
        </div>
        <div>
          <span className="text-sm font-medium text-foreground">
            Portfolio Overview
          </span>
          <p className="text-xs text-muted-foreground">
            {brandCount !== null ? (
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                {brandCount} connected brand{brandCount !== 1 ? 's' : ''}
              </span>
            ) : (
              'All connected brands'
            )}
          </p>
        </div>
      </div>

      <span className="flex items-center gap-1 text-xs text-muted-foreground group-hover:text-foreground transition-colors shrink-0">
        View
        <ArrowRight className="h-3 w-3" />
      </span>
    </Link>
  )
}
