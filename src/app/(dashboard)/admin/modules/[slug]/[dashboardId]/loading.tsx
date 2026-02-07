import { ShimmerBar, ShimmerGrid } from '@/components/ui/shimmer-grid'

export default function DashboardBuilderLoading() {
  return (
    <div className="min-h-screen">
      <div className="border-b border-border/40 bg-background/95 backdrop-blur sticky top-14 md:top-0 z-30">
        <div className="flex items-center justify-between gap-2 px-4 md:px-8 min-h-[4rem]">
          <ShimmerBar width={220} height={20} />
          <div className="flex items-center gap-2">
            <ShimmerBar width={130} height={34} className="rounded-md" />
            <ShimmerBar width={120} height={34} className="rounded-md" />
            <ShimmerBar width={90} height={34} className="rounded-md" />
          </div>
        </div>
      </div>

      <div className="p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="space-y-3">
            <ShimmerBar width={180} height={16} />
            <div className="rounded-xl border bg-card p-4">
              <ShimmerGrid variant="grid" rows={1} columns={1} cellHeight={220} />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-xl border bg-card p-4">
              <ShimmerGrid variant="grid" rows={1} columns={1} cellHeight={140} />
            </div>
            <div className="rounded-xl border bg-card p-4">
              <ShimmerGrid variant="grid" rows={1} columns={1} cellHeight={140} />
            </div>
          </div>

          <div className="rounded-xl border bg-card p-4">
            <ShimmerGrid variant="table" rows={6} columns={5} cellHeight={26} />
          </div>
        </div>
      </div>
    </div>
  )
}
