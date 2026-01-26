'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Building2,
  Users,
  Package,
  FileSpreadsheet,
  ChevronDown,
  ChevronRight,
  ArrowRight,
} from 'lucide-react'
import type { EntityType } from '@/types/entities'
import type { FlowMapResponse } from './utils/transform'
import { getEntityTextColor, getEntityBgColor } from './utils/colors'

const easeOut: [number, number, number, number] = [0.22, 1, 0.36, 1]

const ENTITY_ICONS: Record<EntityType, typeof Building2> = {
  partners: Building2,
  staff: Users,
  asins: Package,
}

const ENTITY_LABELS: Record<EntityType, string> = {
  partners: 'Partners',
  staff: 'Staff',
  asins: 'ASINs',
}

interface MobileFlowListProps {
  data: FlowMapResponse
}

/**
 * Mobile card layout for the Data Flow Map.
 * Hierarchical expandable sections instead of canvas.
 */
export function MobileFlowList({ data }: MobileFlowListProps) {
  const [expandedEntities, setExpandedEntities] = useState<Set<EntityType>>(new Set())

  const toggleEntity = (entity: EntityType) => {
    setExpandedEntities((prev) => {
      const next = new Set(prev)
      if (next.has(entity)) {
        next.delete(entity)
      } else {
        next.add(entity)
      }
      return next
    })
  }

  return (
    <div className="space-y-4 px-4 pb-8">
      {/* Stats summary */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Total Fields"
          value={data.stats.totalFields}
          accent="text-foreground"
        />
        <StatCard
          label="Mapped"
          value={data.stats.mappedFields}
          accent="text-green-500"
        />
        <StatCard
          label="Sources"
          value={data.stats.totalSources}
          accent="text-foreground"
        />
        <StatCard
          label="Tabs"
          value={data.stats.totalTabs}
          accent="text-foreground"
        />
      </div>

      {/* Sources section */}
      {data.sources.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
            Data Sources
          </h3>
          {data.sources.map((source) => (
            <div
              key={source.id}
              className="rounded-xl border bg-card p-3 flex items-center gap-3"
            >
              <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-green-500/10 flex-shrink-0">
                <FileSpreadsheet className="w-4.5 h-4.5 text-green-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{source.name}</p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {source.tabs.length} tab{source.tabs.length !== 1 ? 's' : ''}
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground/50 flex-shrink-0" />
            </div>
          ))}
        </section>
      )}

      {/* Entities section */}
      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
          Entities
        </h3>
        {data.entities.map((entity) => {
          const entityType = entity.type as EntityType
          const Icon = ENTITY_ICONS[entityType]
          const textColor = getEntityTextColor(entityType)
          const bgColor = getEntityBgColor(entityType)
          const isExpanded = expandedEntities.has(entityType)
          const progress =
            entity.fieldCount > 0
              ? Math.round((entity.mappedFieldCount / entity.fieldCount) * 100)
              : 0

          return (
            <div key={entity.type} className="rounded-xl border bg-card overflow-hidden">
              {/* Entity header - clickable */}
              <button
                className="w-full p-4 flex items-center gap-3 text-left active:scale-[0.99] transition-transform"
                onClick={() => toggleEntity(entityType)}
              >
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center ${bgColor} flex-shrink-0`}
                >
                  <Icon className={`w-5 h-5 ${textColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-sm">
                      {ENTITY_LABELS[entityType]}
                    </h4>
                    <span className={`text-xs font-medium tabular-nums px-1.5 py-0.5 rounded-full ${bgColor} ${textColor}`}>
                      {progress}%
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {entity.mappedFieldCount}/{entity.fieldCount} fields mapped
                  </p>
                </div>
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                )}
              </button>

              {/* Expanded groups */}
              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: easeOut }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 space-y-2 border-t border-border/50 pt-3">
                      {entity.groups.map((group) => {
                        const groupProgress =
                          group.fields.length > 0
                            ? Math.round(
                                (group.fields.filter((f) => f.isMapped).length /
                                  group.fields.length) *
                                  100
                              )
                            : 0

                        return (
                          <div
                            key={group.name}
                            className="flex items-center justify-between py-1.5"
                          >
                            <span className="text-xs text-muted-foreground">
                              {group.name}
                            </span>
                            <div className="flex items-center gap-2">
                              <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    entityType === 'partners'
                                      ? 'bg-blue-500'
                                      : entityType === 'staff'
                                        ? 'bg-green-500'
                                        : 'bg-orange-500'
                                  }`}
                                  style={{ width: `${groupProgress}%` }}
                                />
                              </div>
                              <span className="text-[10px] text-muted-foreground tabular-nums w-8 text-right">
                                {group.fields.filter((f) => f.isMapped).length}/
                                {group.fields.length}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </section>

      {/* Relationships section */}
      {data.relationships.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
            Relationships
          </h3>
          <div className="rounded-xl border bg-card p-3 space-y-2">
            {/* Deduplicate relationships by entity pair */}
            {deduplicateRelationships(data.relationships).map((rel, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="font-medium capitalize">{rel.from}</span>
                <div className="flex-1 border-t border-dashed border-muted-foreground/30" />
                <span className="text-muted-foreground">ref</span>
                <div className="flex-1 border-t border-dashed border-muted-foreground/30" />
                <span className="font-medium capitalize">{rel.to}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string
  value: number
  accent: string
}) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-xl font-bold tabular-nums ${accent}`}>{value}</p>
    </div>
  )
}

function deduplicateRelationships(
  relationships: FlowMapResponse['relationships']
): Array<{ from: string; to: string }> {
  const seen = new Set<string>()
  const result: Array<{ from: string; to: string }> = []

  for (const rel of relationships) {
    const key = `${rel.from.entity}-${rel.to.entity}`
    if (!seen.has(key)) {
      seen.add(key)
      result.push({ from: rel.from.entity, to: rel.to.entity })
    }
  }

  return result
}
