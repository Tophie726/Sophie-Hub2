'use client'

import { useState, useEffect, useCallback } from 'react'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Bug,
  Lightbulb,
  HelpCircle,
  Loader2,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ArrowUpRight,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Wand2,
  Wrench,
  ImageIcon,
  LayoutList,
  Kanban,
} from 'lucide-react'
import Link from 'next/link'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FeedbackKanban } from '@/components/feedback/feedback-kanban'
import { AdminComments } from '@/components/feedback/admin-comments'
import { SessionReplayEmbed } from '@/components/feedback/session-replay-embed'

type FeedbackType = 'bug' | 'feature' | 'question'
type FeedbackStatus = 'new' | 'reviewed' | 'in_progress' | 'resolved' | 'wont_fix'

interface FeedbackItem {
  id: string
  type: FeedbackType
  status: FeedbackStatus
  title: string | null
  description: string
  page_url: string | null
  posthog_session_id: string | null
  screenshot_url: string | null
  browser_info: Record<string, unknown> | null
  submitted_by_email: string
  created_at: string
  // AI fields
  ai_summary: string | null
  ai_summary_at: string | null
  ai_analysis: AIAnalysis | null
  ai_analysis_at: string | null
  content_updated_at: string | null
}

const TYPE_CONFIG: Record<FeedbackType, { icon: typeof Bug; label: string; color: string }> = {
  bug: { icon: Bug, label: 'Bug', color: 'text-red-500 bg-red-500/10' },
  feature: { icon: Lightbulb, label: 'Feature', color: 'text-amber-500 bg-amber-500/10' },
  question: { icon: HelpCircle, label: 'Question', color: 'text-blue-500 bg-blue-500/10' },
}

