/**
 * Grid occupancy utilities for snap-to-grid widget placement.
 * All coordinates are 1-based to match CSS Grid conventions.
 *
 * Grid: 8 columns (each ~12.5% width). Widgets snap to any column.
 * This gives twice the positioning freedom of a 4-column grid while
 * keeping layouts structured.
 */

import { useMemo } from 'react'
import type { DashboardWidget } from '@/types/modules'

export const GRID_COLS = 8

/** Map of "col,row" → widgetId for O(1) cell lookups */
export type OccupancyMap = Map<string, string>

function cellKey(col: number, row: number): string {
  return `${col},${row}`
}

/** Build a map of all cells occupied by the given widgets */
export function buildOccupancyMap(widgets: DashboardWidget[]): OccupancyMap {
  const map: OccupancyMap = new Map()
  for (const w of widgets) {
    const col = Math.max(1, w.grid_column)
    const row = Math.max(1, w.grid_row)
    for (let c = col; c < col + w.col_span; c++) {
      for (let r = row; r < row + w.row_span; r++) {
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
  if (col + colSpan - 1 > GRID_COLS) return false

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

  if (col < 1 || col > GRID_COLS || row < 1) return null

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
  const clampedCol = Math.min(Math.max(targetCol, 1), GRID_COLS - colSpan + 1)
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
    for (let col = 1; col <= GRID_COLS - colSpan + 1; col++) {
      if (canPlace(map, col, row, colSpan, rowSpan)) {
        return { col, row }
      }
    }
  }
  return { col: 1, row: maxRow + 1 }
}

/**
 * Migrate widgets from 4-column grid to 8-column grid.
 * Doubles grid_column positions and col_span values.
 */
export function migrateFourToEightColumns(widgets: DashboardWidget[]): DashboardWidget[] {
  if (widgets.length === 0) return widgets

  // Detect: if any widget uses col > 4 or span > 4, already on 8-col grid
  const isAlreadyEightCol = widgets.some(
    (w) => w.grid_column > 4 || w.col_span > 4
  )
  if (isAlreadyEightCol) return widgets

  // All widgets fit in a 4-col grid → convert to 8-col
  return widgets.map((w) => ({
    ...w,
    grid_column: (Math.max(1, w.grid_column) - 1) * 2 + 1,
    col_span: w.col_span * 2,
  }))
}

/**
 * Migrate legacy widgets (all at grid_column<=1, grid_row<=1)
 * to proper grid positions based on sort_order, using 8-col grid.
 */
export function migrateAutoPlacedWidgets(widgets: DashboardWidget[]): DashboardWidget[] {
  if (widgets.length === 0) return widgets

  // Step 1: If all at origin, assign positions
  const allAtOrigin = widgets.every(
    (w) => w.grid_column <= 1 && w.grid_row <= 1
  )

  let positioned = widgets
  if (allAtOrigin) {
    const sorted = [...widgets].sort((a, b) => a.sort_order - b.sort_order)
    const occupancy: OccupancyMap = new Map()

    positioned = sorted.map((w) => {
      // Default to 2-col span on 8-col grid (= old 1-col on 4-col grid)
      const colSpan = Math.max(2, w.col_span)
      const pos = findFirstAvailable(occupancy, colSpan, w.row_span, getMaxOccupiedRow(occupancy))
      for (let c = pos.col; c < pos.col + colSpan; c++) {
        for (let r = pos.row; r < pos.row + w.row_span; r++) {
          occupancy.set(cellKey(c, r), w.id)
        }
      }
      return { ...w, grid_column: pos.col, grid_row: pos.row, col_span: colSpan }
    })
  }

  // Step 2: Migrate from 4-col to 8-col if needed
  return migrateFourToEightColumns(positioned)
}

function getMaxOccupiedRow(map: OccupancyMap): number {
  let max = 0
  map.forEach((_, key) => {
    const row = parseInt(key.split(',')[1], 10)
    if (row > max) max = row
  })
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
