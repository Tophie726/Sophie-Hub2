'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Search, Home, ArrowLeft, Bug } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FeedbackModal } from '@/components/feedback/feedback-modal'

/**
 * Custom 404 page with helpful navigation and bug report option.
 */
export default function NotFound() {
  const router = useRouter()
  const [showFeedback, setShowFeedback] = useState(false)

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center">
            <Search className="h-10 w-10 text-muted-foreground" />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold mb-2">Page not found</h1>

        {/* Description */}
        <p className="text-muted-foreground mb-8">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button
            variant="outline"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>

          <Button asChild>
            <Link href="/dashboard">
              <Home className="h-4 w-4 mr-2" />
              Dashboard
            </Link>
          </Button>

          <Button
            variant="ghost"
            onClick={() => setShowFeedback(true)}
            className="text-muted-foreground"
          >
            <Bug className="h-4 w-4 mr-2" />
            Report a Bug
          </Button>
        </div>

        {/* Subtle hint */}
        <p className="text-xs text-muted-foreground mt-8">
          If you think this is a bug, please let us know.
        </p>
      </div>

      {/* Feedback Modal */}
      <FeedbackModal
        open={showFeedback}
        onOpenChange={setShowFeedback}
      />
    </div>
  )
}
