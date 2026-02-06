import { PageHeader } from '@/components/layout/page-header'

export default function FeedbackLoading() {
  return (
    <div className="min-h-screen">
      <PageHeader title="Feedback" />
      <div className="p-4 md:p-8">
        {/* Tab bar shimmer */}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/30 w-fit mb-6">
          <div className="h-8 w-20 bg-muted/50 rounded-md animate-pulse" />
          <div className="h-8 w-24 bg-muted/40 rounded-md animate-pulse" />
        </div>
        {/* Card list shimmer */}
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="rounded-lg border bg-card p-4 animate-pulse" style={{ animationDelay: `${i * 60}ms` }}>
              <div className="flex items-start justify-between mb-2">
                <div className="h-4 w-48 bg-muted/40 rounded" />
                <div className="h-6 w-10 bg-muted/30 rounded-full" />
              </div>
              <div className="h-3 w-full bg-muted/25 rounded mb-2" />
              <div className="h-3 w-2/3 bg-muted/25 rounded" />
              <div className="flex items-center gap-2 mt-3">
                <div className="h-5 w-14 bg-muted/30 rounded-full" />
                <div className="h-3 w-20 bg-muted/20 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
