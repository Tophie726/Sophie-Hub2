import { PageHeader } from '@/components/layout/page-header'

export default function DataEnrichmentLoading() {
  return (
    <div className="min-h-screen">
      <PageHeader title="Data Enrichment" description="Map and sync external data sources" />
      <div className="p-4 md:p-8">
        {/* Source cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rounded-xl border bg-card p-5 animate-pulse" style={{ animationDelay: `${i * 60}ms` }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-lg bg-muted/40" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 w-32 bg-muted/40 rounded" />
                  <div className="h-3 w-20 bg-muted/30 rounded" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-3 w-full bg-muted/30 rounded" />
                <div className="h-3 w-3/4 bg-muted/30 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
