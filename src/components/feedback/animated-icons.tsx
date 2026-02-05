'use client'

import { motion, useAnimation } from 'framer-motion'
import { Bug, Lightbulb, HelpCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { easeOut } from '@/lib/animations'
import { useEffect } from 'react'

interface AnimatedIconProps {
  className?: string
  /** Trigger animation when this changes to true */
  animate?: boolean
}

/**
 * Animated Bug Icon
 * Subtle scale + slight rotation on selection/hover
 * Per Emil Kowalski: micro-interactions 100-150ms, natural not flashy
 */
export function AnimatedBugIcon({ className, animate }: AnimatedIconProps) {
  const controls = useAnimation()

  useEffect(() => {
    if (animate) {
      controls.start({
        scale: [1, 1.1, 1],
        rotate: [0, -3, 0],
        transition: { duration: 0.15, ease: easeOut },
      })
    }
  }, [animate, controls])

  return (
    <motion.div
      animate={controls}
      whileHover={{
        scale: 1.05,
        transition: { duration: 0.15, ease: easeOut },
      }}
      className={cn('inline-flex', className)}
    >
      <Bug className="h-5 w-5" />
    </motion.div>
  )
}

/**
 * Animated Lightbulb Icon
 * Subtle scale with soft glow on selection/hover
 */
export function AnimatedLightbulbIcon({ className, animate }: AnimatedIconProps) {
  const controls = useAnimation()

  useEffect(() => {
    if (animate) {
      controls.start({
        scale: [1, 1.1, 1],
        opacity: [1, 0.85, 1],
        transition: { duration: 0.15, ease: easeOut },
      })
    }
  }, [animate, controls])

  return (
    <motion.div
      animate={controls}
      whileHover={{
        scale: 1.05,
        transition: { duration: 0.15, ease: easeOut },
      }}
      className={cn('inline-flex', className)}
    >
      <Lightbulb className="h-5 w-5" />
    </motion.div>
  )
}

/**
 * Animated Question Icon
 * Subtle scale + slight lift on selection/hover
 */
export function AnimatedQuestionIcon({ className, animate }: AnimatedIconProps) {
  const controls = useAnimation()

  useEffect(() => {
    if (animate) {
      controls.start({
        scale: [1, 1.1, 1],
        y: [0, -2, 0],
        transition: { duration: 0.15, ease: easeOut },
      })
    }
  }, [animate, controls])

  return (
    <motion.div
      animate={controls}
      whileHover={{
        scale: 1.05,
        transition: { duration: 0.15, ease: easeOut },
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
  animate,
}: {
  type: 'bug' | 'feature' | 'question'
  className?: string
  animate?: boolean
}) {
  switch (type) {
    case 'bug':
      return <AnimatedBugIcon className={className} animate={animate} />
    case 'feature':
      return <AnimatedLightbulbIcon className={className} animate={animate} />
    case 'question':
      return <AnimatedQuestionIcon className={className} animate={animate} />
  }
}
