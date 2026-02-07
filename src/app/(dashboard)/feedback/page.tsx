'use client'

import { Suspense, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Lightbulb, Map, Plus, Loader2 } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { IdeasList } from '@/components/feedback/ideas-list'
import { RoadmapBoard } from '@/components/feedback/roadmap-board'
import { SubmitIdeaModal } from '@/components/feedback/submit-idea-modal'
import { useAuthMe } from '@/lib/hooks/use-auth-me'
import { cn } from '@/lib/utils'

type TabValue = 'ideas' | 'roadmap'

const TABS: { value: TabValue; label: string; icon: typeof Lightbulb }[] = [
  { value: 'ideas', label: 'Ideas', icon: Lightbulb },
  { value: 'roadmap', label: 'Roadmap', icon: Map },
]

/**
 * Feedback Center - Frill-style feedback hub for all staff
 *
 * Tabs:
 * - Ideas: Browse, search, vote on feature requests and bugs
 * - Roadmap: See what's planned, in progress, and shipped
 */
export default function FeedbackPage() {
  return (
    <Suspense fallback={<FeedbackLoading />}>
      <FeedbackContent />
    </Suspense>
  )
}

function FeedbackLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  )
}

function FeedbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab') as TabValue | null
  const feedbackId = searchParams.get('id')
  const openParam = searchParams.get('open')
  const presetTitle = searchParams.get('title') || undefined
  const presetDescription = searchParams.get('description') || undefined
  const [activeTab, setActiveTab] = useState<TabValue>(tabParam || 'ideas')
  const [showModal, setShowModal] = useState(openParam === 'idea')

  const { data: authUser } = useAuthMe()
  const isAdmin = authUser?.role === 'admin'

  const handleTabChange = (tab: TabValue) => {
    setActiveTab(tab)
    // Update URL without full navigation
    const params = new URLSearchParams(searchParams)
    if (tab === 'ideas') {
      params.delete('tab')
    } else {
      params.set('tab', tab)
    }
    const newUrl = params.toString() ? `?${params}` : '/feedback'
    router.replace(newUrl, { scroll: false })
  }

  return (
    <div className="min-h-screen">
      <PageHeader
        title="Feedback"
        description="Share ideas, vote on features, and see what's coming"
      >
        <Button onClick={() => setShowModal(true)} className="h-10 md:h-9 active:scale-[0.97]">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline ml-1.5">Submit Idea</span>
        </Button>
      </PageHeader>

      <div className="p-4 md:p-8 max-w-6xl">
        {/* Tabs */}
        <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1 w-fit mb-6">
          {TABS.map(tab => {
            const Icon = tab.icon
            const isActive = activeTab === tab.value
            return (
              <button
                key={tab.value}
                onClick={() => handleTabChange(tab.value)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors active:scale-[0.97]',
                  isActive
                    ? 'bg-background shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Tab content — both stay mounted for instant tab switches */}
        <div className={activeTab === 'ideas' ? 'block' : 'hidden'}>
          <IdeasList onSubmitIdea={() => setShowModal(true)} isAdmin={isAdmin} initialOpenId={feedbackId} />
        </div>
        <div className={activeTab === 'roadmap' ? 'block' : 'hidden'}>
          <RoadmapBoard />
        </div>
      </div>

      {/* Submit Idea Modal - simplified for Ideas only */}
      <SubmitIdeaModal
        open={showModal}
        onOpenChange={setShowModal}
        initialTitle={presetTitle}
        initialDescription={presetDescription}
      />
    </div>
  )
}
