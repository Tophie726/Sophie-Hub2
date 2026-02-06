import { PageHeader } from '@/components/layout/page-header'

export default function DashboardLoading() {
  return (
    <div className="min-h-screen">
      <PageHeader title="Dashboard" />
      <div className="p-4 md:p-8 space-y-4">
        <div className="grid grid-cols-2 gap-3 md:gap-4">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="rounded-xl border bg-card p-4 md:p-6 animate-pulse">
              <div className="h-3 w-20 bg-muted rounded mb-3" />
              <div className="h-8 w-16 bg-muted rounded" />
            </div>
          ))}
        </div>
        <div className="rounded-xl border bg-card p-4 md:p-6 animate-pulse">
          <div className="h-3 w-32 bg-muted rounded mb-4" />
          <div className="h-[140px] bg-muted/30 rounded" />
        </div>
      </div>
    </div>
  )
}
