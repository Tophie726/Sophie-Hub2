import { PageHeader } from '@/components/layout/page-header'

export default function ModulesLoading() {
  return (
    <div className="min-h-screen">
      <PageHeader
        title="Modules"
        description="Reporting dashboards and building blocks"
      />
      <div className="p-4 md:p-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rounded-xl border bg-card p-5 animate-pulse" style={{ animationDelay: `${i * 40}ms` }}>
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 bg-muted/40 rounded-lg" />
                <div>
                  <div className="h-4 w-28 bg-muted/40 rounded mb-1.5" />
                  <div className="h-3 w-20 bg-muted/25 rounded" />
                </div>
              </div>
              <div className="h-3 w-full bg-muted/20 rounded mb-1.5" />
              <div className="h-3 w-3/4 bg-muted/20 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
