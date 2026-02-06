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
        opacity: highlight !== 'none' ? 1 : 0,
        scale: highlight !== 'none' ? 1 : 0.97,
      }}
      transition={{ duration: duration.micro, ease: easeOut }}
      className={`rounded-lg pointer-events-none ${
        highlight === 'valid'
          ? 'bg-primary/8 ring-2 ring-primary/25 ring-dashed'
          : highlight === 'invalid'
            ? 'bg-destructive/8 ring-2 ring-destructive/25 ring-dashed'
            : ''
      }`}
      style={{
        gridColumn: col,
        gridRow: row,
      }}
    />
  )
}
