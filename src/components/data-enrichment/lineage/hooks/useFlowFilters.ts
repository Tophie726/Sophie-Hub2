'use client'

import { useState, useCallback, useMemo } from 'react'
import type { EntityType } from '@/types/entities'

export type FlowFilterType = 'all' | 'mapped' | 'unmapped'

interface UseFlowFiltersReturn {
  entityFilter: EntityType | 'all'
  statusFilter: FlowFilterType
  setEntityFilter: (entity: EntityType | 'all') => void
  setStatusFilter: (status: FlowFilterType) => void
  isFieldVisible: (entityType: EntityType, isMapped: boolean) => boolean
}

/**
 * Hook to manage filter state for the flow map.
 * Phase 1: simple entity and status filters.
 */
export function useFlowFilters(): UseFlowFiltersReturn {
  const [entityFilter, setEntityFilter] = useState<EntityType | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<FlowFilterType>('all')

  const isFieldVisible = useCallback(
    (entityType: EntityType, isMapped: boolean): boolean => {
      if (entityFilter !== 'all' && entityType !== entityFilter) return false
      if (statusFilter === 'mapped' && !isMapped) return false
      if (statusFilter === 'unmapped' && isMapped) return false
      return true
    },
    [entityFilter, statusFilter]
  )

  return useMemo(
    () => ({
      entityFilter,
      statusFilter,
      setEntityFilter,
      setStatusFilter,
      isFieldVisible,
    }),
    [entityFilter, statusFilter, setEntityFilter, setStatusFilter, isFieldVisible]
  )
}
