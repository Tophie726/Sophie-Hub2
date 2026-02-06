'use client'

import { useState, useMemo } from 'react'
import { Search, Loader2, Lightbulb, Bug, HelpCircle, Filter } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { IdeaCard } from './idea-card'
import { cn } from '@/lib/utils'
import { useDebounce } from '@/lib/hooks/use-debounce'
import { useIdeasQuery } from '@/lib/hooks/use-feedback-query'
import { useQueryClient } from '@tanstack/react-query'

type FeedbackType = 'bug' | 'feature' | 'question'
type FeedbackStatus = 'new' | 'reviewed' | 'in_progress' | 'resolved' | 'wont_fix'
type SortOption = 'recent' | 'votes'

interface FeedbackItem {
  id: string
  type: FeedbackType
  status: FeedbackStatus
  title: string | null
  description: string
  vote_count: number
  has_voted: boolean
  submitted_by_email: string
  created_at: string
  screenshot_url?: string | null
}

interface IdeasListProps {
  onSubmitIdea?: () => void
  isAdmin?: boolean
  /** Auto-open the detail modal for this feedback ID */
  initialOpenId?: string | null
}

const TYPE_FILTERS = [
  { value: 'all', label: 'All', icon: null },
  { value: 'feature', label: 'Features', icon: Lightbulb },
  { value: 'bug', label: 'Bugs', icon: Bug },
  { value: 'question', label: 'Questions', icon: HelpCircle },
]

/**
 * Filterable and sortable list of feedback ideas.
 */
export function IdeasList({ onSubmitIdea, isAdmin = false, initialOpenId }: IdeasListProps) {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<FeedbackType | 'all'>('all')
  const [sortBy, setSortBy] = useState<SortOption>('votes')
  const [showMine, setShowMine] = useState(false)
  // Track which ID we've auto-opened to prevent re-opening on re-renders
  const [openedId, setOpenedId] = useState<string | null>(null)

  const debouncedSearch = useDebounce(search, 300)

  const queryClient = useQueryClient()

  const queryParams = {
    type: typeFilter !== 'all' ? typeFilter : undefined,
    sort: sortBy,
    mine: showMine || undefined,
  }
  const { data: rawIdeas = [], isLoading: loading } = useIdeasQuery(queryParams)

  // Client-side search filter (for title and description)
  const ideas = useMemo(() => {
    if (!debouncedSearch) return rawIdeas as FeedbackItem[]
    const searchLower = debouncedSearch.toLowerCase()
    return (rawIdeas as FeedbackItem[]).filter(item =>
      (item.title?.toLowerCase().includes(searchLower)) ||
      item.description.toLowerCase().includes(searchLower)
    )
  }, [rawIdeas, debouncedSearch])

  const queryKey = ['feedback', 'ideas', { type: queryParams.type, sort: queryParams.sort, mine: queryParams.mine }]

  const handleVoteChange = (id: string, newCount: number, hasVoted: boolean) => {
    queryClient.setQueryData(queryKey, (old: FeedbackItem[] | undefined) =>
      (old || []).map(item =>
        item.id === id
          ? { ...item, vote_count: newCount, has_voted: hasVoted }
          : item
      )
    )
  }

  const handleStatusChange = (id: string, newStatus: FeedbackStatus) => {
    queryClient.setQueryData(queryKey, (old: FeedbackItem[] | undefined) =>
      (old || []).map(item =>
        item.id === id
          ? { ...item, status: newStatus }
          : item
      )
    )
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search ideas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Type filter */}
        <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1 overflow-x-auto scrollbar-hide">
          {TYPE_FILTERS.map(filter => {
            const Icon = filter.icon
            const isActive = typeFilter === filter.value
            return (
              <button
                key={filter.value}
                onClick={() => setTypeFilter(filter.value as FeedbackType | 'all')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap h-10 md:h-auto active:scale-[0.97]',
                  isActive
                    ? 'bg-background shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {Icon && <Icon className="h-3.5 w-3.5" />}
                <span className={cn(Icon ? 'hidden sm:inline' : '')}>{filter.label}</span>
              </button>
            )
          })}
        </div>

        {/* Sort */}
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
          <SelectTrigger className="w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="votes">Top Voted</SelectItem>
            <SelectItem value="recent">Most Recent</SelectItem>
          </SelectContent>
        </Select>

        {/* My Ideas toggle */}
        <Button
          variant={showMine ? 'default' : 'outline'}
          size="sm"
          onClick={() => setShowMine(!showMine)}
          className="whitespace-nowrap"
        >
          <Filter className="h-4 w-4 mr-1.5" />
          My Ideas
        </Button>
      </div>

      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        {loading ? 'Loading...' : `${ideas.length} idea${ideas.length !== 1 ? 's' : ''}`}
        {showMine && ' (showing your ideas only)'}
      </div>

      {/* Ideas list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : ideas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-16 w-16 rounded-full bg-amber-500/10 flex items-center justify-center mb-4">
            <Lightbulb className="h-8 w-8 text-amber-500" />
          </div>
          <h3 className="text-lg font-medium mb-2">No ideas yet</h3>
          <p className="text-sm text-muted-foreground max-w-md mb-4">
            {showMine
              ? "You haven't submitted any ideas yet."
              : search
                ? 'No ideas match your search.'
                : 'Be the first to share an idea!'}
          </p>
          {onSubmitIdea && (
            <Button onClick={onSubmitIdea}>
              <Lightbulb className="h-4 w-4 mr-2" />
              Submit an Idea
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {ideas.map(item => {
            // Auto-open if this is the initialOpenId and we haven't opened it yet
            const shouldAutoOpen = initialOpenId === item.id && openedId !== item.id
            if (shouldAutoOpen) {
              // Mark as opened to prevent re-opening
              setOpenedId(item.id)
            }
            return (
              <IdeaCard
                key={item.id}
                item={item}
                onVoteChange={handleVoteChange}
                onStatusChange={handleStatusChange}
                isAdmin={isAdmin}
                autoOpen={shouldAutoOpen}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
