/**
 * Color utilities for the Data Flow Map
 *
 * Reuses entity colors from entityDisplayConfig.
 */

import type { EntityType } from '@/types/entities'

/** Hex colors for React Flow nodes/edges (can't use Tailwind classes in SVG) */
export const entityColors: Record<EntityType, { primary: string; bg: string; border: string }> = {
  partners: {
    primary: '#3b82f6', // blue-500
    bg: '#eff6ff',      // blue-50
    border: '#93c5fd',  // blue-300
  },
  staff: {
    primary: '#22c55e', // green-500
    bg: '#f0fdf4',      // green-50
    border: '#86efac',  // green-300
  },
  asins: {
    primary: '#f97316', // orange-500
    bg: '#fff7ed',      // orange-50
    border: '#fdba74',  // orange-300
  },
}

/** Color for source nodes */
export const sourceColor = {
  primary: '#6b7280', // gray-500
  bg: '#f9fafb',      // gray-50
  border: '#d1d5db',  // gray-300
}

/** Get the Tailwind text color class for an entity */
export function getEntityTextColor(entity: EntityType): string {
  switch (entity) {
    case 'partners': return 'text-blue-500'
    case 'staff': return 'text-green-500'
    case 'asins': return 'text-orange-500'
  }
}

/** Get the Tailwind bg color class for an entity */
export function getEntityBgColor(entity: EntityType): string {
  switch (entity) {
    case 'partners': return 'bg-blue-500/10'
    case 'staff': return 'bg-green-500/10'
    case 'asins': return 'bg-orange-500/10'
  }
}

/** Get the Tailwind border color class for an entity */
export function getEntityBorderColor(entity: EntityType): string {
  switch (entity) {
    case 'partners': return 'border-blue-500/30'
    case 'staff': return 'border-green-500/30'
    case 'asins': return 'border-orange-500/30'
  }
}
