'use client'

import dynamic from 'next/dynamic'

const UsageCharts = dynamic(() => import('./usage-charts'), {
  ssr: false,
  loading: () => <div className="animate-pulse h-64 bg-muted rounded-lg" />,
})

interface UsageDashboardProps {
  moduleSlug: string
}

export function UsageDashboard({ moduleSlug }: UsageDashboardProps) {
  if (moduleSlug !== 'amazon-reporting') return null
  return <UsageCharts />
}
