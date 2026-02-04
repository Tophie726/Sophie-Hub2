/**
 * Computed Partner Status
 *
 * Calculates a partner's current status based on their latest weekly status data
 * from source_data. This allows us to validate against the sheet-derived status
 * and eventually use as the source of truth.
 *
 * The flow:
 * 1. Extract all weekly statuses from source_data
 * 2. Find the most recent week with data
 * 3. Map the weekly status text → bucket → partner status value
 * 4. Handle missing data with "pending" state
 */

import { getStatusBucket, type StatusColorBucket } from '@/lib/status-colors'

/**
 * Partner status values (matching database schema)
 */
export type PartnerStatusValue =
  | 'active'
  | 'onboarding'
  | 'paused'
  | 'at_risk'
  | 'offboarding'
  | 'churned'

/**
 * Map status bucket to partner status value
 */
export const BUCKET_TO_STATUS: Record<StatusColorBucket, PartnerStatusValue | null> = {
  healthy: 'active',
  onboarding: 'onboarding',
  warning: 'at_risk',
  paused: 'paused',
  offboarding: 'offboarding',
  churned: 'churned',
  unknown: null,    // Keep existing or needs review
  'no-data': null,  // Pending state
}

/**
 * Human-readable labels for partner status
 */
export const STATUS_LABELS: Record<PartnerStatusValue, string> = {
  active: 'Active',
  onboarding: 'Onboarding',
  paused: 'Paused',
  at_risk: 'At Risk',
  offboarding: 'Offboarding',
  churned: 'Churned',
}

export interface WeeklyDataPoint {
  date: Date
  dateKey: string      // "2026-01-05"
  weekNumber: number
  status: string
}

export interface ComputedStatusResult {
  // The computed partner status value (null if can't determine)
  computedStatus: PartnerStatusValue | null

  // The bucket classification of the latest status
  bucket: StatusColorBucket

  // Raw status text from the latest week
  latestWeeklyStatus: string | null

  // Date of the latest week with data
  latestWeekDate: Date | null

  // ISO week number of latest data
  latestWeekNumber: number | null

  // How many recent weeks have no data (gap from today)
  weeksWithoutData: number

  // Does computed status match the sheet-derived status?
  matchesSheetStatus: boolean

  // Human-readable display: "Active" or "Pending (last: Active)"
  displayLabel: string

  // For debugging: all extracted weekly data points
  weeklyData: WeeklyDataPoint[]
}

/**
 * Parse a date string from column name format "M/D/YY" or "MM/DD/YYYY"
 */
function parseWeekDate(month: string, day: string, yearStr: string): Date {
  let year = parseInt(yearStr, 10)
  if (year < 100) {
    year += year > 50 ? 1900 : 2000
  }
  // Month is 1-indexed in the format, 0-indexed in Date
  return new Date(year, parseInt(month, 10) - 1, parseInt(day, 10))
}

/**
 * Get ISO week number for a date
 */
function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

/**
 * Get the Monday of the week containing a date
 */
function getWeekMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Calculate weeks between two dates
 */
function weeksBetween(date1: Date, date2: Date): number {
  const msPerWeek = 7 * 24 * 60 * 60 * 1000
  return Math.floor(Math.abs(date2.getTime() - date1.getTime()) / msPerWeek)
}

/**
 * Extract all weekly status data points from source_data
 */
export function extractWeeklyDataPoints(
  sourceData: Record<string, Record<string, Record<string, unknown>>> | null | undefined
): WeeklyDataPoint[] {
  const dataPoints: WeeklyDataPoint[] = []

  if (!sourceData) return dataPoints

  // Pattern: "M/D/YY\nWeek N" or "MM/DD/YYYY\nWeek N"
  const weekPattern = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})[\s\n]+Week\s*(\d+)/i

  for (const connector of Object.values(sourceData)) {
    if (typeof connector !== 'object' || !connector) continue

    for (const tabData of Object.values(connector)) {
      if (typeof tabData !== 'object' || !tabData) continue

      for (const [columnName, value] of Object.entries(tabData)) {
        const match = columnName.match(weekPattern)
        if (!match) continue

        const [, month, day, yearStr, weekNum] = match

        // Only process if value is a non-empty string
        if (typeof value !== 'string' || !value.trim()) continue

        const date = parseWeekDate(month, day, yearStr)
        const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

        dataPoints.push({
          date,
          dateKey,
          weekNumber: parseInt(weekNum, 10),
          status: value.trim(),
        })
      }
    }
  }

  // Sort by date descending (most recent first)
  dataPoints.sort((a, b) => b.date.getTime() - a.date.getTime())

  return dataPoints
}

