'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { PortfolioDashboard } from '@/components/modules/portfolio-dashboard'

export default function PortfolioPage() {
  const params = useParams<{ slug: string }>()

  return (
    <div className="min-h-screen">
      <PageHeader
        title="Amazon Portfolio Overview"
        description="Performance across all connected brands"
      >
        <Link
          href={`/admin/modules/${params.slug}`}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Dashboards
        </Link>
      </PageHeader>

      <div className="p-4 md:p-8">
        <div className="max-w-6xl mx-auto">
          <PortfolioDashboard moduleSlug={params.slug} />
        </div>
      </div>
    </div>
  )
}
