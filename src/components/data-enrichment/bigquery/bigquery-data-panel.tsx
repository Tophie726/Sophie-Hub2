'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Database,
  Loader2,
  AlertCircle,
  BarChart3,
  ShoppingCart,
  RotateCcw,
  RefreshCw,
  TrendingUp,
  ChevronDown,
  Unlink,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

const easeOut: [number, number, number, number] = [0.22, 1, 0.36, 1]

interface BigQueryDataPanelProps {
  partnerId: string
}

interface ViewConfig {
  id: string
  label: string
  icon: React.ReactNode
  description: string
}

const VIEWS: ViewConfig[] = [
  { id: 'sales', label: 'Sales', icon: <ShoppingCart className="h-3.5 w-3.5" />, description: 'Selling partner sales data' },
  { id: 'sp', label: 'Sponsored Products', icon: <TrendingUp className="h-3.5 w-3.5" />, description: 'SP advertising campaigns' },
  { id: 'sd', label: 'Sponsored Display', icon: <BarChart3 className="h-3.5 w-3.5" />, description: 'SD advertising campaigns' },
  { id: 'refunds', label: 'Refunds', icon: <RotateCcw className="h-3.5 w-3.5" />, description: 'Refund transaction data' },
]

interface PartnerDataResponse {
  mapped: boolean
  clientName: string | null
  view?: string
  rowCount?: number
  headers?: string[]
  rows?: string[][]
  message?: string
}

export function BigQueryDataPanel({ partnerId }: BigQueryDataPanelProps) {
  const [activeView, setActiveView] = useState('sales')
  const [data, setData] = useState<PartnerDataResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAllRows, setShowAllRows] = useState(false)

  const fetchData = useCallback(async (view: string) => {
    setIsLoading(true)
    setError(null)
    setShowAllRows(false)

    try {
      const res = await fetch(`/api/bigquery/partner-data/${partnerId}?view=${view}&limit=50`)
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error?.message || 'Failed to fetch BigQuery data')
      }
      const json = await res.json()
      setData(json.data)
    } catch (err) {
      console.error('BigQuery data fetch error:', err)
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setIsLoading(false)
    }
  }, [partnerId])

  useEffect(() => {
    fetchData(activeView)
  }, [activeView, fetchData])

  // Not mapped state
  if (!isLoading && data && !data.mapped) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Database className="h-4 w-4 text-muted-foreground" />
            BigQuery Data
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center py-6 text-center">
            <Unlink className="h-8 w-8 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">
              This partner is not mapped to a BigQuery client.
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Map this partner in Data Enrichment to see advertising and sales data.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const PREVIEW_ROWS = 10
  const visibleRows = showAllRows ? data?.rows : data?.rows?.slice(0, PREVIEW_ROWS)
  const hasMoreRows = (data?.rows?.length || 0) > PREVIEW_ROWS

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Database className="h-4 w-4 text-muted-foreground" />
            BigQuery Data
            {data?.clientName && (
              <Badge variant="outline" className="text-xs font-normal ml-1">
                {data.clientName}
              </Badge>
            )}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => fetchData(activeView)}
            disabled={isLoading}
            title="Refresh data"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* View selector */}
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
          {VIEWS.map(view => (
            <button
              key={view.id}
              onClick={() => setActiveView(view.id)}
              className={`
                relative flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap
                ${activeView === view.id
                  ? 'text-foreground bg-muted'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }
              `}
            >
              {activeView === view.id && (
                <motion.div
                  layoutId="bqViewIndicator"
                  className="absolute inset-0 bg-muted rounded-md"
                  transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5">
                {view.icon}
                {view.label}
              </span>
            </button>
          ))}
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center gap-2 py-8 justify-center text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading {VIEWS.find(v => v.id === activeView)?.label} data...</span>
          </div>
        )}

        {/* Error state */}
        {error && !isLoading && (
          <div className="flex flex-col items-center py-6 text-center">
            <AlertCircle className="h-6 w-6 text-destructive/60 mb-2" />
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3 h-8"
              onClick={() => fetchData(activeView)}
            >
              Retry
            </Button>
          </div>
        )}

        {/* Data table */}
        {!isLoading && !error && data?.mapped && data.headers && (
          <>
            {data.rows && data.rows.length > 0 ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {data.rowCount} row{data.rowCount !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="border rounded-lg overflow-hidden">
                  <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 z-10">
                        <tr className="bg-muted/80 backdrop-blur-sm">
                          {data.headers.map((header, i) => (
                            <th
                              key={i}
                              className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap border-b"
                            >
                              {formatHeader(header)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {visibleRows?.map((row, rowIdx) => (
                          <tr
                            key={rowIdx}
                            className="hover:bg-muted/30 transition-colors"
                          >
                            {row.map((cell, cellIdx) => (
                              <td
                                key={cellIdx}
                                className="px-3 py-1.5 whitespace-nowrap max-w-[200px] truncate tabular-nums"
                                title={cell}
                              >
                                {formatCell(cell, data.headers?.[cellIdx] || '')}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {/* Show more button */}
                  {hasMoreRows && !showAllRows && (
                    <button
                      onClick={() => setShowAllRows(true)}
                      className="w-full px-3 py-2 text-xs text-muted-foreground hover:bg-muted/50 flex items-center justify-center gap-1.5 transition-colors border-t"
                    >
                      <ChevronDown className="h-3 w-3" />
                      Show all {data.rows?.length} rows
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="py-6 text-center">
                <p className="text-sm text-muted-foreground">
                  No {VIEWS.find(v => v.id === activeView)?.label?.toLowerCase()} data found for this partner.
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Format a BigQuery column header for display
 * e.g., "client_name" -> "Client Name"
 */
function formatHeader(header: string): string {
  return header
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

/**
 * Format a cell value based on the column type
 */
function formatCell(value: string, header: string): string {
  if (!value || value === 'null' || value === 'undefined') return '-'

  const lowerHeader = header.toLowerCase()

  // Currency fields
  if (
    lowerHeader.includes('spend') ||
    lowerHeader.includes('sales') ||
    lowerHeader.includes('cost') ||
    lowerHeader.includes('revenue') ||
    lowerHeader.includes('amount') ||
    lowerHeader.includes('fee')
  ) {
    const num = parseFloat(value)
    if (!isNaN(num)) {
      return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    }
  }

  // Percentage fields
  if (lowerHeader.includes('rate') || lowerHeader.includes('acos') || lowerHeader.includes('roas') || lowerHeader.includes('ctr')) {
    const num = parseFloat(value)
    if (!isNaN(num)) {
      // If already a percentage (> 1), just format it
      if (num > 1) {
        return `${num.toFixed(2)}%`
      }
      // If a decimal (0.05 = 5%), multiply by 100
      return `${(num * 100).toFixed(2)}%`
    }
  }

  // Integer fields
  if (
    lowerHeader.includes('impressions') ||
    lowerHeader.includes('clicks') ||
    lowerHeader.includes('orders') ||
    lowerHeader.includes('units') ||
    lowerHeader.includes('quantity')
  ) {
    const num = parseInt(value, 10)
    if (!isNaN(num)) {
      return num.toLocaleString('en-US')
    }
  }

  return value
}
