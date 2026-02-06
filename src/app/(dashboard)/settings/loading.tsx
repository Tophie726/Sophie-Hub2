import { PageHeader } from '@/components/layout/page-header'

export default function SettingsLoading() {
  return (
    <div className="min-h-screen">
      <PageHeader title="Settings" description="Manage your account, view your activity, and configure preferences" />
      <div className="p-4 md:p-8">
        {/* Tab bar */}
        <div className="flex gap-1 p-1 mb-6 bg-muted/50 rounded-lg w-fit">
          <div className="h-9 w-24 bg-muted/40 rounded-md animate-pulse" />
          <div className="h-9 w-28 bg-muted/40 rounded-md animate-pulse" style={{ animationDelay: '50ms' }} />
          <div className="h-9 w-28 bg-muted/40 rounded-md animate-pulse" style={{ animationDelay: '100ms' }} />
        </div>
        {/* Content card */}
        <div className="max-w-2xl space-y-8">
          <div className="rounded-xl border bg-card p-6 animate-pulse">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-full bg-muted/40" />
              <div className="space-y-2 flex-1">
                <div className="h-4 w-40 bg-muted/40 rounded" />
                <div className="h-3 w-56 bg-muted/30 rounded" />
              </div>
            </div>
          </div>
          <div className="rounded-xl border bg-card p-6 animate-pulse" style={{ animationDelay: '100ms' }}>
            <div className="h-4 w-16 bg-muted/40 rounded mb-4" />
            <div className="grid grid-cols-3 gap-2">
              <div className="h-12 bg-muted/30 rounded-lg" />
              <div className="h-12 bg-muted/30 rounded-lg" />
              <div className="h-12 bg-muted/30 rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
