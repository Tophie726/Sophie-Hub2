'use client'

import { motion } from 'framer-motion'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Building2, Plus, Database } from 'lucide-react'
import Link from 'next/link'

export default function PartnersPage() {
  return (
    <div className="min-h-screen">
      <PageHeader
        title="Partners"
        description="View and manage all partner brands"
      >
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Add Partner
        </Button>
      </PageHeader>

      <div className="p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-500/10 mb-6">
                <Building2 className="h-8 w-8 text-blue-500" />
              </div>
              <h2 className="text-xl font-semibold mb-2">No partners yet</h2>
              <p className="text-muted-foreground text-center max-w-md mb-6">
                Partners will appear here once you&apos;ve imported them via the Data Enrichment wizard
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
        </motion.div>
      </div>
    </div>
  )
}
