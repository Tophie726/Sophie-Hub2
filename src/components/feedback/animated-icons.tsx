'use client'

import { motion } from 'framer-motion'
import { Bug, Lightbulb, HelpCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { easeOut } from '@/lib/animations'

interface AnimatedIconProps {
  className?: string
}

/**
 * Animated Bug Icon
 * On hover: subtle wiggle/shake animation
 */
export function AnimatedBugIcon({ className }: AnimatedIconProps) {
  return (
    <motion.div
      whileHover={{
        rotate: [0, -8, 8, -8, 8, 0],
        transition: {
          duration: 0.5,
          ease: easeOut,
        },
      }}
      className={cn('inline-flex', className)}
    >
      <Bug className="h-5 w-5" />
    </motion.div>
  )
}

/**
 * Animated Lightbulb Icon
 * On hover: subtle glow/pulse effect with scale
 */
export function AnimatedLightbulbIcon({ className }: AnimatedIconProps) {
  return (
    <motion.div
      whileHover={{
        scale: [1, 1.1, 1.05],
        filter: ['brightness(1)', 'brightness(1.3)', 'brightness(1.15)'],
        transition: {
          duration: 0.4,
          ease: easeOut,
        },
      }}
      className={cn('inline-flex', className)}
    >
      <Lightbulb className="h-5 w-5" />
    </motion.div>
  )
}

/**
 * Animated Question Icon
 * On hover: subtle bounce/nod animation
 */
export function AnimatedQuestionIcon({ className }: AnimatedIconProps) {
  return (
    <motion.div
      whileHover={{
        y: [0, -3, 0, -2, 0],
        transition: {
          duration: 0.5,
          ease: easeOut,
        },
      }}
      className={cn('inline-flex', className)}
    >
      <HelpCircle className="h-5 w-5" />
    </motion.div>
  )
}

/**
 * Combined component that returns the appropriate animated icon based on type
 */
export function AnimatedFeedbackIcon({
  type,
  className,
}: {
  type: 'bug' | 'feature' | 'question'
  className?: string
}) {
  switch (type) {
    case 'bug':
      return <AnimatedBugIcon className={className} />
    case 'feature':
      return <AnimatedLightbulbIcon className={className} />
    case 'question':
      return <AnimatedQuestionIcon className={className} />
  }
}
