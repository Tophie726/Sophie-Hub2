import { PageHeader } from '@/components/layout/page-header'

export default function ViewBuilderLoading() {
  return (
    <div className="min-h-screen">
      <PageHeader title="View Builder" description="Loading view configuration..." />
      <div className="p-4 md:p-8">
        <div className="grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)] gap-4 max-w-[1400px] mx-auto">
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border/50 bg-card p-4 animate-pulse">
                <div className="h-4 w-32 rounded bg-muted/40 mb-3" />
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((__, j) => (
                    <div key={j} className="h-9 rounded bg-muted/25" />
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-border/50 bg-card p-5 animate-pulse">
            <div className="h-5 w-40 rounded bg-muted/40 mb-4" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-24 rounded-xl bg-muted/25" />
              ))}
            </div>
            <div className="h-40 rounded-xl bg-muted/20" />
          </div>
        </div>
      </div>
    </div>
  )
}
