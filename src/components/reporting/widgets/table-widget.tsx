'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { ArrowUp, ArrowDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ShimmerGrid } from '@/components/ui/shimmer-grid'
import { resolveColumnLabel, formatCell } from '@/lib/reporting/formatters'
import type { TableWidgetProps } from '@/lib/reporting/types'
import type { TableQueryResult, SortDirection } from '@/types/modules'

export function TableWidget({ config, dateRange, partnerId, title }: TableWidgetProps) {
  const [data, setData] = useState<TableQueryResult | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sortColumn, setSortColumn] = useState<number | null>(null)
  const [sortDir, setSortDir] = useState<SortDirection>('asc')

  const fetchTable = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/bigquery/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partner_id: partnerId,
          view: config.view,
          metrics: config.columns,
          mode: 'raw',
          sort_by: config.sort_by,
          sort_direction: config.sort_direction,
          limit: config.limit,
          date_range: dateRange,
        }),
      })

      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error?.message || 'Failed to load table')
      }

      const json = await res.json()
      // API returns { data: { mapped, type, data: { headers, rows, total_rows } } }
      setData(json.data?.data || json.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load table')
    } finally {
      setIsLoading(false)
    }
  }, [partnerId, config, dateRange])

  useEffect(() => {
    fetchTable()
  }, [fetchTable])

  // Sort rows client-side when user clicks headers
  const sortedRows = useMemo(() => {
    if (!data?.rows) return []
    if (sortColumn === null) return data.rows

    const sorted = [...data.rows].sort((a, b) => {
      const valA = a[sortColumn] ?? ''
      const valB = b[sortColumn] ?? ''

      // Try numeric comparison first
      const numA = parseFloat(valA)
      const numB = parseFloat(valB)
      if (!isNaN(numA) && !isNaN(numB)) {
        return sortDir === 'asc' ? numA - numB : numB - numA
      }

      // Fallback to string comparison
      const cmp = valA.localeCompare(valB, undefined, { numeric: true })
      return sortDir === 'asc' ? cmp : -cmp
    })

    return sorted
  }, [data?.rows, sortColumn, sortDir])

  function handleHeaderClick(colIndex: number) {
    if (sortColumn === colIndex) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(colIndex)
      setSortDir('asc')
    }
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="p-4 md:p-6">
        {title && (
          <div className="h-4 w-32 rounded bg-gradient-to-r from-muted/40 via-muted/15 to-muted/40 bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite] mb-4" />
        )}
        <div className="overflow-hidden rounded-lg">
          <ShimmerGrid variant="table" rows={5} columns={config.columns?.length || 4} />
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-4 md:p-6 h-full">
        <p className="text-sm text-muted-foreground">{error}</p>
        <button
          onClick={fetchTable}
          className="mt-2 text-xs text-primary hover:underline"
        >
          Retry
        </button>
      </div>
    )
  }

  // Empty state
  if (!data || !data.headers?.length || !data.rows?.length) {
    return (
      <div className="flex flex-col items-center justify-center p-4 md:p-6 h-full">
        <p className="text-sm text-muted-foreground">No data for this date range.</p>
        <p className="text-xs text-muted-foreground/60 mt-1">
          Try expanding the range or adjusting filters.
        </p>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 antialiased">
      {title && (
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-foreground text-wrap-balance">
            {title}
          </p>
          <span
            className="text-xs text-muted-foreground"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {data.total_rows} row{data.total_rows !== 1 ? 's' : ''}
          </span>
        </div>
      )}
      <div
        className="overflow-hidden rounded-lg"
        style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.08)' }}
      >
        <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="bg-card">
                {data.headers.map((header, i) => (
                  <th
                    key={i}
                    onClick={() => handleHeaderClick(i)}
                    className={cn(
                      'text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap cursor-pointer select-none transition-colors hover:text-foreground',
                      'border-b',
                    )}
                  >
                    <span className="inline-flex items-center gap-1">
                      {resolveColumnLabel(config.view, header)}
                      {sortColumn === i && (
                        sortDir === 'asc'
                          ? <ArrowUp className="h-3 w-3" />
                          : <ArrowDown className="h-3 w-3" />
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row, rowIdx) => (
                <tr
                  key={rowIdx}
                  className={cn(
                    'transition-colors hover:bg-muted/40',
                    rowIdx % 2 === 0 && 'bg-muted/[0.15]',
                  )}
                >
                  {row.map((cell, cellIdx) => (
                    <td
                      key={cellIdx}
                      className="px-3 py-2 whitespace-nowrap max-w-[200px] truncate"
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                      title={cell}
                    >
                      {formatCell(cell, data.headers[cellIdx] || '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
