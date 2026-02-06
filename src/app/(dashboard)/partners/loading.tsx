import { PageHeader } from '@/components/layout/page-header'

export default function PartnersLoading() {
  return (
    <div className="min-h-screen">
      <PageHeader title="Partners" />
      <div className="p-4 md:p-8">
        {/* Toolbar shimmer */}
        <div className="flex items-center gap-2 mb-4">
          <div className="h-9 w-48 bg-muted/40 rounded-md animate-pulse" />
          <div className="h-9 w-24 bg-muted/40 rounded-md animate-pulse" />
          <div className="h-9 w-24 bg-muted/40 rounded-md animate-pulse" />
        </div>
        {/* Table header */}
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="flex items-center gap-4 px-4 h-10 border-b bg-muted/20">
            <div className="h-3 w-32 bg-muted rounded animate-pulse" />
            <div className="h-3 w-20 bg-muted rounded animate-pulse" />
            <div className="h-3 w-20 bg-muted rounded animate-pulse" />
            <div className="h-3 w-24 bg-muted rounded animate-pulse" />
          </div>
          {/* Table rows */}
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 h-12 border-b last:border-0 animate-pulse" style={{ animationDelay: `${i * 50}ms` }}>
              <div className="h-3 w-36 bg-muted/40 rounded" />
              <div className="h-5 w-16 bg-muted/30 rounded-full" />
              <div className="h-5 w-14 bg-muted/30 rounded-full" />
              <div className="h-3 w-28 bg-muted/40 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
