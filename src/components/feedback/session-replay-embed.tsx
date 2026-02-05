'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Play,
  Loader2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  MousePointer2,
  Globe,
  AlertTriangle,
  Clock,
  RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'

interface SessionEvent {
  event: string
  timestamp: string
  properties: Record<string, unknown>
}

interface SessionReplayEmbedProps {
  sessionId: string | null
  /** Whether to show the embed expanded by default */
  defaultExpanded?: boolean
}

const PROJECT_ID = '306226'

/**
 * Embedded PostHog session replay viewer with events inspector
 *
 * Features:
 * - Embedded replay iframe (auto-enables sharing via PostHog API)
 * - Events timeline showing user actions
 * - Link to full PostHog view
 */
export function SessionReplayEmbed({ sessionId, defaultExpanded = false }: SessionReplayEmbedProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [events, setEvents] = useState<SessionEvent[]>([])
  const [loadingEvents, setLoadingEvents] = useState(false)
  const [eventsError, setEventsError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'replay' | 'events'>('replay')

  // Embed state
  const [embedUrl, setEmbedUrl] = useState<string | null>(null)
  const [loadingEmbed, setLoadingEmbed] = useState(false)
  const [embedError, setEmbedError] = useState<string | null>(null)

  const posthogUrl = sessionId
    ? `https://us.posthog.com/project/${PROJECT_ID}/replay/${sessionId}`
    : null

  // Fetch embed URL by enabling sharing via our API
  const fetchEmbedUrl = useCallback(async () => {
    if (!sessionId || embedUrl) return

    setLoadingEmbed(true)
    setEmbedError(null)

    try {
      const res = await fetch('/api/posthog/share-recording', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      })

      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error?.message || 'Failed to enable sharing')
      }

      const json = await res.json()
      setEmbedUrl(json.data?.embedUrl || null)
    } catch (error) {
      console.error('Failed to get embed URL:', error)
      setEmbedError(error instanceof Error ? error.message : 'Failed to load replay')
    } finally {
      setLoadingEmbed(false)
    }
  }, [sessionId, embedUrl])

  const fetchEvents = useCallback(async () => {
    if (!sessionId) return

    setLoadingEvents(true)
    setEventsError(null)

    try {
      const res = await fetch(`/api/posthog/session-events?sessionId=${sessionId}`)

      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error?.message || 'Failed to fetch events')
      }

      const json = await res.json()
      setEvents(json.data?.events || [])
    } catch (error) {
      console.error('Failed to fetch session events:', error)
      setEventsError(error instanceof Error ? error.message : 'Failed to load events')
    } finally {
      setLoadingEvents(false)
    }
  }, [sessionId])

  // Fetch embed URL when expanded and replay tab is active
  useEffect(() => {
    if (expanded && activeTab === 'replay' && !embedUrl && !loadingEmbed) {
      fetchEmbedUrl()
    }
  }, [expanded, activeTab, embedUrl, loadingEmbed, fetchEmbedUrl])

  // Fetch events when expanded and events tab is active
  useEffect(() => {
    if (expanded && activeTab === 'events' && events.length === 0 && !loadingEvents) {
      fetchEvents()
    }
  }, [expanded, activeTab, events.length, loadingEvents, fetchEvents])

  if (!sessionId) return null

  const getEventIcon = (eventName: string) => {
    if (eventName.includes('click') || eventName.includes('tap')) {
      return <MousePointer2 className="h-3 w-3" />
    }
    if (eventName.includes('pageview') || eventName.includes('page')) {
      return <Globe className="h-3 w-3" />
    }
    if (eventName.includes('error') || eventName.includes('exception')) {
      return <AlertTriangle className="h-3 w-3 text-red-500" />
    }
    return <Clock className="h-3 w-3" />
  }

  const formatEventName = (event: string) => {
    return event
      .replace('$', '')
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  return (
    <div className="rounded-lg border bg-card">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Play className="h-4 w-4 text-purple-500" />
          <span className="text-sm font-medium">Session Replay</span>
          <Badge variant="secondary" className="text-[10px]">
            PostHog
          </Badge>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {/* Expanded Content */}
      {expanded && (
        <div className="border-t">
          {/* Tabs */}
          <div className="flex items-center gap-1 p-2 border-b bg-muted/30">
            <button
              onClick={() => setActiveTab('replay')}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                activeTab === 'replay'
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Replay
            </button>
            <button
              onClick={() => setActiveTab('events')}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                activeTab === 'events'
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Events
              {events.length > 0 && (
                <span className="ml-1 text-muted-foreground">({events.length})</span>
              )}
            </button>
            <div className="flex-1" />
            <a
              href={posthogUrl || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              Open in PostHog
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          {/* Tab Content */}
          {activeTab === 'replay' && (
            <div className="relative">
              {loadingEmbed ? (
                <div className="aspect-video flex items-center justify-center bg-muted/20">
                  <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-purple-500 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Loading replay...</p>
                  </div>
                </div>
              ) : embedError ? (
                <div className="aspect-video flex flex-col items-center justify-center bg-muted/20">
                  <AlertTriangle className="h-8 w-8 text-amber-500 mb-2" />
                  <p className="text-sm text-muted-foreground mb-3">{embedError}</p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEmbedError(null)
                        fetchEmbedUrl()
                      }}
                    >
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Retry
                    </Button>
                    <Button asChild size="sm" className="bg-purple-600 hover:bg-purple-700">
                      <a href={posthogUrl || '#'} target="_blank" rel="noopener noreferrer">
                        Open in PostHog
                        <ExternalLink className="h-3 w-3 ml-1" />
                      </a>
                    </Button>
                  </div>
                </div>
              ) : embedUrl ? (
                <div className="aspect-video">
                  <iframe
                    src={embedUrl}
                    className="w-full h-full border-0"
                    allow="fullscreen"
                    title="PostHog Session Replay"
                  />
                </div>
              ) : (
                <div className="aspect-video flex items-center justify-center bg-muted/20">
                  <div className="text-center">
                    <Play className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                    <p className="text-sm text-muted-foreground">Replay not available</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'events' && (
            <div className="max-h-[300px] overflow-y-auto">
              {loadingEvents ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : eventsError ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <AlertTriangle className="h-6 w-6 text-amber-500 mb-2" />
                  <p className="text-sm text-muted-foreground mb-2">{eventsError}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchEvents}
                    className="h-7 text-xs"
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Retry
                  </Button>
                </div>
              ) : events.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                  <Clock className="h-6 w-6 mb-2 opacity-50" />
                  <p className="text-sm">No events found</p>
                  <p className="text-xs mt-1">Events may take a moment to load</p>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {events.map((event, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 p-3 hover:bg-muted/30 transition-colors"
                    >
                      <div className="h-6 w-6 rounded bg-muted flex items-center justify-center shrink-0">
                        {getEventIcon(event.event)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">
                            {formatEventName(event.event)}
                          </span>
                          {typeof event.properties?.$current_url === 'string' && (
                            <span className="text-xs text-muted-foreground truncate max-w-[150px]">
                              {event.properties.$current_url.replace(/^https?:\/\/[^/]+/, '')}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
