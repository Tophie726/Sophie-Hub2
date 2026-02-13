'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { CategoryCard } from './category-card'
import { SlackIcon } from '@/components/icons/slack-icon'
import { RoamIcon } from '@/components/icons/roam-icon'
import { SupTaskIcon } from '@/components/icons/suptask-icon'
import { CloseIcon } from '@/components/icons/close-icon'
import { NotionIcon } from '@/components/icons/notion-icon'
import { BigQueryIcon } from '@/components/icons/bigquery-icon'
import { GoogleSheetsIcon } from '@/components/icons/google-sheets-icon'
import { GoogleFormsIcon } from '@/components/icons/google-forms-icon'
import { GoogleDocsIcon } from '@/components/icons/google-docs-icon'
import { GoogleWorkspaceIcon } from '@/components/icons/google-workspace-icon'
import { XeroIcon } from '@/components/icons/xero-icon'
import { ZohoIcon } from '@/components/icons/zoho-icon'
import { SignWellIcon } from '@/components/icons/signwell-icon'
import { DocuSignIcon } from '@/components/icons/docusign-icon'
import { TikTokShopIcon } from '@/components/icons/tiktok-shop-icon'
import { CanvaIcon } from '@/components/icons/canva-icon'
import { TeamtailorIcon } from '@/components/icons/teamtailor-icon'

interface DataSourceStats {
  sources: number
  tabs: number
  fields: number
}

interface CategoryHubProps {
  onSelectCategory: (category: 'sheets' | 'forms' | 'docs' | 'bigquery' | 'slack' | 'google_workspace' | 'suptask') => void
}

const easeOut: [number, number, number, number] = [0.22, 1, 0.36, 1]

