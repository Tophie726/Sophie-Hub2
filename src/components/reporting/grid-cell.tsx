'use client'

import { motion } from 'framer-motion'
import { easeOut, duration } from '@/lib/animations'

export type CellHighlight = 'none' | 'valid' | 'invalid'

interface GridCellProps {
  col: number
  row: number
  highlight: CellHighlight
}

export function GridCell({ col, row, highlight }: GridCellProps) {
  return (
    <motion.div
      initial={false}
      animate={{
        opacity: 1,
        scale: highlight !== 'none' ? 1 : 0.98,
      }}
      transition={{ duration: duration.micro, ease: easeOut }}
      className={`rounded-lg pointer-events-none ${
        highlight === 'valid'
          ? 'bg-primary/10 ring-2 ring-primary/30 ring-dashed'
          : highlight === 'invalid'
            ? 'bg-destructive/10 ring-2 ring-destructive/30 ring-dashed'
            : 'ring-1 ring-border/30 ring-dashed'
      }`}
      style={{
        gridColumn: col,
        gridRow: row,
        zIndex: highlight !== 'none' ? 20 : 5,
      }}
    />
  )
}
