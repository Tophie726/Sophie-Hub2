import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Users, Plus, Database } from 'lucide-react'
import Link from 'next/link'

export default function StaffPage() {
  return (
    <div className="min-h-screen">
      <PageHeader
        title="Staff"
        description="View and manage team members"
      >
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Add Staff
        </Button>
      </PageHeader>

      <div className="p-8">
        <div>
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-green-500/10 mb-6">
                <Users className="h-8 w-8 text-green-500" />
              </div>
              <h2 className="text-xl font-semibold mb-2">No staff members yet</h2>
              <p className="text-muted-foreground text-center max-w-md mb-6">
                Staff members will appear here once you&apos;ve imported them via the Data Enrichment wizard
                or added them manually.
              </p>
              <div className="flex gap-3">
                <Button variant="outline" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Manually
                </Button>
                <Link href="/admin/data-enrichment">
                  <Button className="gap-2">
                    <Database className="h-4 w-4" />
                    Import from Sheets
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
