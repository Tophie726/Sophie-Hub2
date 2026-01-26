'use client'

import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import { Building2, Users, Package, ChevronDown, ChevronRight } from 'lucide-react'
import { motion } from 'framer-motion'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'
import { Badge } from '@/components/ui/badge'
import type { EntityType } from '@/types/entities'
import type { EntityNodeData, EntityFieldData } from './types'
import { getEntityTextColor, getEntityBgColor, getEntityBorderColor } from '../utils/colors'

const easeOut: [number, number, number, number] = [0.22, 1, 0.36, 1]

const ENTITY_ICONS: Record<EntityType, typeof Building2> = {
  partners: Building2,
  staff: Users,
  asins: Package,
}

/** Single field row with tooltip for source details */
function FieldRow({ field }: { field: EntityFieldData }) {
  const primarySource = field.sources[0]
  const authorityIcon = primarySource?.authority === 'source_of_truth' ? '⭐' : '📋'

  const row = (
    <div className="flex items-center gap-2 text-xs py-1 px-2 rounded-sm hover:bg-muted/50 transition-colors">
      {/* Mapped dot */}
      <div
        className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
          field.isMapped ? 'bg-green-500' : 'bg-muted-foreground/30'
        }`}
      />

      {/* Field label */}
      <span
        className={`truncate ${
          field.isMapped ? 'text-foreground' : 'text-muted-foreground'
        }`}
      >
        {field.label}
      </span>

      {/* Key badge */}
      {field.isKey && (
        <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 flex-shrink-0">
          Key
        </Badge>
      )}

      {/* Source badge + authority */}
      {field.sources.length > 0 ? (
        <span className="ml-auto flex items-center gap-1 flex-shrink-0">
          <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">
            {primarySource.sourceName}
          </span>
          <span className="text-[10px]">{authorityIcon}</span>
        </span>
      ) : (
        <span className="ml-auto text-[10px] text-muted-foreground/50">—</span>
      )}
    </div>
  )

  // Wrap in tooltip if there are sources to show
  if (field.sources.length === 0) return row

  return (
    <Tooltip>
      <TooltipTrigger asChild>{row}</TooltipTrigger>
      <TooltipContent side="right" className="max-w-xs">
        <div className="space-y-1">
          <p className="font-medium">{field.label}</p>
          {field.sources.map((s, i) => (
            <div key={i} className="text-[11px]">
              <span className="opacity-80">{s.sourceName}</span>
              <span className="opacity-50"> → {s.tabName}</span>
              <span className="opacity-50"> (col: {s.sourceColumn})</span>
              <span className="ml-1">
                {s.authority === 'source_of_truth' ? '⭐ Source of Truth' : '📋 Reference'}
              </span>
            </div>
          ))}
        </div>
      </TooltipContent>
    </Tooltip>
  )
}

function EntityNodeComponent({ data }: NodeProps) {
  const nodeData = data as unknown as EntityNodeData
  const {
    entityType,
    label,
    fieldCount,
    mappedFieldCount,
    isExpanded,
    onToggleExpand,
  } = nodeData

  const Icon = ENTITY_ICONS[entityType]
  const progress = fieldCount > 0 ? Math.round((mappedFieldCount / fieldCount) * 100) : 0
  const textColor = getEntityTextColor(entityType)
  const bgColor = getEntityBgColor(entityType)
  const borderColor = getEntityBorderColor(entityType)

  // SVG progress ring
  const radius = 16
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (progress / 100) * circumference

  return (
    <motion.div
      className={`relative rounded-xl border-2 bg-card shadow-sm cursor-pointer select-none ${borderColor}`}
      style={{ minWidth: 200 }}
      whileHover={{ scale: 1.02, y: -2 }}
      transition={{ duration: 0.2, ease: easeOut }}
      onClick={() => onToggleExpand(entityType)}
    >
      {/* Left handle - target for mapping edges (source → entity) */}
      <Handle
        type="target"
        position={Position.Left}
        id="mapping-target"
        className="!w-2 !h-2 !border-2 !border-background !bg-muted-foreground/50"
      />

      {/* Right handle - source for reference edges (entity → entity) */}
      <Handle
        type="source"
        position={Position.Right}
        id="ref-source"
        className="!w-2 !h-2 !border-2 !border-background !bg-muted-foreground/50"
        style={{ top: '40%' }}
      />

      {/* Right handle - target for incoming reference edges */}
      <Handle
        type="target"
        position={Position.Right}
        id="ref-target"
        className="!w-2 !h-2 !border-2 !border-background !bg-muted-foreground/50"
        style={{ top: '60%' }}
      />

      <div className="p-4">
        {/* Header row */}
        <div className="flex items-center gap-3">
          {/* Icon with progress ring */}
          <div className="relative flex-shrink-0">
            <svg width={40} height={40} className="absolute -inset-1">
              <circle
                cx={20}
                cy={20}
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                className="text-muted/30"
              />
              <circle
                cx={20}
                cy={20}
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                className={textColor}
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                transform="rotate(-90 20 20)"
                style={{ transition: 'stroke-dashoffset 400ms ease-out' }}
              />
            </svg>
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${bgColor}`}>
              <Icon className={`w-5 h-5 ${textColor}`} />
            </div>
          </div>

          {/* Label and stats */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm">{label}</h3>
              {isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
              )}
            </div>
            <p className="text-xs text-muted-foreground tabular-nums">
              {mappedFieldCount}/{fieldCount} fields mapped
            </p>
          </div>

          {/* Progress badge */}
          <div
            className={`text-xs font-medium tabular-nums px-2 py-0.5 rounded-full ${bgColor} ${textColor}`}
          >
            {progress}%
          </div>
        </div>

        {/* Expanded: show field-level detail per group */}
        {isExpanded && nodeData.groups.length > 0 && (
          <TooltipProvider delayDuration={200}>
            <div
              className="mt-3 pt-3 border-t border-border/50 overflow-y-auto"
              style={{ maxHeight: 400 }}
              onClick={(e) => e.stopPropagation()}
            >
              {nodeData.groups.map((group) => (
                <div key={group.name}>
                  {/* Group header */}
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 pt-2 pb-1 px-2 font-medium">
                    {group.name}
                    <span className="ml-1 tabular-nums">
                      {group.mappedFieldCount}/{group.fieldCount}
                    </span>
                  </div>

                  {/* Field rows */}
                  {group.fields?.map((field: EntityFieldData) => (
                    <FieldRow
                      key={field.name}
                      field={field}
                    />
                  ))}
                </div>
              ))}
            </div>
          </TooltipProvider>
        )}
      </div>
    </motion.div>
  )
}

export const EntityNode = memo(EntityNodeComponent)
