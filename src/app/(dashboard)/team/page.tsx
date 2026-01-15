'use client'

import { motion } from 'framer-motion'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { UserCircle, Users } from 'lucide-react'

export default function TeamPage() {
  return (
    <div className="min-h-screen">
      <PageHeader
        title="Team"
        description="View squads and team structure"
      />

      <div className="p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="space-y-6"
        >
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-500/10 mb-6">
                <UserCircle className="h-8 w-8 text-purple-500" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Team structure coming soon</h2>
              <p className="text-muted-foreground text-center max-w-md">
                Once staff data is imported, you&apos;ll be able to organize team members into squads
                and view the organizational structure here.
              </p>
            </CardContent>
          </Card>

          {/* Preview of what squads will look like */}
          <div className="grid gap-4 md:grid-cols-3 opacity-50">
            {['PPC Squad Alpha', 'Content & Conversion', 'Sales Team'].map((squad) => (
              <Card key={squad}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    {squad}
                  </CardTitle>
                  <CardDescription>Preview only</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">0 members</Badge>
                    <Badge variant="outline">No leader</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  )
}
