'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Globe, ArrowRight, Users } from 'lucide-react'
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
        'block rounded-xl p-5 transition-all group',
        'hover:shadow-md active:scale-[0.995]',
        'relative overflow-hidden',
      )}
      style={{
        boxShadow: '0 0 0 1px rgba(0,0,0,0.08)',
        background: 'linear-gradient(135deg, rgba(59,130,246,0.04) 0%, rgba(147,51,234,0.04) 100%)',
      }}
    >
      {/* Accent line at top */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{
          background: 'linear-gradient(90deg, #3b82f6, #9333ea)',
        }}
      />

      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-lg shrink-0"
            style={{
              background: 'linear-gradient(135deg, #3b82f6 0%, #9333ea 100%)',
            }}
          >
            <Globe className="h-4.5 w-4.5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-foreground">
              Amazon Portfolio Overview
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Performance across {brandCount !== null ? (
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {brandCount} connected brand{brandCount !== 1 ? 's' : ''}
                </span>
              ) : (
                'all connected brands'
              )}
            </p>
          </div>
        </div>

        <span className="flex items-center gap-1 text-xs text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-0.5">
          View Dashboard
          <ArrowRight className="h-3 w-3" />
        </span>
      </div>

      {/* Bottom row with brand count chip */}
      {brandCount !== null && brandCount > 0 && (
        <div className="flex items-center gap-2 mt-3 ml-12">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <Users className="h-3 w-3" />
            <span className="text-[11px] font-medium" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {brandCount} brands
            </span>
          </div>
        </div>
      )}
    </Link>
  )
}
