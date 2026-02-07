'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ChevronRight,
  FileSpreadsheet,
  FormInput,
  Plug,
  Star,
  BookOpen,
  Users,
  Package,
  ArrowRight,
  Search,
  X,
  ArrowLeftRight,
  Network,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ShimmerBar, ShimmerGrid } from '@/components/ui/shimmer-grid'
import { cn } from '@/lib/utils'
import { useFlowData } from './hooks/useFlowData'
import type { EntityType } from '@/types/entities'

const easeOut: [number, number, number, number] = [0.22, 1, 0.36, 1]

interface DataFlowMapProps {
  onBack: () => void
}

const entityInfo: Record<EntityType, { label: string; icon: typeof Users; color: string }> = {
  partners: { label: 'Partners', icon: Users, color: 'blue' },
  staff: { label: 'Staff', icon: Users, color: 'green' },
  asins: { label: 'ASINs', icon: Package, color: 'purple' },
}

const sourceTypeIcons: Record<string, typeof FileSpreadsheet> = {
  google_sheet: FileSpreadsheet,
  form: FormInput,
  api: Plug,
}

const sourceTypeLabels: Record<string, string> = {
  google_sheet: 'Google Sheet',
  form: 'Form',
  api: 'API',
}

type ViewMode = 'sources' | 'fields'

/**
 * Data Flow Map - Settings-style visualization of data sources and their mappings.
 * Shows which external sources feed into which entities and fields.
 */