export function CategoryHub({ onSelectCategory }: CategoryHubProps) {
  const [sheetsStats, setSheetsStats] = useState<DataSourceStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      try {
        const response = await fetch('/api/data-sources')
        if (response.ok) {
          const json = await response.json()
          // Handle both old format and new standardized format
          const sources = json.data?.sources || json.sources || []
          setSheetsStats({
            sources: sources.length,
            tabs: sources.reduce((sum: number, s: { tabCount: number }) => sum + s.tabCount, 0),
            fields: sources.reduce((sum: number, s: { mappedFieldsCount: number }) => sum + s.mappedFieldsCount, 0),
          })
        }
      } catch (error) {
        console.error('Error fetching stats:', error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchStats()
  }, [])

  if (isLoading) {
    return (
      <div className="space-y-8">
        {/* Hero skeleton */}
        <div className="text-center max-w-2xl mx-auto space-y-3 md:space-y-4 px-4">
          <div className="h-8 md:h-9 w-48 mx-auto rounded-lg bg-muted/40 animate-pulse" />
          <div className="space-y-2">
            <div className="h-5 w-80 mx-auto rounded bg-muted/30 animate-pulse" style={{ animationDelay: '75ms' }} />
            <div className="h-5 w-56 mx-auto rounded bg-muted/30 animate-pulse" style={{ animationDelay: '150ms' }} />
          </div>
        </div>

        {/* Card grid skeleton — matches real 3-col layout */}
        <div className="grid gap-4 md:gap-6 md:grid-cols-2 lg:grid-cols-3 max-w-4xl mx-auto px-4 md:px-0">
          {Array.from({ length: 17 }, (_, i) => (
            <div
              key={i}
              className="p-5 md:p-8 rounded-2xl border border-border/40 bg-card"
            >
              {/* Icon placeholder */}
              <div
                className="h-12 w-12 md:h-16 md:w-16 rounded-xl md:rounded-2xl bg-muted/30 mb-4 md:mb-6 animate-pulse"
                style={{ animationDelay: `${i * 60}ms` }}
              />
              {/* Title */}
              <div
                className="h-5 md:h-6 w-32 rounded bg-muted/40 mb-2 animate-pulse"
                style={{ animationDelay: `${i * 60 + 30}ms` }}
              />
              {/* Description */}
              <div className="space-y-1.5 mb-4 md:mb-6">
                <div
                  className="h-3.5 w-full rounded bg-muted/25 animate-pulse"
                  style={{ animationDelay: `${i * 60 + 60}ms` }}
                />
                <div
                  className="h-3.5 w-3/4 rounded bg-muted/25 animate-pulse"
                  style={{ animationDelay: `${i * 60 + 90}ms` }}
                />
              </div>
              {/* Stats / CTA placeholder */}
              <div
                className="h-4 w-24 rounded bg-muted/20 animate-pulse"
                style={{ animationDelay: `${i * 60 + 120}ms` }}
              />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: easeOut }}
      className="space-y-8"
    >
      {/* Hero Section */}
      <div className="text-center max-w-2xl mx-auto space-y-3 md:space-y-4 px-4">
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
          Data Enrichment
        </h2>
        <p className="text-base md:text-lg text-muted-foreground">
          Connect your data sources and map them to your master tables.
          Start by selecting a category below.
        </p>
      </div>

      {/* Category Cards */}
      <div className="grid gap-4 md:gap-6 md:grid-cols-2 lg:grid-cols-3 max-w-4xl mx-auto px-4 md:px-0">
        <CategoryCard
          title="Google Sheets"
          description="Connect spreadsheets and map columns to your database tables"
          icon={GoogleSheetsIcon}
          iconColor=""
          bgColor="bg-green-500/10"
          stats={sheetsStats || undefined}
          onClick={() => onSelectCategory('sheets')}
        />

        <CategoryCard
          title="BigQuery"
          description="Amazon advertising and sales data from BigQuery"
          icon={BigQueryIcon}
          iconColor=""
          bgColor="bg-blue-500/10"
          onClick={() => onSelectCategory('bigquery')}
        />

        <CategoryCard
          title="Slack"
          description="Map staff and channels, track response times"
          icon={SlackIcon}
          iconColor=""
          bgColor="bg-[#611f69]/10"
          onClick={() => onSelectCategory('slack')}
        />

        <CategoryCard
          title="Google Workspace"
          description="Sync directory users and enrich staff profiles"
          icon={GoogleWorkspaceIcon}
          iconColor=""
          bgColor="bg-indigo-500/10"
          onClick={() => onSelectCategory('google_workspace')}
        />

        <CategoryCard
          title="Ro.am"
          description="Virtual office activity and attendance signals"
          icon={RoamIcon}
          iconColor=""
          bgColor="bg-zinc-500/10"
          comingSoon
        />

        <CategoryCard
          title="SupTask"
          description="Ticket workload and support operations data"
          icon={SupTaskIcon}
          iconColor=""
          bgColor="bg-cyan-500/10"
          onClick={() => onSelectCategory('suptask')}
        />

        <CategoryCard
          title="Close.io"
          description="CRM outreach and opportunity activity enrichment"
          icon={CloseIcon}
          iconColor=""
          bgColor="bg-sky-500/10"
          comingSoon
        />

        <CategoryCard
          title="Notion"
          description="Docs, projects, and operating knowledge signals"
          icon={NotionIcon}
          iconColor=""
          bgColor="bg-zinc-500/10"
          comingSoon
        />

        <CategoryCard
          title="Google Forms"
          description="Import form responses and map them to entities"
          icon={GoogleFormsIcon}
          iconColor=""
          bgColor="bg-purple-500/10"
          comingSoon
        />

        <CategoryCard
          title="Documents"
          description="Extract structured data from Google Docs"
          icon={GoogleDocsIcon}
          iconColor=""
          bgColor="bg-blue-500/10"
          comingSoon
        />

        <CategoryCard
          title="Xero"
          description="Accounting and bookkeeping activity enrichment"
          icon={XeroIcon}
          iconColor=""
          bgColor="bg-sky-500/10"
          comingSoon
        />

        <CategoryCard
          title="Zoho"
          description="CRM and back-office records enrichment"
          icon={ZohoIcon}
          iconColor=""
          bgColor="bg-orange-500/10"
          comingSoon
        />

        <CategoryCard
          title="SignWell"
          description="eSignature workflow and document status signals"
          icon={SignWellIcon}
          iconColor=""
          bgColor="bg-emerald-500/10"
          comingSoon
        />

        <CategoryCard
          title="DocuSign"
          description="Contract signatures and envelope status signals"
          icon={DocuSignIcon}
          iconColor=""
          bgColor="bg-blue-500/10"
          comingSoon
        />

        <CategoryCard
          title="TikTok Shop"
          description="Storefront orders and creator commerce signals"
          icon={TikTokShopIcon}
          iconColor=""
          bgColor="bg-neutral-500/10"
          comingSoon
        />

        <CategoryCard
          title="Canva"
          description="Design publishing and creative asset workflow signals"
          icon={CanvaIcon}
          iconColor=""
          bgColor="bg-cyan-500/10"
          comingSoon
        />

        <CategoryCard
          title="Teamtailor"
          description="Hiring pipeline, applicants, and recruiting operations signals"
          icon={TeamtailorIcon}
          iconColor=""
          bgColor="bg-pink-500/10"
          comingSoon
        />
      </div>

      {/* Quick Stats Footer */}
      {sheetsStats && sheetsStats.sources > 0 && (
        <p className="text-center text-sm text-muted-foreground px-4">
          You have <span className="font-medium tabular-nums">{sheetsStats.fields}</span> fields mapped across{' '}
          <span className="font-medium tabular-nums">{sheetsStats.tabs}</span> tabs from{' '}
          <span className="font-medium tabular-nums">{sheetsStats.sources}</span> source{sheetsStats.sources !== 1 ? 's' : ''}
        </p>
      )}
    </motion.div>
  )
}
