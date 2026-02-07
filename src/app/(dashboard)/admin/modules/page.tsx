'use client'

import { PageHeader } from '@/components/layout/page-header'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ModuleHub } from '@/components/modules/module-hub'

export default function ModulesPage() {
  return (
    <div className="min-h-screen">
      <PageHeader
        title="Modules"
        description="Reporting dashboards and building blocks"
      >
        <Button asChild variant="outline" className="h-10 md:h-9">
          <Link
            href="/feedback?tab=ideas&open=idea&title=New%20Module%20Suggestion&description=Module%20name%3A%20%0AProblem%20it%20solves%3A%20%0AWho%20uses%20it%3A%20%0AKey%20widgets%20needed%3A%20"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline ml-1.5">Suggest Module</span>
          </Link>
        </Button>
      </PageHeader>
      <div className="p-4 md:p-8">
        <ModuleHub />
      </div>
    </div>
  )
}
