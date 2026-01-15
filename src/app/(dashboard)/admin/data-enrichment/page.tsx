'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Database,
  Plus,
  FileSpreadsheet,
  ArrowRight,
  CheckCircle2,
  Circle,
  Loader2,
  ExternalLink,
  RefreshCw,
  Settings,
  Sparkles,
} from 'lucide-react'

type WizardStep = 'overview' | 'connect' | 'discover' | 'classify' | 'review' | 'commit'

const steps = [
  { id: 'connect', label: 'Connect', description: 'Add data source' },
  { id: 'discover', label: 'Discover', description: 'Find fields' },
  { id: 'classify', label: 'Classify', description: 'Map fields' },
  { id: 'review', label: 'Review', description: 'Stage changes' },
  { id: 'commit', label: 'Commit', description: 'Apply data' },
]

export default function DataEnrichmentPage() {
  const [currentStep, setCurrentStep] = useState<WizardStep>('overview')
  const [isConnecting, setIsConnecting] = useState(false)

  const handleStartWizard = () => {
    setCurrentStep('connect')
  }

  const handleBack = () => {
    setCurrentStep('overview')
  }

  return (
    <div className="min-h-screen">
      <PageHeader
        title="Data Enrichment"
        description="Connect data sources and map fields to your master tables"
      >
        {currentStep !== 'overview' && (
          <Button variant="outline" onClick={handleBack}>
            Back to Overview
          </Button>
        )}
      </PageHeader>

      <div className="p-8">
        <AnimatePresence mode="wait">
          {currentStep === 'overview' ? (
            <OverviewView key="overview" onStartWizard={handleStartWizard} />
          ) : (
            <WizardView
              key="wizard"
              currentStep={currentStep}
              onStepChange={setCurrentStep}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

function OverviewView({ onStartWizard }: { onStartWizard: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="space-y-8"
    >
      {/* Empty State / Getting Started */}
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-500/10 mb-6">
            <Database className="h-8 w-8 text-orange-500" />
          </div>
          <h2 className="text-xl font-semibold mb-2">No data sources connected</h2>
          <p className="text-muted-foreground text-center max-w-md mb-6">
            Connect your Google Sheets, forms, or other data sources to begin mapping
            fields to your Partner and Staff tables.
          </p>
          <Button onClick={onStartWizard} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Data Source
          </Button>
        </CardContent>
      </Card>

      {/* How it Works */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">How Data Enrichment Works</h3>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              step: 1,
              title: 'Connect Sources',
              description: 'Link your Google Sheets, forms, or APIs containing partner and staff data.',
              icon: FileSpreadsheet,
            },
            {
              step: 2,
              title: 'Map Fields',
              description: 'Walk through each field and map it to the right table and column.',
              icon: Settings,
            },
            {
              step: 3,
              title: 'Review & Commit',
              description: 'Preview changes in a staging area before committing to your master tables.',
              icon: CheckCircle2,
            },
          ].map((item) => {
            const Icon = item.icon
            return (
              <Card key={item.step} className="relative overflow-hidden">
                <div className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground">
                  {item.step}
                </div>
                <CardHeader className="pb-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 mb-2">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-base">{item.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>{item.description}</CardDescription>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Target Tables Info */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Your Master Tables</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-blue-500" />
                  Partners
                </CardTitle>
                <Badge variant="secondary">0 records</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                Client brands you manage. The core entity for all partner-related data.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {['brand_name', 'client_name', 'status', 'tier', 'base_fee'].map((field) => (
                  <Badge key={field} variant="outline" className="text-xs font-mono">
                    {field}
                  </Badge>
                ))}
                <Badge variant="outline" className="text-xs text-muted-foreground">
                  +12 more
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-green-500" />
                  Staff
                </CardTitle>
                <Badge variant="secondary">0 records</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                Team members at Sophie Society. Source of truth for all staff data.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {['full_name', 'email', 'role', 'department', 'status'].map((field) => (
                  <Badge key={field} variant="outline" className="text-xs font-mono">
                    {field}
                  </Badge>
                ))}
                <Badge variant="outline" className="text-xs text-muted-foreground">
                  +10 more
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </motion.div>
  )
}

function WizardView({
  currentStep,
  onStepChange,
}: {
  currentStep: WizardStep
  onStepChange: (step: WizardStep) => void
}) {
  const currentStepIndex = steps.findIndex((s) => s.id === currentStep)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="space-y-8"
    >
      {/* Step Indicator */}
      <div className="flex items-center justify-center">
        <div className="flex items-center gap-2">
          {steps.map((step, index) => {
            const isActive = step.id === currentStep
            const isCompleted = index < currentStepIndex

            return (
              <div key={step.id} className="flex items-center">
                <button
                  onClick={() => isCompleted && onStepChange(step.id as WizardStep)}
                  disabled={!isCompleted}
                  className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : isCompleted
                      ? 'bg-green-500/10 text-green-600 hover:bg-green-500/20'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : isActive ? (
                    <Circle className="h-4 w-4 fill-current" />
                  ) : (
                    <Circle className="h-4 w-4" />
                  )}
                  {step.label}
                </button>
                {index < steps.length - 1 && (
                  <div className={`mx-2 h-px w-8 ${
                    index < currentStepIndex ? 'bg-green-500' : 'bg-border'
                  }`} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Step Content */}
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-orange-500" />
            Connect Data Source
          </CardTitle>
          <CardDescription>
            Enter the URL of your Google Sheet to begin
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">Google Sheet URL</label>
            <div className="flex gap-2">
              <input
                type="url"
                placeholder="https://docs.google.com/spreadsheets/d/..."
                className="flex-1 rounded-lg border border-input bg-background px-4 py-2.5 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <Button className="shrink-0">
                Connect
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Make sure the sheet is shared with your service account or set to &quot;Anyone with the link can view&quot;
            </p>
          </div>

          <div className="rounded-lg border border-dashed border-border p-8 text-center">
            <FileSpreadsheet className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              Paste a Google Sheet URL above to preview its contents
            </p>
          </div>

          <div className="flex items-center justify-between pt-4 border-t">
            <Button variant="outline" onClick={() => onStepChange('overview')}>
              Cancel
            </Button>
            <Button disabled className="gap-2">
              Continue
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
