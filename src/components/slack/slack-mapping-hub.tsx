'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Users, Hash, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SlackConnectionCard } from './slack-connection-card'
import { SlackStaffMapping } from './slack-staff-mapping'
import { SlackChannelMapping } from './slack-channel-mapping'

type Tab = 'staff' | 'channels'

interface SlackMappingHubProps {
  onBack?: () => void
}

const tabs: { id: Tab; label: string; icon: typeof Users }[] = [
  { id: 'staff', label: 'Staff', icon: Users },
  { id: 'channels', label: 'Channels', icon: Hash },
]

export function SlackMappingHub({ onBack }: SlackMappingHubProps) {
  const [activeTab, setActiveTab] = useState<Tab>('staff')
  const [isConnected, setIsConnected] = useState(false)

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
          <h2 className="text-xl font-semibold">Slack Integration</h2>
          <p className="text-sm text-muted-foreground">
            Map Slack users to staff and channels to partners
          </p>
        </div>
      </div>

      {/* Connection Card */}
      <SlackConnectionCard onConnected={() => setIsConnected(true)} />

      {/* Tab navigation + content */}
      {(isConnected || true) && ( // Always show tabs (connection check is in API routes)
        <>
          {/* Tabs */}
          <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-lg w-fit">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="relative flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors"
                >
                  {isActive && (
                    <motion.div
                      layoutId="slackActiveTab"
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
            {activeTab === 'staff' && <SlackStaffMapping />}
            {activeTab === 'channels' && <SlackChannelMapping />}
          </div>
        </>
      )}
    </div>
  )
}
