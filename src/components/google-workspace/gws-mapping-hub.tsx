'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Users, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { GWSConnectionCard } from './gws-connection-card'
import { GWSStaffMapping } from './gws-staff-mapping'

type Tab = 'staff'

interface GWSMappingHubProps {
  onBack?: () => void
}

const tabs: { id: Tab; label: string; icon: typeof Users }[] = [
  { id: 'staff', label: 'Staff Mapping', icon: Users },
]

export function GWSMappingHub({ onBack }: GWSMappingHubProps) {
  const [activeTab, setActiveTab] = useState<Tab>('staff')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        {onBack && (
          <Button variant="ghost" size="sm" onClick={onBack} className="h-8">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        )}
        <div>
          <h2 className="text-xl font-semibold">Google Workspace</h2>
          <p className="text-sm text-muted-foreground">
            Sync directory users and enrich staff profiles
          </p>
        </div>
      </div>

      {/* Connection Card */}
      <GWSConnectionCard />

      {/* Tab navigation + content */}
      <>
        {/* Tabs */}
        <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-lg w-fit overflow-x-auto scrollbar-hide">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="relative flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors shrink-0"
              >
                {isActive && (
                  <motion.div
                    layoutId="gwsActiveTab"
                    className="absolute inset-0 bg-background shadow-sm rounded-md ring-1 ring-border/50"
                    transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }}
                  />
                )}
                <Icon className={`relative z-10 h-4 w-4 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                <span className={`relative z-10 ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
                  {tab.label}
                </span>
              </button>
            )
          })}
        </div>

        {/* Tab content */}
        <div>
          {activeTab === 'staff' && <GWSStaffMapping />}
        </div>
      </>
    </div>
  )
}
