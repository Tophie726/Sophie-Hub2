'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { FileSpreadsheet, FileText, FileQuestion, Loader2 } from 'lucide-react'
import { CategoryCard } from './category-card'

interface DataSourceStats {
  sources: number
  tabs: number
  fields: number
}

interface CategoryHubProps {
  onSelectCategory: (category: 'sheets' | 'forms' | 'docs') => void
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
          const data = await response.json()
          const sources = data.sources || []
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
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
      <div className="grid gap-4 md:gap-6 md:grid-cols-3 max-w-5xl mx-auto px-4 md:px-0">
        <CategoryCard
          title="Google Sheets"
          description="Connect spreadsheets and map columns to your database tables"
          icon={FileSpreadsheet}
          iconColor="text-green-600"
          bgColor="bg-green-500/10"
          stats={sheetsStats || undefined}
          onClick={() => onSelectCategory('sheets')}
        />

        <CategoryCard
          title="Google Forms"
          description="Import form responses and map them to entities"
          icon={FileText}
          iconColor="text-purple-600"
          bgColor="bg-purple-500/10"
          comingSoon
        />

        <CategoryCard
          title="Documents"
          description="Extract structured data from Google Docs"
          icon={FileQuestion}
          iconColor="text-blue-600"
          bgColor="bg-blue-500/10"
          comingSoon
        />
      </div>

      {/* Quick Stats Footer */}
      {sheetsStats && sheetsStats.sources > 0 && (
        <p className="text-center text-sm text-muted-foreground">
          You have {sheetsStats.fields} fields mapped across {sheetsStats.tabs} tabs from {sheetsStats.sources} source{sheetsStats.sources !== 1 ? 's' : ''}
        </p>
      )}
    </motion.div>
  )
}
