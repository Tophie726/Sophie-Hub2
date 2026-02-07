'use client'

import { useCallback } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, LayoutDashboard, BarChart3 } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/layout/page-header'
import { ShimmerBar, ShimmerGrid } from '@/components/ui/shimmer-grid'
import { DashboardList } from '@/components/modules/dashboard-list'
import { UsageDashboard } from '@/components/modules/usage-dashboard'
import { PortfolioCard } from '@/components/modules/portfolio-card'
import { useModuleQuery } from '@/lib/hooks/use-module-query'
import type { Module } from '@/types/modules'

type Tab = 'dashboards' | 'usage'

const TABS: { value: Tab; label: string; icon: React.ReactNode }[] = [
  { value: 'dashboards', label: 'Dashboards', icon: <LayoutDashboard className="h-3.5 w-3.5" /> },
  { value: 'usage', label: 'Usage & Cost', icon: <BarChart3 className="h-3.5 w-3.5" /> },
]

export default function ModuleDetailPage() {
  const params = useParams<{ slug: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { data: module, isLoading, error } = useModuleQuery(params.slug)

  const activeTab = (searchParams.get('tab') as Tab) || 'dashboards'
  const isAmazonReporting = params.slug === 'amazon-reporting'

  const setActiveTab = useCallback((tab: Tab) => {
    if (tab === 'dashboards') {
      router.push(`/admin/modules/${params.slug}`, { scroll: false })
    } else {
      router.push(`/admin/modules/${params.slug}?tab=${tab}`, { scroll: false })
    }
  }, [router, params.slug])

  if (isLoading) {
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

  if (error || !module) {
    return (
      <div className="min-h-screen">
        <PageHeader title="Module Not Found" />
        <div className="flex flex-col items-center justify-center py-32 text-center px-4">
          <p className="text-sm text-destructive">{error instanceof Error ? error.message : 'Module not found'}</p>
          <Link href="/admin/modules" className="mt-3 text-sm text-primary hover:underline">
            Back to Modules
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <PageHeader
        title={(module as Module).name}
        description={(module as Module).description || undefined}
      >
        <Link
          href="/admin/modules"
          className="flex items-center gap-1 text-xs md:text-sm text-muted-foreground hover:text-foreground transition-colors active:scale-[0.97]"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Modules</span>
        </Link>
      </PageHeader>

      <div className="p-4 md:p-8">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Tabs — only show if module has usage dashboard */}
          {isAmazonReporting && (
            <div className="flex items-center gap-1 p-0.5 rounded-lg w-fit overflow-x-auto scrollbar-hide" style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.08)' }}>
              {TABS.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setActiveTab(tab.value)}
                  className={cn(
                    'relative flex items-center gap-1.5 px-3 py-2 md:py-1.5 text-sm font-medium rounded-md transition-colors active:scale-[0.97]',
                    activeTab === tab.value
                      ? 'text-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {activeTab === tab.value && (
                    <motion.div
                      layoutId="moduleTab"
                      initial={false}
                      className="absolute inset-0 bg-background rounded-md"
                      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
                      transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-1.5">
                    {tab.icon}
                    {tab.label}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Tab content — both stay mounted for instant tab switches */}
          {isAmazonReporting ? (
            <>
              <div className={activeTab === 'dashboards' ? 'block' : 'hidden'}>
                <div className="space-y-6">
                  <PortfolioCard moduleSlug={params.slug} />
                  <DashboardList module={module as Module} />
                </div>
              </div>
              <div className={activeTab === 'usage' ? 'block' : 'hidden'}>
                <UsageDashboard moduleSlug={params.slug} />
              </div>
            </>
          ) : (
            <DashboardList module={module as Module} />
          )}
        </div>
      </div>
    </div>
  )
}
