'use client'

import { PageHeader } from '@/components/layout/page-header'
import { ModuleHub } from '@/components/modules/module-hub'

export default function ModulesPage() {
  return (
    <div className="min-h-screen">
      <PageHeader
        title="Modules"
        description="Reporting dashboards and building blocks"
      />
      <div className="p-4 md:p-8">
        <ModuleHub />
      </div>
    </div>
  )
}
