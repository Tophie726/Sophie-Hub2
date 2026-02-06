import { PageHeader } from '@/components/layout/page-header'

export default function FeedbackAdminLoading() {
  return (
    <div className="min-h-screen">
      <PageHeader title="Feedback Triage" description="Admin view for managing and triaging user feedback" />
      <div className="p-4 md:p-8 max-w-6xl">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-3 md:gap-4 md:grid-cols-4 mb-6 md:mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-xl border bg-card p-6 animate-pulse" style={{ animationDelay: `${i * 50}ms` }}>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-muted/40" />
                <div className="space-y-2">
                  <div className="h-6 w-10 bg-muted/40 rounded" />
                  <div className="h-3 w-14 bg-muted/30 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
        {/* Filter tabs */}
        <div className="flex items-center gap-2 mb-4">
          <div className="h-9 w-64 bg-muted/40 rounded-lg animate-pulse" />
          <div className="h-9 w-32 bg-muted/40 rounded-md animate-pulse" />
        </div>
        {/* Feedback cards */}
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="rounded-xl border bg-card p-4 animate-pulse" style={{ animationDelay: `${i * 60}ms` }}>
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-lg bg-muted/40 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 bg-muted/40 rounded" />
                  <div className="h-3 w-full bg-muted/30 rounded" />
                  <div className="flex gap-4 mt-3">
                    <div className="h-3 w-32 bg-muted/30 rounded" />
                    <div className="h-3 w-20 bg-muted/30 rounded" />
                  </div>
                </div>
                <div className="h-8 w-24 bg-muted/30 rounded-md shrink-0" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
