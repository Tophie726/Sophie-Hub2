import { PageHeader } from '@/components/layout/page-header'
import { ShimmerBar, ShimmerGrid } from '@/components/ui/shimmer-grid'

export default function ModuleDetailLoading() {
  return (
    <div className="min-h-screen">
      <PageHeader title="Loading module..." />
      <div className="p-4 md:p-8">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex items-center gap-2 p-0.5 rounded-lg w-fit">
            <ShimmerBar width={130} height={32} className="rounded-md" />
            <ShimmerBar width={130} height={32} className="rounded-md" />
          </div>

          <div className="rounded-lg border bg-card p-4 space-y-2">
            <ShimmerBar width={160} height={14} />
            <ShimmerBar width="40%" height={12} />
          </div>

          <div className="space-y-2">
            <ShimmerBar width={90} height={12} />
            <div
              className="rounded-lg overflow-hidden p-3"
              style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.08)' }}
            >
              <ShimmerGrid variant="table" rows={4} columns={3} cellHeight={28} />
            </div>
          </div>

          <div className="space-y-2">
            <ShimmerBar width={140} height={12} />
            <div
              className="rounded-lg overflow-hidden p-3"
              style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.08)' }}
            >
              <ShimmerGrid variant="table" rows={4} columns={4} cellHeight={28} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
