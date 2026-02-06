/**
 * Grid occupancy utilities for snap-to-grid widget placement.
 * All coordinates are 1-based to match CSS Grid conventions.
 */

import { useMemo } from 'react'
import type { DashboardWidget } from '@/types/modules'

/** Map of "col,row" → widgetId for O(1) cell lookups */
export type OccupancyMap = Map<string, string>

function cellKey(col: number, row: number): string {
  return `${col},${row}`
}

/** Build a map of all cells occupied by the given widgets */
export function buildOccupancyMap(widgets: DashboardWidget[]): OccupancyMap {
  const map: OccupancyMap = new Map()
  for (const w of widgets) {
    for (let c = w.grid_column; c < w.grid_column + w.col_span; c++) {
      for (let r = w.grid_row; r < w.grid_row + w.row_span; r++) {
        map.set(cellKey(c, r), w.id)
      }
    }
  }
  return map
}

/** Check if a widget can be placed at (col, row) with given span */
export function canPlace(
  map: OccupancyMap,
  col: number,
  row: number,
  colSpan: number,
  rowSpan: number,
  excludeWidgetId?: string
): boolean {
  if (col < 1 || row < 1) return false
  if (col + colSpan - 1 > 4) return false // exceeds 4-column grid

  for (let c = col; c < col + colSpan; c++) {
    for (let r = row; r < row + rowSpan; r++) {
      const occupant = map.get(cellKey(c, r))
      if (occupant && occupant !== excludeWidgetId) return false
    }
  }
  return true
}

/** Get the maximum occupied row across all widgets */
export function getMaxRow(widgets: DashboardWidget[]): number {
  let max = 0
  for (const w of widgets) {
    const bottom = w.grid_row + w.row_span - 1
    if (bottom > max) max = bottom
  }
  return max
}

/** Convert pointer screen coordinates to a grid cell (1-based) */
export function pointerToCell(
  pointerX: number,
  pointerY: number,
  gridRect: DOMRect,
  cellWidth: number,
  rowHeight: number,
  gap: number
): { col: number; row: number } | null {
  const relX = pointerX - gridRect.left
  const relY = pointerY - gridRect.top

  if (relX < 0 || relY < 0 || relX > gridRect.width) return null

  const col = Math.floor(relX / (cellWidth + gap)) + 1
  const row = Math.floor(relY / (rowHeight + gap)) + 1

  if (col < 1 || col > 4 || row < 1) return null

  return { col, row }
}

/** Find the best valid drop position near the target, or null if impossible */
export function findDropPosition(
  map: OccupancyMap,
  targetCol: number,
  targetRow: number,
  colSpan: number,
  rowSpan: number,
  draggedWidgetId: string
): { col: number; row: number } | null {
  // Clamp col so widget doesn't exceed grid bounds
  const clampedCol = Math.min(Math.max(targetCol, 1), 4 - colSpan + 1)
  const clampedRow = Math.max(targetRow, 1)

  if (canPlace(map, clampedCol, clampedRow, colSpan, rowSpan, draggedWidgetId)) {
    return { col: clampedCol, row: clampedRow }
  }

  return null
}

/** Find first available position scanning left→right, top→bottom */
export function findFirstAvailable(
  map: OccupancyMap,
  colSpan: number,
  rowSpan: number,
  maxRow: number
): { col: number; row: number } {
  for (let row = 1; row <= maxRow + 1; row++) {
    for (let col = 1; col <= 4 - colSpan + 1; col++) {
      if (canPlace(map, col, row, colSpan, rowSpan)) {
        return { col, row }
      }
    }
  }
  return { col: 1, row: maxRow + 1 }
}

/**
 * Migrate legacy widgets (all at grid_column=1, grid_row=1)
 * to proper grid positions based on sort_order.
 */
export function migrateAutoPlacedWidgets(widgets: DashboardWidget[]): DashboardWidget[] {
  if (widgets.length === 0) return widgets

  const allAtOrigin = widgets.every(
    (w) => w.grid_column <= 1 && w.grid_row <= 1
  )
  if (!allAtOrigin) return widgets

  const sorted = [...widgets].sort((a, b) => a.sort_order - b.sort_order)
  const occupancy: OccupancyMap = new Map()

  return sorted.map((w) => {
    const pos = findFirstAvailable(occupancy, w.col_span, w.row_span, getMaxOccupiedRow(occupancy))
    // Mark cells as occupied
    for (let c = pos.col; c < pos.col + w.col_span; c++) {
      for (let r = pos.row; r < pos.row + w.row_span; r++) {
        occupancy.set(cellKey(c, r), w.id)
      }
    }
    return { ...w, grid_column: pos.col, grid_row: pos.row }
  })
}

function getMaxOccupiedRow(map: OccupancyMap): number {
  let max = 0
  for (const key of map.keys()) {
    const row = parseInt(key.split(',')[1], 10)
    if (row > max) max = row
  }
  return max
}

/** React hook: memoized occupancy map for a widget array */
export function useOccupancyMap(widgets: DashboardWidget[]): OccupancyMap {
  return useMemo(() => buildOccupancyMap(widgets), [widgets])
}

/** Get the set of cells a widget at (col, row) with spans would occupy */
export function getCellsForPlacement(
  col: number,
  row: number,
  colSpan: number,
  rowSpan: number
): string[] {
  const cells: string[] = []
  for (let c = col; c < col + colSpan; c++) {
    for (let r = row; r < row + rowSpan; r++) {
      cells.push(cellKey(c, r))
    }
  }
  return cells
}
