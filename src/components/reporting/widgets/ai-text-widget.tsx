'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { RefreshCw } from 'lucide-react'
import { ShimmerBar } from '@/components/ui/shimmer-grid'
import type { AiTextWidgetProps } from '@/lib/reporting/types'

const CACHE_TTL = 5 * 60 * 1000 // 5 minutes
const cache = new Map<string, { text: string; timestamp: number }>()

function buildCacheKey(config: AiTextWidgetProps['config'], partnerId: string, dateRange: AiTextWidgetProps['dateRange']): string {
  return JSON.stringify({
    prompt: config.prompt,
    view: config.view,
    metrics: config.metrics,
    format: config.format,
    partnerId,
    dateRange,
  })
}

function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  let listItems: string[] = []

  function flushList() {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`ul-${elements.length}`} className="list-disc list-inside space-y-1">
          {listItems.map((item, i) => (
            <li key={i}>{renderInline(item)}</li>
          ))}
        </ul>
      )
      listItems = []
    }
  }

  function renderInline(str: string): React.ReactNode {
    // Bold: **text**
    const parts = str.split(/(\*\*[^*]+\*\*)/g)
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>
      }
      return part
    })
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const bulletMatch = line.match(/^[-*]\s+(.+)/)

    if (bulletMatch) {
      listItems.push(bulletMatch[1])
    } else {
      flushList()
      if (line.trim() === '') {
        if (elements.length > 0) {
          elements.push(<div key={`br-${i}`} className="h-2" />)
        }
      } else {
        elements.push(
          <p key={`p-${i}`}>{renderInline(line)}</p>
        )
      }
    }
  }
  flushList()

  return elements
}

export function AiTextWidget({
  config,
  dateRange,
  partnerId,
  title,
  dataMode = 'live',
  refreshTick = 0,
  forceRefreshToken = 0,
}: AiTextWidgetProps) {
  const [text, setText] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const lastForceRefreshRef = useRef(forceRefreshToken)

  const buildSnapshotSummary = useCallback((): string => {
    const focus = config.metrics.slice(0, 3).map((m) => m.replace(/_/g, ' ')).join(', ')
    return [
      `Snapshot mode: sample insight for ${focus || 'selected metrics'}.`,
      '',
      '- CPC trend appears stable with moderate day-to-day variance.',
      '- Conversion efficiency improved in the second half of the selected range.',
      '- Suggested action: validate the top 3 campaigns before scaling budget.',
    ].join('\n')
  }, [config.metrics])

  const fetchSummary = useCallback(async (forceRefresh = false) => {
    setIsLoading(true)
    setError(null)

    if (dataMode === 'snapshot') {
      setText(buildSnapshotSummary())
      setIsLoading(false)
      return
    }

    const cacheKey = buildCacheKey(config, partnerId, dateRange)
    const cached = cache.get(cacheKey)
    if (!forceRefresh && cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setText(cached.text)
      setIsLoading(false)
      return
    }

    // Cancel any in-flight request
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch('/api/bigquery/ai-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: config.prompt,
          view: config.view,
          metrics: config.metrics,
          format: config.format,
          partner_id: partnerId,
          date_range: dateRange,
        }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error?.message || 'Failed to generate summary')
      }

      const json = await res.json()
      const summary = json.data?.summary || ''

      cache.set(cacheKey, { text: summary, timestamp: Date.now() })
      setText(summary)
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      setError(err instanceof Error ? err.message : 'Failed to generate summary')
    } finally {
      setIsLoading(false)
    }
  }, [buildSnapshotSummary, config, dataMode, dateRange, partnerId])

  useEffect(() => {
    fetchSummary()
    return () => { abortRef.current?.abort() }
  }, [fetchSummary, refreshTick])

  useEffect(() => {
    if (forceRefreshToken !== lastForceRefreshRef.current) {
      lastForceRefreshRef.current = forceRefreshToken
      fetchSummary(true)
    }
  }, [forceRefreshToken, fetchSummary])

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 h-full antialiased space-y-3">
        {title && (
          <div className="mb-3">
            <ShimmerBar width={120} height={14} />
          </div>
        )}
        <ShimmerBar width="90%" height={12} />
        <ShimmerBar width="75%" height={12} />
        <ShimmerBar width="85%" height={12} />
        <ShimmerBar width="60%" height={12} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-4 md:p-6 h-full">
        <p className="text-sm text-red-500/80">{error}</p>
        <button
          onClick={() => fetchSummary()}
          className="mt-2 inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
        >
          <RefreshCw className="h-3 w-3" />
          Retry
        </button>
      </div>
    )
  }

  if (!text) {
    return (
      <div className="flex flex-col items-center justify-center p-4 md:p-6 h-full">
        <p className="text-sm text-muted-foreground">No summary available</p>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 h-full antialiased overflow-y-auto">
      {title && (
        <p className="text-sm font-medium text-foreground mb-3 text-wrap-balance">
          {title}
        </p>
      )}
      <div className="text-sm text-muted-foreground leading-relaxed space-y-1.5">
        {renderMarkdown(text)}
      </div>
    </div>
  )
}
