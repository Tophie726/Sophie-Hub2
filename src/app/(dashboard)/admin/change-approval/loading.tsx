import { PageHeader } from '@/components/layout/page-header'

export default function ChangeApprovalLoading() {
  return (
    <div className="min-h-screen">
      <PageHeader title="Change Approval" description="Review and approve data changes before they're applied" />
      <div className="p-4 md:p-8 max-w-5xl">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-3 md:gap-4 md:grid-cols-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-xl border bg-card p-6 animate-pulse" style={{ animationDelay: `${i * 50}ms` }}>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-muted/40" />
                <div className="space-y-2">
                  <div className="h-6 w-10 bg-muted/40 rounded" />
                  <div className="h-3 w-20 bg-muted/30 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
        {/* Empty state card */}
        <div className="rounded-xl border bg-card p-16 animate-pulse">
          <div className="flex flex-col items-center">
            <div className="h-16 w-16 rounded-full bg-muted/40 mb-4" />
            <div className="h-5 w-48 bg-muted/40 rounded mb-2" />
            <div className="h-3 w-72 bg-muted/30 rounded" />
          </div>
        </div>
      </div>
    </div>
  )
}
