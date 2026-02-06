'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Loader2 } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { DashboardList } from '@/components/modules/dashboard-list'
import { UsageDashboard } from '@/components/modules/usage-dashboard'
import type { Module } from '@/types/modules'

export default function ModuleDetailPage() {
  const params = useParams<{ slug: string }>()
  const [module, setModule] = useState<Module | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
        <div className="max-w-5xl mx-auto space-y-8">
          <UsageDashboard moduleSlug={params.slug} />
          <DashboardList module={module} />
        </div>
      </div>
    </div>
  )
}
