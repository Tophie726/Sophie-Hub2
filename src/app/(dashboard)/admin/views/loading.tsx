import { PageHeader } from '@/components/layout/page-header'

export default function ViewsLoading() {
  return (
    <div className="min-h-screen">
      <PageHeader title="Views" description="Manage view profiles and audience rules" />
      <div className="p-4 md:p-8">
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-lg border border-border/40 px-4 py-3 animate-pulse"
            >
              <div className="h-4 w-32 rounded bg-muted/40 mb-2" />
              <div className="h-3 w-24 rounded bg-muted/30" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
