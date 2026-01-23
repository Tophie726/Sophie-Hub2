/**
 * Centralized Animation Constants
 *
 * This file contains all animation presets used throughout Sophie Hub.
 * Following animations.dev patterns by Emil Kowalski.
 *
 * Rules:
 * - Use ease-out for user-initiated interactions (clicks, opens, closes)
 * - Use ease-in-out for morphing (elements already on screen)
 * - Never use ease-in (feels sluggish)
 * - Linear only for progress bars, marquees, time-based visualizations
 */

// ============ EASING CURVES ============

/** Primary easing - snappy, responsive feel for user interactions */
export const easeOut = [0.22, 1, 0.36, 1] as const

/** Standard ease-out from CSS */
export const easeOutStandard = [0.25, 0.46, 0.45, 0.94] as const

/** For morphing/transitions of on-screen elements */
export const easeInOut = [0.45, 0, 0.55, 1] as const

/** Snappier ease-out with expo feel */
export const easeOutExpo = [0.16, 1, 0.3, 1] as const

/** Slight overshoot for playful interactions */
export const easeOutBack = [0.34, 1.56, 0.64, 1] as const

// ============ DURATIONS ============

/** Duration constants in seconds (for framer-motion) */
export const duration = {
  /** Micro-interactions: button press, hover states */
  micro: 0.15,
  /** UI transitions: dropdowns, modals, tooltips */
  ui: 0.2,
  /** Page-level transitions */
  page: 0.3,
  /** Complex/staggered animations */
  complex: 0.4,
} as const

/** Duration constants in milliseconds (for CSS transitions) */
export const durationMs = {
  micro: 150,
  ui: 200,
  page: 300,
  complex: 400,
} as const

// ============ STANDARD VARIANTS ============

/** Fade in from below - good for content appearing */
export const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: duration.page, ease: easeOut },
}

/** Fade in from above - good for dropdowns */
export const fadeInDown = {
  initial: { opacity: 0, y: -10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: duration.ui, ease: easeOut },
}

/** Simple fade - good for overlays */
export const fade = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: duration.ui, ease: easeOut },
}

/** Scale on hover - subtle lift effect for cards */
export const scaleOnHover = {
  whileHover: { scale: 1.02, y: -2 },
  whileTap: { scale: 0.98 },
  transition: { duration: duration.micro, ease: easeOut },
}

/** Press feedback - for buttons */
export const pressFeedback = {
  whileTap: { scale: 0.97 },
  transition: { duration: duration.micro, ease: easeOut },
}

// ============ SPRING CONFIGS ============

/** Bouncy spring for badges, notifications */
export const springPop = {
  type: 'spring' as const,
  stiffness: 500,
  damping: 30,
}

/** Smooth spring for layout animations */
export const springSmooth = {
  type: 'spring' as const,
  stiffness: 300,
  damping: 30,
}

/** Quick spring for active indicators */
export const springQuick = {
  type: 'spring' as const,
  bounce: 0.15,
  duration: 0.5,
}

// ============ STAGGER CONFIGS ============

/** Container variants for staggered children */
export const staggerContainer = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
}

/** Child variants for staggered items */
export const staggerItem = {
  initial: { opacity: 0, y: 10 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: duration.ui, ease: easeOut },
  },
}

// ============ MOBILE DRAWER ============

/** Slide in from left - for mobile drawer */
export const slideInLeft = {
  initial: { x: -280 },
  animate: { x: 0 },
  exit: { x: -280 },
  transition: { duration: duration.page, ease: easeOut },
}

/** Backdrop fade */
export const backdrop = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: duration.ui, ease: easeOut },
}

// ============ THEME TRANSITIONS (CSS) ============

/** CSS transition for theme switching */
export const themeTransition = {
  backgroundColor: `background-color ${durationMs.page}ms ease-out`,
  color: `color ${durationMs.ui}ms ease-out`,
  borderColor: `border-color ${durationMs.micro}ms ease-out`,
}

// ============ HELPER FUNCTIONS ============

/**
 * Creates a stagger delay for array items
 * @param index - Item index
 * @param baseDelay - Base delay in seconds (default: 0.05)
 */
export function staggerDelay(index: number, baseDelay = 0.05): number {
  return index * baseDelay
}

/**
 * Creates animation config for list items
 * @param index - Item index
 */
export function listItemAnimation(index: number) {
  return {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: {
      duration: duration.ui,
      ease: easeOut,
      delay: staggerDelay(index),
    },
  }
}
