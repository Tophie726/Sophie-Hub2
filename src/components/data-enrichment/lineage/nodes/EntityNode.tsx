'use client'

import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import { Building2, Users, Package, ChevronDown, ChevronRight } from 'lucide-react'
import { motion } from 'framer-motion'
import type { EntityType } from '@/types/entities'
import type { EntityNodeData } from './types'
import { getEntityTextColor, getEntityBgColor, getEntityBorderColor } from '../utils/colors'

const easeOut: [number, number, number, number] = [0.22, 1, 0.36, 1]

const ENTITY_ICONS: Record<EntityType, typeof Building2> = {
  partners: Building2,
  staff: Users,
  asins: Package,
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

        {/* Expanded: show group summary chips */}
        {isExpanded && nodeData.groups.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border/50 space-y-1.5">
            {nodeData.groups.map((group) => {
              const groupProgress =
                group.fieldCount > 0
                  ? Math.round((group.mappedFieldCount / group.fieldCount) * 100)
                  : 0
              return (
                <div
                  key={group.name}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="text-muted-foreground truncate">{group.name}</span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Mini progress bar */}
                    <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          entityType === 'partners'
                            ? 'bg-blue-500'
                            : entityType === 'staff'
                              ? 'bg-green-500'
                              : 'bg-orange-500'
                        }`}
                        style={{ width: `${groupProgress}%` }}
                      />
                    </div>
                    <span className="text-muted-foreground tabular-nums w-8 text-right">
                      {group.mappedFieldCount}/{group.fieldCount}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </motion.div>
  )
}

export const EntityNode = memo(EntityNodeComponent)