/**
 * Compute partner status from source_data weekly status
 */
export function computePartnerStatus(
  sourceData: Record<string, Record<string, Record<string, unknown>>> | null | undefined,
  sheetStatus: string | null
): ComputedStatusResult {
  const weeklyData = extractWeeklyDataPoints(sourceData)
  const today = new Date()
  const currentWeekMonday = getWeekMonday(today)

  // Default result for no data
  if (weeklyData.length === 0) {
    const sheetBucket = getStatusBucket(sheetStatus)
    const sheetStatusValue = BUCKET_TO_STATUS[sheetBucket]

    return {
      computedStatus: null,
      bucket: 'no-data',
      latestWeeklyStatus: null,
      latestWeekDate: null,
      latestWeekNumber: null,
      weeksWithoutData: -1, // Unknown
      matchesSheetStatus: false,
      displayLabel: sheetStatusValue
        ? `Pending (last: ${STATUS_LABELS[sheetStatusValue]})`
        : 'No Data',
      weeklyData: [],
    }
  }

  // Get the latest data point
  const latest = weeklyData[0]
  const latestWeekMonday = getWeekMonday(latest.date)
  const weeksWithoutData = weeksBetween(latestWeekMonday, currentWeekMonday)

  // Classify the latest weekly status
  const bucket = getStatusBucket(latest.status)
  const computedStatus = BUCKET_TO_STATUS[bucket]

  // Determine if this matches the sheet status
  const sheetBucket = getStatusBucket(sheetStatus)
  const sheetStatusValue = BUCKET_TO_STATUS[sheetBucket]
  const matchesSheetStatus = computedStatus === sheetStatusValue ||
    (computedStatus === null && sheetStatusValue === null)

  // Build display label
  let displayLabel: string
  if (computedStatus) {
    if (weeksWithoutData > 2) {
      // Stale data - show pending with last known
      displayLabel = `Pending (last: ${STATUS_LABELS[computedStatus]})`
    } else {
      displayLabel = STATUS_LABELS[computedStatus]
    }
  } else if (bucket === 'unknown') {
    displayLabel = `Unknown: "${latest.status}"`
  } else {
    displayLabel = sheetStatusValue
      ? `Pending (last: ${STATUS_LABELS[sheetStatusValue]})`
      : 'No Data'
  }

  return {
    computedStatus: weeksWithoutData > 2 ? null : computedStatus, // null if stale
    bucket,
    latestWeeklyStatus: latest.status,
    latestWeekDate: latest.date,
    latestWeekNumber: getISOWeekNumber(latest.date),
    weeksWithoutData,
    matchesSheetStatus,
    displayLabel,
    weeklyData,
  }
}

/**
 * Quick helper to get just the computed status value
 */
export function getComputedStatus(
  sourceData: Record<string, Record<string, Record<string, unknown>>> | null | undefined
): PartnerStatusValue | null {
  const result = computePartnerStatus(sourceData, null)
  return result.computedStatus
}

/**
 * Check if a partner's computed status matches a filter value
 * Handles the case where computed status might be null (pending)
 */
export function matchesStatusFilter(
  sourceData: Record<string, Record<string, Record<string, unknown>>> | null | undefined,
  sheetStatus: string | null,
  filterValues: string[]
): boolean {
  if (filterValues.length === 0) return true

  const result = computePartnerStatus(sourceData, sheetStatus)

  // If computed status is available, use it
  if (result.computedStatus) {
    return filterValues.includes(result.computedStatus)
  }

  // Fall back to sheet status bucket mapping
  const sheetBucket = getStatusBucket(sheetStatus)
  const sheetStatusValue = BUCKET_TO_STATUS[sheetBucket]
  if (sheetStatusValue) {
    return filterValues.includes(sheetStatusValue)
  }

  return false
}
