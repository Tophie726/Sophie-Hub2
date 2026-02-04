'use client'

import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import type { FieldGroupNodeData } from './types'
import { getEntityTextColor, getEntityBgColor } from '../utils/colors'

function FieldGroupNodeComponent({ data }: NodeProps) {
  const nodeData = data as unknown as FieldGroupNodeData
  const { entityType, groupName, fieldCount, mappedFieldCount } = nodeData

  const _textColor = getEntityTextColor(entityType)
  const _bgColor = getEntityBgColor(entityType)
  void _textColor; void _bgColor // reserved for future styling
  const progress = fieldCount > 0 ? Math.round((mappedFieldCount / fieldCount) * 100) : 0

  return (
    <div className="rounded-lg border bg-card/80 shadow-sm select-none" style={{ minWidth: 160 }}>
      {/* Input handle - left */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-1.5 !h-1.5 !border-2 !border-background !bg-muted-foreground/40"
      />

      <div className="px-3 py-2 flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate">{groupName}</p>
          <div className="flex items-center gap-2 mt-1">
            {/* Mini progress bar */}
            <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  entityType === 'partners'
                    ? 'bg-blue-500'
                    : entityType === 'staff'
                      ? 'bg-green-500'
                      : 'bg-orange-500'
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground tabular-nums flex-shrink-0">
              {mappedFieldCount}/{fieldCount}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export const FieldGroupNode = memo(FieldGroupNodeComponent)
