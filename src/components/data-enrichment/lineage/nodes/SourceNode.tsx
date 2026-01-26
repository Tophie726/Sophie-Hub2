'use client'

import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import { FileSpreadsheet } from 'lucide-react'
import { motion } from 'framer-motion'
import type { SourceNodeData } from './types'

const easeOut: [number, number, number, number] = [0.22, 1, 0.36, 1]

function SourceNodeComponent({ data }: NodeProps) {
  const nodeData = data as unknown as SourceNodeData
  const { name, tabCount } = nodeData

  return (
    <motion.div
      className="relative rounded-xl border bg-card shadow-sm select-none"
      style={{ minWidth: 180 }}
      whileHover={{ scale: 1.02, y: -2 }}
      transition={{ duration: 0.2, ease: easeOut }}
    >
      {/* Output handle - right (for mapping edges to entities) */}
      <Handle
        type="source"
        position={Position.Right}
        id="mapping-source"
        className="!w-2 !h-2 !border-2 !border-background !bg-muted-foreground/50"
      />

      <div className="p-3 flex items-center gap-3">
        {/* Icon */}
        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-green-500/10 flex-shrink-0">
          <FileSpreadsheet className="w-4 h-4 text-green-600" />
        </div>

        {/* Name and tab count */}
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm truncate">{name}</h3>
          <p className="text-xs text-muted-foreground tabular-nums">
            {tabCount} tab{tabCount !== 1 ? 's' : ''}
          </p>
        </div>
      </div>
    </motion.div>
  )
}

export const SourceNode = memo(SourceNodeComponent)