const STATUS_CONFIG: Record<FeedbackStatus, { label: string; color: string }> = {
  new: { label: 'New', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
  reviewed: { label: 'Reviewed', color: 'bg-purple-500/10 text-purple-500 border-purple-500/20' },
  in_progress: { label: 'In Progress', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
  resolved: { label: 'Resolved', color: 'bg-green-500/10 text-green-500 border-green-500/20' },
  wont_fix: { label: "Won't Fix", color: 'bg-muted text-muted-foreground border-muted' },
}

// AI result types
interface AISummary {
  summary: string
}

interface AIAnalysis {
  summary: string
  likelyCause: string
  suggestedFix: string
  affectedFiles: string[]
  confidence: 'low' | 'medium' | 'high'
}

export default function FeedbackAdminPage() {
  const [feedback, setFeedback] = useState<FeedbackItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FeedbackType | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | 'all'>('all')
  const [selectedItem, setSelectedItem] = useState<FeedbackItem | null>(null)
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list')

  // AI state - persisted in localStorage
  const [aiEnabled, setAiEnabled] = useState(false)
  const [summarizing, setSummarizing] = useState<Record<string, boolean>>({})
  const [analyzing, setAnalyzing] = useState<Record<string, boolean>>({})
  const [summaries, setSummaries] = useState<Record<string, AISummary>>({})
  const [analyses, setAnalyses] = useState<Record<string, AIAnalysis>>({})
  const [batchSummarizing, setBatchSummarizing] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Read from localStorage on mount (client-side only)
  useEffect(() => {
    const stored = localStorage.getItem('admin-feedback-ai-enabled')
    if (stored === 'true') {
      setAiEnabled(true)
    }
    setMounted(true)
  }, [])

  // Persist AI toggle to localStorage (only after initial mount)
  useEffect(() => {
    if (mounted) {
      localStorage.setItem('admin-feedback-ai-enabled', aiEnabled.toString())
    }
  }, [aiEnabled, mounted])

  const handleSummarize = async (id: string) => {
    setSummarizing(prev => ({ ...prev, [id]: true }))
    try {
      const res = await fetch('/api/ai/summarize-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedbackId: id }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message || 'Failed')
      setSummaries(prev => ({ ...prev, [id]: { summary: json.data?.summary } }))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to summarize')
    } finally {
      setSummarizing(prev => ({ ...prev, [id]: false }))
    }
  }

  const handleAnalyze = async (id: string, type: FeedbackType) => {
    setAnalyzing(prev => ({ ...prev, [id]: true }))
    try {
      const endpoint = type === 'bug' ? '/api/ai/analyze-bug' : '/api/ai/suggest-implementation'
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedbackId: id }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message || 'Failed')

      if (type === 'bug') {
        setAnalyses(prev => ({ ...prev, [id]: json.data?.analysis }))
      } else {
        // For features, store suggestion as analysis-like format
        const suggestion = json.data?.suggestion
        setAnalyses(prev => ({
          ...prev,
          [id]: {
            summary: suggestion?.summary || '',
            likelyCause: suggestion?.approach || '',
            suggestedFix: suggestion?.steps?.map((s: { step: number; description: string }) =>
              `Step ${s.step}: ${s.description}`
            ).join('\n') || '',
            affectedFiles: [...(suggestion?.filesToCreate || []), ...(suggestion?.filesToModify || [])],
            confidence: suggestion?.complexity === 'low' ? 'high' : suggestion?.complexity === 'high' ? 'low' : 'medium',
          }
        }))
      }
      toast.success('Analysis complete')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to analyze')
    } finally {
      setAnalyzing(prev => ({ ...prev, [id]: false }))
    }
  }

  // Batch AI: Summarize all visible items that don't have summaries
  const handleBatchSummarize = async () => {
    const itemsToSummarize = feedback.filter(item => !summaries[item.id] && !item.ai_summary)
    if (itemsToSummarize.length === 0) {
      toast.info('All items already have AI summaries')
      return
    }

    setBatchSummarizing(true)
    let successCount = 0
    let failCount = 0

    for (const item of itemsToSummarize) {
      try {
        setSummarizing(prev => ({ ...prev, [item.id]: true }))
        const res = await fetch('/api/ai/summarize-feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ feedbackId: item.id }),
        })
        const json = await res.json()
        if (!res.ok) {
          failCount++
          // Check if it's a service unavailable error (no API key)
          if (json.error?.code === 'SERVICE_UNAVAILABLE') {
            toast.error('AI not configured. Add your Anthropic API key to .env.local')
            break
          }
          continue
        }
        setSummaries(prev => ({ ...prev, [item.id]: { summary: json.data?.summary } }))
        successCount++
      } catch {
        failCount++
      } finally {
        setSummarizing(prev => ({ ...prev, [item.id]: false }))
      }
    }

    setBatchSummarizing(false)
    if (successCount > 0) {
      toast.success(`Summarized ${successCount} item${successCount > 1 ? 's' : ''}`)
    }
    if (failCount > 0 && successCount > 0) {
      toast.error(`${failCount} failed`)
    }
  }

  const handleStatusChange = async (id: string, newStatus: FeedbackStatus) => {
    // Optimistically update the UI
    setFeedback(prev => prev.map(item =>
      item.id === id ? { ...item, status: newStatus } : item
    ))

    try {
      const res = await fetch(`/api/feedback/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!res.ok) throw new Error('Failed to update status')
      toast.success('Status updated')
    } catch {
      // Revert on error
      toast.error('Failed to update status')
      fetchFeedback()
    }
  }

  const fetchFeedback = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filter !== 'all') params.set('type', filter)
      if (statusFilter !== 'all') params.set('status', statusFilter)

      const res = await fetch(`/api/feedback?${params}`)
      if (!res.ok) throw new Error('Failed to fetch feedback')
      const json = await res.json()
      const items = json.data?.feedback || []
      setFeedback(items)

      // Initialize AI state from cached data
      const cachedSummaries: Record<string, AISummary> = {}
      const cachedAnalyses: Record<string, AIAnalysis> = {}
      for (const item of items) {
        if (item.ai_summary) {
          cachedSummaries[item.id] = { summary: item.ai_summary }
        }
        if (item.ai_analysis) {
          cachedAnalyses[item.id] = item.ai_analysis
        }
      }
      setSummaries(cachedSummaries)
      setAnalyses(cachedAnalyses)
    } catch (error) {
      console.error('Failed to fetch feedback:', error)
      toast.error('Failed to load feedback')
    } finally {
      setLoading(false)
    }
  }, [filter, statusFilter])

  useEffect(() => {
    fetchFeedback()
  }, [fetchFeedback])

  const counts = {
    total: feedback.length,
    new: feedback.filter(f => f.status === 'new').length,
    bugs: feedback.filter(f => f.type === 'bug').length,
    features: feedback.filter(f => f.type === 'feature').length,
  }

  return (
    <div className="min-h-screen">
      <PageHeader
        title="Feedback Triage"
        description="Admin view for managing and triaging user feedback"
      >
        <div className="flex items-center gap-2 md:gap-4">
          {/* AI Toggle */}
          <div className="flex items-center gap-2 px-2 md:px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20">
            <Sparkles className="h-4 w-4 text-purple-500" />
            <Label htmlFor="ai-toggle" className="text-sm font-medium text-purple-700 dark:text-purple-300 cursor-pointer hidden md:inline">
              AI
            </Label>
            <Switch
              id="ai-toggle"
              checked={aiEnabled}
              onCheckedChange={setAiEnabled}
              className="data-[state=checked]:bg-purple-500"
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            asChild
            className="h-10 md:h-9 hidden md:flex"
          >
            <Link href="/feedback">
              Feedback Center
              <ArrowUpRight className="h-3.5 w-3.5 ml-1.5" />
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchFeedback}
            disabled={loading}
            className="h-10 md:h-9"
          >
            <RefreshCw className={cn('h-4 w-4 md:mr-1.5', loading && 'animate-spin')} />
            <span className="hidden md:inline">Refresh</span>
          </Button>
        </div>
      </PageHeader>

      <div className="p-4 md:p-8 max-w-6xl">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-3 md:gap-4 md:grid-cols-4 mb-6 md:mb-8">
          <StatCard
            icon={AlertCircle}
            label="New"
            value={counts.new}
            color="text-blue-500"
            bgColor="bg-blue-500/10"
          />
          <StatCard
            icon={Bug}
            label="Bugs"
            value={counts.bugs}
            color="text-red-500"
            bgColor="bg-red-500/10"
          />
          <StatCard
            icon={Lightbulb}
            label="Features"
            value={counts.features}
            color="text-amber-500"
            bgColor="bg-amber-500/10"
          />
          <StatCard
            icon={CheckCircle2}
            label="Total"
            value={counts.total}
            color="text-green-500"
            bgColor="bg-green-500/10"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-4 md:mb-6">
          <div className="flex items-center gap-0.5 md:gap-1 bg-muted/50 rounded-lg p-1 overflow-x-auto">
            <FilterTab
              label="All"
              active={filter === 'all'}
              onClick={() => setFilter('all')}
            />
            <FilterTab
              label="Bugs"
              active={filter === 'bug'}
              onClick={() => setFilter('bug')}
              icon={Bug}
            />
            <FilterTab
              label="Features"
              active={filter === 'feature'}
              onClick={() => setFilter('feature')}
              icon={Lightbulb}
            />
            <FilterTab
              label="Questions"
              active={filter === 'question'}
              onClick={() => setFilter('question')}
              icon={HelpCircle}
            />
          </div>

          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as FeedbackStatus | 'all')}
          >
            <SelectTrigger className="w-[120px] md:w-[140px] h-10 md:h-9">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="reviewed">Reviewed</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="wont_fix">Won&apos;t Fix</SelectItem>
            </SelectContent>
          </Select>

          {/* Batch AI Button - context-aware based on filter */}
          {aiEnabled && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleBatchSummarize}
              disabled={batchSummarizing || loading || feedback.length === 0}
              className="h-10 md:h-9 border-purple-500/30 text-purple-600 hover:bg-purple-500/10"
            >
              {batchSummarizing ? (
                <Loader2 className="h-4 w-4 md:mr-1.5 animate-spin" />
              ) : (
                <Wand2 className="h-4 w-4 md:mr-1.5" />
              )}
              <span className="hidden md:inline">
                {batchSummarizing
                  ? 'Processing...'
                  : filter === 'all'
                    ? 'Summarize All'
                    : `Summarize ${filter === 'bug' ? 'Bugs' : filter === 'feature' ? 'Features' : 'Questions'}`
                }
              </span>
            </Button>
          )}

          {/* View Toggle */}
          <div className="flex items-center gap-0.5 bg-muted/50 rounded-lg p-1 ml-auto">
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'p-2 rounded-md transition-colors',
                viewMode === 'list'
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              title="List view"
            >
              <LayoutList className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={cn(
                'p-2 rounded-md transition-colors',
                viewMode === 'kanban'
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              title="Kanban view"
            >
              <Kanban className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Feedback List/Kanban */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : feedback.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                {filter === 'feature' ? (
                  <Lightbulb className="h-8 w-8 text-muted-foreground" />
                ) : filter === 'question' ? (
                  <HelpCircle className="h-8 w-8 text-muted-foreground" />
                ) : (
                  <Bug className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
              <h3 className="text-lg font-medium mb-2">
                {filter === 'feature' ? 'No Feature Requests' :
                 filter === 'question' ? 'No Questions' :
                 filter === 'bug' ? 'No Bugs Reported' :
                 'No Feedback Yet'}
              </h3>
              <p className="text-sm text-muted-foreground text-center max-w-md">
                {filter === 'feature' ? 'Feature requests from users will appear here.' :
                 filter === 'question' ? 'Questions from users will appear here.' :
                 filter === 'bug' ? 'Bug reports from users will appear here.' :
                 'When users submit feedback, it will appear here for review.'}
              </p>
            </CardContent>
          </Card>
        ) : viewMode === 'kanban' ? (
          <FeedbackKanban
            feedback={feedback}
            onView={setSelectedItem}
            onStatusChange={handleStatusChange}
            aiEnabled={aiEnabled}
            summaries={summaries}
            analyses={analyses}
            summarizing={summarizing}
            analyzing={analyzing}
            onSummarize={handleSummarize}
            onAnalyze={handleAnalyze}
          />
        ) : (
          <div className="space-y-3">
            {feedback.map((item) => (
              <FeedbackCard
                key={item.id}
                item={item}
                onView={() => setSelectedItem(item)}
                onStatusChange={(newStatus) => handleStatusChange(item.id, newStatus)}
                aiEnabled={aiEnabled}
                summary={summaries[item.id]}
                analysis={analyses[item.id]}
                isSummarizing={summarizing[item.id]}
                isAnalyzing={analyzing[item.id]}
                onSummarize={() => handleSummarize(item.id)}
                onAnalyze={() => handleAnalyze(item.id, item.type)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Detail Dialog */}
      <FeedbackDetailDialog
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        onRefresh={fetchFeedback}
      />
    </div>
  )
}

function FeedbackCard({
  item,
  onView,
  onStatusChange,
  aiEnabled,
  summary,
  analysis,
  isSummarizing,
  isAnalyzing,
  onSummarize,
  onAnalyze,
}: {
  item: FeedbackItem
  onView: () => void
  onStatusChange: (status: FeedbackStatus) => void
  aiEnabled: boolean
  summary?: AISummary
  analysis?: AIAnalysis
  isSummarizing?: boolean
  isAnalyzing?: boolean
  onSummarize: () => void
  onAnalyze: () => void
}) {
  const typeConfig = TYPE_CONFIG[item.type]
  const Icon = typeConfig.icon
  const [showFullAnalysis, setShowFullAnalysis] = useState(false)
  const [showAIViewLocal, setShowAIViewLocal] = useState(true) // Per-card toggle

  // Check if this card has AI enhancement
  const hasAI = !!summary || !!analysis
  const posthogUrl = item.posthog_session_id
    ? `https://us.posthog.com/replay/${item.posthog_session_id}`
    : null

  // AI view is enabled only if both page-level AND card-level toggles are on
  const showAIView = aiEnabled && showAIViewLocal

  // Title is always the original - truncated if too long
  const displayTitle = item.title || item.description.slice(0, 60) + (item.description.length > 60 ? '...' : '')

  return (
    <Card
      className={cn(
        'hover:shadow-md transition-shadow cursor-pointer',
        hasAI && showAIView && 'ring-1 ring-purple-500/30 bg-purple-500/[0.02]'
      )}
      onClick={onView}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Clickable icon to toggle AI view (per-card) */}
          <button
            onClick={(e) => { e.stopPropagation(); if (hasAI && aiEnabled) setShowAIViewLocal(!showAIViewLocal) }}
            disabled={!hasAI || !aiEnabled}
            className={cn(
              'h-10 w-10 rounded-lg flex items-center justify-center shrink-0 relative transition-all',
              typeConfig.color,
              hasAI && aiEnabled && 'cursor-pointer hover:scale-105 active:scale-95'
            )}
            title={hasAI && aiEnabled ? (showAIViewLocal ? 'Click to show original' : 'Click to show AI summary') : undefined}
          >
            <Icon className="h-5 w-5" />
            {hasAI && (
              <div className={cn(
                'absolute -top-1 -right-1 h-4 w-4 rounded-full flex items-center justify-center transition-colors',
                showAIView ? 'bg-purple-500' : 'bg-muted-foreground/50'
              )}>
                <Sparkles className="h-2.5 w-2.5 text-white" />
              </div>
            )}
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                {/* Title is always the original user content */}
                <h4 className="font-medium truncate">
                  {displayTitle}
                </h4>
                <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                  {item.description}
                </p>
              </div>

              {/* Status Dropdown */}
              <Select
                value={item.status}
                onValueChange={(v) => onStatusChange(v as FeedbackStatus)}
              >
                <SelectTrigger
                  className={cn(
                    'w-[110px] h-8 text-xs shrink-0',
                    STATUS_CONFIG[item.status].color
                  )}
                  onClick={(e) => e.stopPropagation()}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="reviewed">Reviewed</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="wont_fix">Won&apos;t Fix</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
              <span>{item.submitted_by_email}</span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {new Date(item.created_at).toLocaleDateString()}
              </span>
              {item.screenshot_url && (
                <span className="flex items-center gap-1 text-green-500">
                  <ImageIcon className="h-3 w-3" />
                  Screenshot
                </span>
              )}
              {posthogUrl && (
                <a
                  href={posthogUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1 text-purple-500 hover:text-purple-600 hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  Session replay
                </a>
              )}
            </div>

            {/* AI Summary - compact inline display (only when AI view enabled) */}
            {summary && showAIView && (
              <div className="mt-3 p-2.5 rounded-lg bg-purple-500/5 border border-purple-500/20">
                <div className="flex items-start gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-purple-500 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-purple-700 dark:text-purple-300">{summary.summary}</p>
                  </div>
                  {/* Out of date indicator */}
                  {item.ai_summary_at && item.content_updated_at &&
                    new Date(item.content_updated_at) > new Date(item.ai_summary_at) && (
                    <Badge variant="outline" className="text-[10px] border-orange-500/50 text-orange-600 shrink-0">
                      outdated
                    </Badge>
                  )}
                </div>
              </div>
            )}

            {/* AI Analysis - expandable with quick preview (only when AI view enabled) */}
            {analysis && showAIView && (
              <div className="mt-3 p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/20">
                <button
                  onClick={(e) => { e.stopPropagation(); setShowFullAnalysis(!showFullAnalysis) }}
                  className="flex items-center gap-2 w-full text-left"
                >
                  <Wrench className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
                      {item.type === 'bug' ? 'Solution: ' : 'Plan: '}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {analysis.summary.length > 80 ? analysis.summary.slice(0, 80) + '...' : analysis.summary}
                    </span>
                  </div>
                  {/* Out of date indicator */}
                  {item.ai_analysis_at && item.content_updated_at &&
                    new Date(item.content_updated_at) > new Date(item.ai_analysis_at) && (
                    <Badge variant="outline" className="text-[10px] border-orange-500/50 text-orange-600 shrink-0">
                      outdated
                    </Badge>
                  )}
                  <Badge variant="outline" className={cn(
                    'text-[10px] shrink-0',
                    analysis.confidence === 'high' && 'border-green-500/50 text-green-600',
                    analysis.confidence === 'medium' && 'border-amber-500/50 text-amber-600',
                    analysis.confidence === 'low' && 'border-red-500/50 text-red-600'
                  )}>
                    {analysis.confidence}
                  </Badge>
                  {showFullAnalysis ? (
                    <ChevronUp className="h-4 w-4 text-amber-500 shrink-0" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-amber-500 shrink-0" />
                  )}
                </button>

                {showFullAnalysis && (
                  <div className="mt-2 pt-2 border-t border-amber-500/20 space-y-2 text-sm">
                    <div>
                      <span className="font-medium text-foreground">
                        {item.type === 'bug' ? 'Cause: ' : 'Approach: '}
                      </span>
                      <span className="text-muted-foreground">{analysis.likelyCause}</span>
                    </div>
                    <div>
                      <span className="font-medium text-foreground">
                        {item.type === 'bug' ? 'Fix: ' : 'Steps: '}
                      </span>
                      <pre className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{analysis.suggestedFix}</pre>
                    </div>
                    {analysis.affectedFiles.length > 0 && (
                      <div>
                        <span className="font-medium text-foreground">Files: </span>
                        <span className="text-muted-foreground font-mono text-xs">
                          {analysis.affectedFiles.join(', ')}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* AI Controls */}
            {aiEnabled && (
              <div className="flex flex-wrap items-center gap-2 mt-3">
                {(() => {
                  const summaryOutdated = summary && item.ai_summary_at && item.content_updated_at &&
                    new Date(item.content_updated_at) > new Date(item.ai_summary_at)
                  const analysisOutdated = analysis && item.ai_analysis_at && item.content_updated_at &&
                    new Date(item.content_updated_at) > new Date(item.ai_analysis_at)

                  return (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); onSummarize(); }}
                        disabled={isSummarizing || (!!summary && !summaryOutdated)}
                        className="h-8 md:h-7 text-xs"
                      >
                        {isSummarizing ? (
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        ) : (
                          <Wand2 className="h-3 w-3 mr-1" />
                        )}
                        {summaryOutdated ? 'Re-summarize' : summary ? 'Summarized' : 'Summarize'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); onAnalyze(); }}
                        disabled={isAnalyzing || (!!analysis && !analysisOutdated)}
                        className="h-8 md:h-7 text-xs"
                      >
                        {isAnalyzing ? (
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        ) : (
                          <Wrench className="h-3 w-3 mr-1" />
                        )}
                        {analysisOutdated ? 'Re-analyze' : analysis ? 'Analyzed' : item.type === 'bug' ? 'Find Solution' : 'Suggest Implementation'}
                      </Button>
                    </>
                  )
                })()}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

interface BugAnalysis {
  summary: string
  likelyCause: string
  suggestedFix: string
  affectedFiles: string[]
  confidence: 'low' | 'medium' | 'high'
  additionalNotes?: string
}

interface ImplementationSuggestion {
  summary: string
  approach: string
  steps: Array<{
    step: number
    description: string
    files: string[]
  }>
  filesToCreate: string[]
  filesToModify: string[]
  databaseChanges?: string
  complexity: 'low' | 'medium' | 'high'
  estimatedScope: string
  risks?: string
  alternatives?: string
}

function FeedbackDetailDialog({
  item,
  onClose,
  onRefresh,
}: {
  item: FeedbackItem | null
  onClose: () => void
  onRefresh: () => void
}) {
  const [status, setStatus] = useState<FeedbackStatus | ''>('')
  const [updating, setUpdating] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState<BugAnalysis | null>(null)
  const [suggestion, setSuggestion] = useState<ImplementationSuggestion | null>(null)
  const [showAnalysis, setShowAnalysis] = useState(true)

  useEffect(() => {
    if (item) {
      setStatus(item.status)
      setAnalysis(null)
      setSuggestion(null)
    }
  }, [item])

  const handleStatusUpdate = async () => {
    if (!item || !status) return

    setUpdating(true)
    try {
      const res = await fetch(`/api/feedback/${item.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })

      if (!res.ok) throw new Error('Failed to update status')

      toast.success('Status updated')
      onRefresh()
      onClose()
    } catch (error) {
      console.error('Failed to update status:', error)
      toast.error('Failed to update status')
    } finally {
      setUpdating(false)
    }
  }

  const handleAnalyze = async () => {
    if (!item) return

    setAnalyzing(true)
    setAnalysis(null)
    setSuggestion(null)

    try {
      const endpoint = item.type === 'bug'
        ? '/api/ai/analyze-bug'
        : '/api/ai/suggest-implementation'

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedbackId: item.id }),
      })

      const json = await res.json()

      if (!res.ok) {
        throw new Error(json.error?.message || 'Failed to analyze')
      }

      if (item.type === 'bug') {
        setAnalysis(json.data?.analysis || null)
      } else {
        setSuggestion(json.data?.suggestion || null)
      }

      toast.success('AI analysis complete')
    } catch (error) {
      console.error('AI analysis failed:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to analyze')
    } finally {
      setAnalyzing(false)
    }
  }

  if (!item) return null

  const typeConfig = TYPE_CONFIG[item.type]
  const Icon = typeConfig.icon

  return (
    <Dialog open={!!item} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-[95vw] md:max-w-[700px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center', typeConfig.color)}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>{item.title || `${typeConfig.label} Report`}</DialogTitle>
              <DialogDescription>
                From {item.submitted_by_email} on {new Date(item.created_at).toLocaleString()}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          {/* Description */}
          <div>
            <h4 className="text-sm font-medium mb-1">Description</h4>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {item.description}
            </p>
          </div>

          {/* Page URL */}
          {item.page_url && (
            <div>
              <h4 className="text-sm font-medium mb-1">Page URL</h4>
              <p className="text-sm text-muted-foreground truncate">
                {item.page_url}
              </p>
            </div>
          )}

          {/* Session Replay - Embedded */}
          <SessionReplayEmbed sessionId={item.posthog_session_id} />

          {/* Browser Info */}
          {item.browser_info && (
            <div>
              <h4 className="text-sm font-medium mb-1">Browser Info</h4>
              <div className="text-xs text-muted-foreground font-mono bg-muted/50 rounded p-2">
                {Object.entries(item.browser_info).map(([key, value]) => (
                  <div key={key}>
                    <span className="text-muted-foreground">{key}:</span>{' '}
                    {String(value)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Screenshot */}
          {item.screenshot_url && (
            <div>
              <h4 className="text-sm font-medium mb-1">Screenshot</h4>
              <div className="relative rounded-lg border bg-muted/30 overflow-hidden">
                <img
                  src={item.screenshot_url}
                  alt="Bug screenshot"
                  className="w-full max-h-[300px] object-contain cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => {
                    // Open image in new tab for full view
                    const win = window.open()
                    if (win) {
                      win.document.write(`<img src="${item.screenshot_url}" style="max-width: 100%;">`)
                    }
                  }}
                />
                <p className="text-xs text-muted-foreground text-center py-1 bg-muted/50">
                  Click to view full size
                </p>
              </div>
            </div>
          )}

          {/* AI Analysis Section */}
          <div className="pt-4 border-t">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-500" />
                AI Analysis
              </h4>
              <Button
                variant="outline"
                size="sm"
                onClick={handleAnalyze}
                disabled={analyzing}
              >
                {analyzing ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                    {item.type === 'bug' ? 'Analyze Bug' : 'Suggest Implementation'}
                  </>
                )}
              </Button>
            </div>

            {/* Bug Analysis Results */}
            {analysis && (
              <div className="space-y-3 bg-purple-500/5 border border-purple-500/20 rounded-lg p-3">
                <button
                  onClick={() => setShowAnalysis(!showAnalysis)}
                  className="flex items-center justify-between w-full text-left"
                >
                  <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
                    Bug Analysis Results
                  </span>
                  {showAnalysis ? (
                    <ChevronUp className="h-4 w-4 text-purple-500" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-purple-500" />
                  )}
                </button>

                {showAnalysis && (
                  <div className="space-y-3 text-sm">
                    <div>
                      <span className="font-medium">Summary:</span>
                      <p className="text-muted-foreground mt-0.5">{analysis.summary}</p>
                    </div>

                    <div>
                      <span className="font-medium">Likely Cause:</span>
                      <p className="text-muted-foreground mt-0.5">{analysis.likelyCause}</p>
                    </div>

                    <div>
                      <span className="font-medium">Suggested Fix:</span>
                      <pre className="text-xs text-muted-foreground mt-1 bg-muted/50 rounded p-2 overflow-x-auto whitespace-pre-wrap">
                        {analysis.suggestedFix}
                      </pre>
                    </div>

                    {analysis.affectedFiles.length > 0 && (
                      <div>
                        <span className="font-medium">Affected Files:</span>
                        <ul className="text-muted-foreground mt-0.5 list-disc list-inside">
                          {analysis.affectedFiles.map((file, i) => (
                            <li key={i} className="font-mono text-xs">{file}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <span className="font-medium">Confidence:</span>
                      <Badge
                        variant="outline"
                        className={cn(
                          analysis.confidence === 'high' && 'border-green-500/50 text-green-600',
                          analysis.confidence === 'medium' && 'border-amber-500/50 text-amber-600',
                          analysis.confidence === 'low' && 'border-red-500/50 text-red-600'
                        )}
                      >
                        {analysis.confidence}
                      </Badge>
                    </div>

                    {analysis.additionalNotes && (
                      <div>
                        <span className="font-medium">Additional Notes:</span>
                        <p className="text-muted-foreground mt-0.5">{analysis.additionalNotes}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Feature Implementation Suggestion Results */}
            {suggestion && (
              <div className="space-y-3 bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">
                <button
                  onClick={() => setShowAnalysis(!showAnalysis)}
                  className="flex items-center justify-between w-full text-left"
                >
                  <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
                    Implementation Suggestion
                  </span>
                  {showAnalysis ? (
                    <ChevronUp className="h-4 w-4 text-amber-500" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-amber-500" />
                  )}
                </button>

                {showAnalysis && (
                  <div className="space-y-3 text-sm">
                    <div>
                      <span className="font-medium">Summary:</span>
                      <p className="text-muted-foreground mt-0.5">{suggestion.summary}</p>
                    </div>

                    <div>
                      <span className="font-medium">Approach:</span>
                      <p className="text-muted-foreground mt-0.5">{suggestion.approach}</p>
                    </div>

                    {suggestion.steps.length > 0 && (
                      <div>
                        <span className="font-medium">Implementation Steps:</span>
                        <ol className="text-muted-foreground mt-1 space-y-2">
                          {suggestion.steps.map((step) => (
                            <li key={step.step} className="pl-4 border-l-2 border-amber-500/30">
                              <span className="font-medium text-foreground">Step {step.step}:</span>{' '}
                              {step.description}
                              {step.files.length > 0 && (
                                <ul className="mt-1 text-xs font-mono">
                                  {step.files.map((f, i) => (
                                    <li key={i} className="text-amber-600 dark:text-amber-400">• {f}</li>
                                  ))}
                                </ul>
                              )}
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="font-medium">Complexity:</span>
                        <Badge
                          variant="outline"
                          className={cn(
                            'ml-2',
                            suggestion.complexity === 'low' && 'border-green-500/50 text-green-600',
                            suggestion.complexity === 'medium' && 'border-amber-500/50 text-amber-600',
                            suggestion.complexity === 'high' && 'border-red-500/50 text-red-600'
                          )}
                        >
                          {suggestion.complexity}
                        </Badge>
                      </div>
                      <div>
                        <span className="font-medium">Scope:</span>
                        <span className="text-muted-foreground ml-2">{suggestion.estimatedScope}</span>
                      </div>
                    </div>

                    {suggestion.databaseChanges && (
                      <div>
                        <span className="font-medium">Database Changes:</span>
                        <pre className="text-xs text-muted-foreground mt-1 bg-muted/50 rounded p-2 overflow-x-auto">
                          {suggestion.databaseChanges}
                        </pre>
                      </div>
                    )}

                    {suggestion.risks && (
                      <div>
                        <span className="font-medium">Risks:</span>
                        <p className="text-muted-foreground mt-0.5">{suggestion.risks}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Comments Section */}
          <AdminComments
            feedbackId={item.id}
            submitterEmail={item.submitted_by_email}
          />

          {/* Status Update */}
          <div className="flex flex-wrap items-center gap-2 md:gap-3 pt-4 border-t">
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as FeedbackStatus)}
            >
              <SelectTrigger className="w-full md:w-[160px] h-10 md:h-9">
                <SelectValue placeholder="Update status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="reviewed">Reviewed</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="wont_fix">Won&apos;t Fix</SelectItem>
              </SelectContent>
            </Select>

            <Button
              onClick={handleStatusUpdate}
              disabled={updating || status === item.status}
              className="h-10 md:h-9 flex-1 md:flex-none"
            >
              {updating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Update Status
            </Button>

            <Button variant="ghost" onClick={onClose} className="h-10 md:h-9">
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
  bgColor,
}: {
  icon: typeof Clock
  label: string
  value: number
  color: string
  bgColor: string
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-3">
          <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center', bgColor)}>
            <Icon className={cn('h-5 w-5', color)} />
          </div>
          <div>
            <p className="text-2xl font-semibold tabular-nums">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function FilterTab({
  label,
  active,
  onClick,
  icon: Icon,
}: {
  label: string
  active: boolean
  onClick: () => void
  icon?: typeof Bug
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 px-2.5 md:px-3 py-2.5 md:py-2 text-sm font-medium rounded-md transition-colors',
        active
          ? 'bg-background shadow-sm text-foreground'
          : 'text-muted-foreground hover:text-foreground'
      )}
    >
      {Icon && <Icon className="h-3.5 w-3.5" />}
      <span className="hidden md:inline">{label}</span>
      {!Icon && <span className="md:hidden">{label}</span>}
    </button>
  )
}
