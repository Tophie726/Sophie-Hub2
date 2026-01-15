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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3, ease: easeOut }}
      className="space-y-8"
    >
      {/* Hero Section */}
      <div className="text-center max-w-2xl mx-auto space-y-4">
        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.3, ease: easeOut }}
          className="text-3xl font-bold tracking-tight"
        >
          Data Enrichment
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.3, ease: easeOut }}
          className="text-lg text-muted-foreground"
        >
          Connect your data sources and map them to your master tables.
          Start by selecting a category below.
        </motion.p>
      </div>

      {/* Category Cards */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        className="grid gap-6 md:grid-cols-3 max-w-5xl mx-auto"
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.3, ease: easeOut }}
        >
          <CategoryCard
            title="Google Sheets"
            description="Connect spreadsheets and map columns to your database tables"
            icon={FileSpreadsheet}
            iconColor="text-green-600"
            bgColor="bg-green-500/10"
            stats={sheetsStats || undefined}
            onClick={() => onSelectCategory('sheets')}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.3, ease: easeOut }}
        >
          <CategoryCard
            title="Google Forms"
            description="Import form responses and map them to entities"
            icon={FileText}
            iconColor="text-purple-600"
            bgColor="bg-purple-500/10"
            comingSoon
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.3, ease: easeOut }}
        >
          <CategoryCard
            title="Documents"
            description="Extract structured data from Google Docs"
            icon={FileQuestion}
            iconColor="text-blue-600"
            bgColor="bg-blue-500/10"
            comingSoon
          />
        </motion.div>
      </motion.div>

      {/* Quick Stats Footer */}
      {sheetsStats && sheetsStats.sources > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.3 }}
          className="text-center text-sm text-muted-foreground"
        >
          You have {sheetsStats.fields} fields mapped across {sheetsStats.tabs} tabs from {sheetsStats.sources} source{sheetsStats.sources !== 1 ? 's' : ''}
        </motion.div>
      )}
    </motion.div>
  )
}
