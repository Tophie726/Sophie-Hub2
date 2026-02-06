'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Loader2, LayoutDashboard, BarChart3 } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/layout/page-header'
import { DashboardList } from '@/components/modules/dashboard-list'
import { UsageDashboard } from '@/components/modules/usage-dashboard'
import { UsagePreview } from '@/components/modules/usage-preview'
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
  const [module, setModule] = useState<Module | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const activeTab = (searchParams.get('tab') as Tab) || 'dashboards'
  const isAmazonReporting = params.slug === 'amazon-reporting'

  const setActiveTab = useCallback((tab: Tab) => {
    if (tab === 'dashboards') {
      router.push(`/admin/modules/${params.slug}`, { scroll: false })
    } else {
      router.push(`/admin/modules/${params.slug}?tab=${tab}`, { scroll: false })
    }
  }, [router, params.slug])

  useEffect(() => {
    async function fetchModule() {
      try {
        const response = await fetch(`/api/modules?slug=${params.slug}`)
        if (!response.ok) throw new Error('Module not found')
        const json = await response.json()
        const modules = json.data?.modules || json.modules || []
        const found = modules.find((m: Module) => m.slug === params.slug)
        if (!found) throw new Error('Module not found')
        setModule(found)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load module')
      } finally {
        setIsLoading(false)
      }
    }
    fetchModule()
  }, [params.slug])

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <PageHeader title="Loading..." />
        <div className="flex items-center justify-center py-32">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (error || !module) {
    return (
      <div className="min-h-screen">
        <PageHeader title="Module Not Found" />
        <div className="flex flex-col items-center justify-center py-32 text-center px-4">
          <p className="text-sm text-destructive">{error || 'Module not found'}</p>
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
        title={module.name}
        description={module.description || undefined}
      >
        <Link
          href="/admin/modules"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Modules
        </Link>
      </PageHeader>

      <div className="p-4 md:p-8">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Tabs — only show if module has usage dashboard */}
          {isAmazonReporting && (
            <div className="flex items-center gap-1 p-0.5 rounded-lg w-fit" style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.08)' }}>
              {TABS.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setActiveTab(tab.value)}
                  className={cn(
                    'relative flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                    activeTab === tab.value
                      ? 'text-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {activeTab === tab.value && (
                    <motion.div
                      layoutId="moduleTab"
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

          {/* Dashboards tab */}
          {activeTab === 'dashboards' && (
            <div className="space-y-6">
              {/* Mini usage preview card */}
              {isAmazonReporting && (
                <UsagePreview
                  moduleSlug={params.slug}
                  onViewDetails={() => setActiveTab('usage')}
                />
              )}
              <DashboardList module={module} />
            </div>
          )}

          {/* Usage & Cost tab */}
          {activeTab === 'usage' && isAmazonReporting && (
            <UsageDashboard moduleSlug={params.slug} />
          )}

          {/* Non-amazon modules — no tabs, just dashboard list */}
          {!isAmazonReporting && (
            <DashboardList module={module} />
          )}
        </div>
      </div>
    </div>
  )
}