export function DataFlowMap({ onBack }: DataFlowMapProps) {
  const { data, isLoading, error, refresh } = useFlowData()
  const [expandedSource, setExpandedSource] = useState<string | null>(null)
  const [expandedEntity, setExpandedEntity] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('sources')
  const [filterEntity, setFilterEntity] = useState<EntityType | null>(null)

  // Transform API data into source-centric view
  const transformedSources = useMemo(() => {
    if (!data) return []

    return data.sources.map((source) => {
      // Build entity mappings for this source
      const entityMappings: Record<EntityType, {
        fieldCount: number
        authority: 'source_of_truth' | 'reference' | 'mixed'
        fields: Array<{
          source: string
          target: string
          authority: string
        }>
      }> = {
        partners: { fieldCount: 0, authority: 'reference', fields: [] },
        staff: { fieldCount: 0, authority: 'reference', fields: [] },
        asins: { fieldCount: 0, authority: 'reference', fields: [] },
      }

      // Collect fields from each entity that come from this source
      for (const entity of data.entities) {
        for (const group of entity.groups) {
          for (const field of group.fields) {
            const sourcesForField = field.sources.filter((s) => s.sourceId === source.id)
            if (sourcesForField.length > 0) {
              const mapping = entityMappings[entity.type]
              mapping.fieldCount++

              for (const src of sourcesForField) {
                mapping.fields.push({
                  source: src.sourceColumn,
                  target: field.name,
                  authority: src.authority,
                })

                // Determine overall authority
                if (src.authority === 'source_of_truth') {
                  if (mapping.authority === 'reference') {
                    mapping.authority = 'source_of_truth'
                  } else if (mapping.authority !== 'source_of_truth') {
                    mapping.authority = 'mixed'
                  }
                }
              }
            }
          }
        }
      }

      // Filter to only entities with actual mappings
      const mappings = (['partners', 'staff', 'asins'] as EntityType[])
        .filter((e) => entityMappings[e].fieldCount > 0)
        .map((e) => ({
          entity: e,
          ...entityMappings[e],
        }))

      // Calculate total records from tabs
      const totalMapped = source.tabs.reduce((sum, t) => sum + t.mappedCount, 0)

      return {
        id: source.id,
        name: source.name,
        type: source.type,
        tabCount: source.tabs.length,
        totalMapped,
        mappings,
      }
    })
  }, [data])

  // Filter sources based on search and entity filter
  const filteredSources = useMemo(() => {
    return transformedSources.filter((source) => {
      // Entity filter
      if (filterEntity && !source.mappings.some((m) => m.entity === filterEntity)) {
        return false
      }
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchesName = source.name.toLowerCase().includes(query)
        const matchesField = source.mappings.some((m) =>
          m.fields.some(
            (f) =>
              f.source.toLowerCase().includes(query) ||
              f.target.toLowerCase().includes(query)
          )
        )
        return matchesName || matchesField
      }
      return true
    })
  }, [transformedSources, searchQuery, filterEntity])

  // Build reverse lookup: field -> sources
  const fieldToSources = useMemo(() => {
    if (!data) return {}

    const map: Record<string, Array<{
      source: string
      sourceId: string
      column: string
      authority: string
      entity: EntityType
    }>> = {}

    for (const entity of data.entities) {
      for (const group of entity.groups) {
        for (const field of group.fields) {
          for (const src of field.sources) {
            const key = `${entity.type}:${field.name}`
            if (!map[key]) {
              map[key] = []
            }
            map[key].push({
              source: src.sourceName,
              sourceId: src.sourceId,
              column: src.sourceColumn,
              authority: src.authority,
              entity: entity.type,
            })
          }
        }
      }
    }

    return map
  }, [data])

  // Get all mapped fields for reverse view
  const allMappedFields = useMemo(() => {
    const fields = Object.keys(fieldToSources).sort()
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return fields.filter((f) => f.toLowerCase().includes(query))
    }
    return fields
  }, [fieldToSources, searchQuery])

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-3 px-4 py-3 border-b">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5"
            onClick={onBack}
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back</span>
          </Button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Network className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <ShimmerBar width={128} height={14} />
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <ShimmerBar width={92} height={12} />
            <ShimmerBar width={84} height={12} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto py-6 px-4 space-y-6">
            <div className="rounded-xl border bg-card p-4">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                {Array.from({ length: 4 }, (_, i) => (
                  <div key={i} className="rounded-lg border bg-background/30 p-3 space-y-2">
                    <ShimmerBar width={40} height={40} className="rounded-lg" />
                    <ShimmerBar width="70%" height={12} />
                    <ShimmerBar width="45%" height={10} />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <ShimmerBar width="100%" height={36} className="rounded-lg" />
              <ShimmerBar width={112} height={36} className="rounded-lg hidden sm:block" />
            </div>

            <div className="rounded-xl border bg-card p-4">
              <ShimmerGrid variant="list" rows={7} cellHeight={56} gap={10} />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <p className="text-muted-foreground">{error}</p>
        <Button variant="outline" onClick={refresh}>
          Try Again
        </Button>
      </div>
    )
  }

  if (!data) return null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: easeOut }}
      className="flex flex-col h-full"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5"
          onClick={onBack}
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Back</span>
        </Button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Network className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <h2 className="font-semibold text-sm truncate">Data Flow Map</h2>
        </div>
        {/* Stats badges */}
        <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
          <span className="tabular-nums">
            {data.stats.mappedFields}/{data.stats.totalFields} fields
          </span>
          <span className="text-border">|</span>
          <span className="tabular-nums">
            {data.stats.totalSources} source{data.stats.totalSources !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto py-6 px-4">
          {/* Simple Entity Diagram */}
          <div className="mb-6 p-4 rounded-xl border bg-card">
            <div className="flex items-center justify-center gap-3 overflow-x-auto py-2">
              {/* Sources */}
              <div className="flex flex-col items-center gap-1 min-w-[80px]">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-600">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <span className="text-xs font-medium">Sources</span>
                <span className="text-xs text-muted-foreground">{data.stats.totalSources}</span>
              </div>

              {/* Arrow */}
              <div className="flex items-center text-muted-foreground/50">
                <div className="w-6 h-px bg-current" />
                <ArrowRight className="h-3 w-3 -ml-1" />
              </div>

              {/* Entities */}
              {(['partners', 'staff', 'asins'] as EntityType[]).map((entityType) => {
                const info = entityInfo[entityType]
                const Icon = info.icon
                const entityData = data.entities.find((e) => e.type === entityType)
                const _sourceCount = transformedSources.filter((s) =>
                  s.mappings.some((m) => m.entity === entityType)
                ).length
                void _sourceCount // reserved for future badge display

                return (
                  <div
                    key={entityType}
                    className={cn(
                      "flex flex-col items-center gap-1 min-w-[80px] p-2 rounded-lg cursor-pointer transition-colors",
                      filterEntity === entityType
                        ? info.color === 'blue' && 'bg-blue-100 dark:bg-blue-900/30'
                        : 'hover:bg-muted/50',
                      filterEntity === entityType && info.color === 'green' && 'bg-green-100 dark:bg-green-900/30',
                      filterEntity === entityType && info.color === 'purple' && 'bg-purple-100 dark:bg-purple-900/30'
                    )}
                    onClick={() => setFilterEntity(filterEntity === entityType ? null : entityType)}
                  >
                    <div
                      className={cn(
                        'flex items-center justify-center w-10 h-10 rounded-lg',
                        info.color === 'blue' && 'bg-blue-100 dark:bg-blue-900/30 text-blue-600',
                        info.color === 'green' && 'bg-green-100 dark:bg-green-900/30 text-green-600',
                        info.color === 'purple' && 'bg-purple-100 dark:bg-purple-900/30 text-purple-600'
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="text-xs font-medium">{info.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {entityData?.mappedFieldCount || 0}/{entityData?.fieldCount || 0}
                    </span>
                  </div>
                )
              })}
            </div>
            {filterEntity && (
              <div className="flex justify-center mt-2">
                <button
                  onClick={() => setFilterEntity(null)}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  <X className="h-3 w-3" />
                  Clear filter
                </button>
              </div>
            )}
          </div>

          {/* Search and View Toggle */}
          <div className="flex items-center gap-3 mb-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder={viewMode === 'sources' ? "Search sources or fields..." : "Search fields..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* View Toggle */}
            <div className="flex items-center rounded-lg border bg-muted/50 p-1">
              <button
                onClick={() => setViewMode('sources')}
                className={cn(
                  "px-3 py-1.5 text-sm rounded-md transition-colors",
                  viewMode === 'sources'
                    ? 'bg-background shadow-sm font-medium'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                By Source
              </button>
              <button
                onClick={() => setViewMode('fields')}
                className={cn(
                  "px-3 py-1.5 text-sm rounded-md transition-colors flex items-center gap-1.5",
                  viewMode === 'fields'
                    ? 'bg-background shadow-sm font-medium'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <ArrowLeftRight className="h-3.5 w-3.5" />
                By Field
              </button>
            </div>
          </div>

          {/* Main Content */}
          {viewMode === 'sources' ? (
            /* Sources View */
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  Connected Sources
                  {filterEntity && (
                    <span className="ml-2 normal-case">
                      → {entityInfo[filterEntity].label}
                    </span>
                  )}
                </h3>
                <span className="text-sm text-muted-foreground">
                  {filteredSources.length} source{filteredSources.length !== 1 ? 's' : ''}
                </span>
              </div>

              {filteredSources.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Search className="h-8 w-8 mx-auto mb-3 opacity-50" />
                  <p>No sources match your search</p>
                </div>
              ) : (
                filteredSources.map((source) => {
                  const SourceIcon = sourceTypeIcons[source.type] || FileSpreadsheet
                  const isExpanded = expandedSource === source.id

                  return (
                    <div key={source.id} className="border rounded-lg bg-card overflow-hidden">
                      {/* Source Header Row */}
                      <button
                        onClick={() => setExpandedSource(isExpanded ? null : source.id)}
                        className="w-full flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors text-left"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="p-2 rounded-lg bg-muted">
                            <SourceIcon className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium truncate">{source.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {sourceTypeLabels[source.type] || source.type} · {source.tabCount} tab{source.tabCount !== 1 ? 's' : ''}
                            </div>
                          </div>
                        </div>

                        {/* Mapped Entities Pills */}
                        <div className="hidden sm:flex items-center gap-2">
                          {source.mappings.map((mapping) => {
                            const info = entityInfo[mapping.entity]
                            return (
                              <div
                                key={mapping.entity}
                                className={cn(
                                  'flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium',
                                  info.color === 'blue' && 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
                                  info.color === 'green' && 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300',
                                  info.color === 'purple' && 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300'
                                )}
                              >
                                {mapping.authority === 'source_of_truth' && (
                                  <Star className="h-3 w-3 fill-current" />
                                )}
                                {mapping.authority === 'reference' && (
                                  <BookOpen className="h-3 w-3" />
                                )}
                                {info.label}
                                <span className="opacity-70">{mapping.fieldCount}</span>
                              </div>
                            )
                          })}
                        </div>

                        {/* Expand Arrow */}
                        <motion.div
                          initial={false}
                          animate={{ rotate: isExpanded ? 90 : 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        </motion.div>
                      </button>

                      {/* Expanded Detail */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="border-t bg-muted/30 p-4 space-y-3">
                              {source.mappings.map((mapping) => {
                                const info = entityInfo[mapping.entity]
                                const Icon = info.icon
                                const entityKey = `${source.id}-${mapping.entity}`
                                const isEntityExpanded = expandedEntity === entityKey

                                return (
                                  <div
                                    key={mapping.entity}
                                    className="bg-card rounded-lg border overflow-hidden"
                                  >
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setExpandedEntity(isEntityExpanded ? null : entityKey)
                                      }}
                                      className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors text-left"
                                    >
                                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                      <div
                                        className={cn(
                                          'p-1.5 rounded',
                                          info.color === 'blue' && 'bg-blue-100 text-blue-600 dark:bg-blue-900/50',
                                          info.color === 'green' && 'bg-green-100 text-green-600 dark:bg-green-900/50',
                                          info.color === 'purple' && 'bg-purple-100 text-purple-600 dark:bg-purple-900/50'
                                        )}
                                      >
                                        <Icon className="h-4 w-4" />
                                      </div>
                                      <div className="flex-1">
                                        <span className="font-medium">{info.label}</span>
                                        <span className="text-muted-foreground ml-2 text-sm">
                                          {mapping.fieldCount} fields mapped
                                        </span>
                                      </div>
                                      <div
                                        className={cn(
                                          'flex items-center gap-1 text-xs px-2 py-0.5 rounded',
                                          mapping.authority === 'source_of_truth'
                                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'
                                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                        )}
                                      >
                                        {mapping.authority === 'source_of_truth' ? (
                                          <>
                                            <Star className="h-3 w-3 fill-current" />
                                            Source of Truth
                                          </>
                                        ) : (
                                          <>
                                            <BookOpen className="h-3 w-3" />
                                            Reference
                                          </>
                                        )}
                                      </div>
                                      <motion.div
                                        initial={false}
                                        animate={{ rotate: isEntityExpanded ? 90 : 0 }}
                                        transition={{ duration: 0.15 }}
                                      >
                                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                      </motion.div>
                                    </button>

                                    {/* Field Mappings Table */}
                                    <AnimatePresence>
                                      {isEntityExpanded && (
                                        <motion.div
                                          initial={{ height: 0, opacity: 0 }}
                                          animate={{ height: 'auto', opacity: 1 }}
                                          exit={{ height: 0, opacity: 0 }}
                                          transition={{ duration: 0.15 }}
                                          className="overflow-hidden"
                                        >
                                          <div className="border-t bg-muted/20 p-3">
                                            <table className="w-full text-sm">
                                              <thead>
                                                <tr className="text-muted-foreground text-xs uppercase">
                                                  <th className="text-left pb-2 font-medium">Source Column</th>
                                                  <th className="text-center pb-2 font-medium w-12"></th>
                                                  <th className="text-left pb-2 font-medium">Target Field</th>
                                                  <th className="text-right pb-2 font-medium">Authority</th>
                                                </tr>
                                              </thead>
                                              <tbody className="divide-y divide-border/50">
                                                {mapping.fields.slice(0, 10).map((field, i) => (
                                                  <tr key={i}>
                                                    <td className="py-2 font-mono text-xs">{field.source}</td>
                                                    <td className="py-2 text-center">
                                                      <ArrowRight className="h-3 w-3 text-muted-foreground inline" />
                                                    </td>
                                                    <td className="py-2 font-mono text-xs text-blue-600 dark:text-blue-400">
                                                      {field.target}
                                                    </td>
                                                    <td className="py-2 text-right">
                                                      {field.authority === 'source_of_truth' ? (
                                                        <Star className="h-3 w-3 text-amber-500 fill-current inline" />
                                                      ) : (
                                                        <BookOpen className="h-3 w-3 text-slate-400 inline" />
                                                      )}
                                                    </td>
                                                  </tr>
                                                ))}
                                              </tbody>
                                            </table>
                                            {mapping.fields.length > 10 && (
                                              <div className="text-xs text-muted-foreground mt-2 pt-2 border-t">
                                                + {mapping.fields.length - 10} more fields
                                              </div>
                                            )}
                                          </div>
                                        </motion.div>
                                      )}
                                    </AnimatePresence>
                                  </div>
                                )
                              })}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )
                })
              )}
            </div>
          ) : (
            /* Fields View (Reverse Lookup) */
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  Mapped Fields & Their Sources
                </h3>
                <span className="text-sm text-muted-foreground">
                  {allMappedFields.length} field{allMappedFields.length !== 1 ? 's' : ''}
                </span>
              </div>

              {allMappedFields.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Search className="h-8 w-8 mx-auto mb-3 opacity-50" />
                  <p>No mapped fields found</p>
                </div>
              ) : (
                <div className="border rounded-lg bg-card divide-y">
                  {allMappedFields.map((fieldKey) => {
                    const [entity, fieldName] = fieldKey.split(':') as [EntityType, string]
                    const sources = fieldToSources[fieldKey]
                    const info = entityInfo[entity]

                    return (
                      <div key={fieldKey} className="flex items-center gap-4 p-3 hover:bg-muted/30 transition-colors">
                        <div
                          className={cn(
                            'p-1 rounded flex-shrink-0',
                            info.color === 'blue' && 'bg-blue-100 text-blue-600 dark:bg-blue-900/50',
                            info.color === 'green' && 'bg-green-100 text-green-600 dark:bg-green-900/50',
                            info.color === 'purple' && 'bg-purple-100 text-purple-600 dark:bg-purple-900/50'
                          )}
                        >
                          <info.icon className="h-3 w-3" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-mono text-sm text-blue-600 dark:text-blue-400">
                            {fieldName}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap justify-end">
                          {sources.map((src, i) => (
                            <div
                              key={i}
                              className={cn(
                                'flex items-center gap-1.5 px-2 py-1 rounded text-xs',
                                src.authority === 'source_of_truth'
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300'
                                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                              )}
                            >
                              {src.authority === 'source_of_truth' ? (
                                <Star className="h-3 w-3 fill-current" />
                              ) : (
                                <BookOpen className="h-3 w-3" />
                              )}
                              <span className="truncate max-w-[100px]">{src.source}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Legend */}
          <div className="mt-6 p-4 rounded-lg bg-muted/50 border">
            <h3 className="text-sm font-medium mb-2">Legend</h3>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 text-amber-500 fill-current" />
                <span className="text-muted-foreground">Source of Truth</span>
              </div>
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-slate-400" />
                <span className="text-muted-foreground">Reference</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
