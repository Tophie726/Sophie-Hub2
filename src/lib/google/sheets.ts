import { google } from 'googleapis'

export interface GoogleSheet {
  id: string
  name: string
  url: string
  modifiedTime: string
  owner?: string
}

export interface SheetTab {
  sheetId: number
  title: string
  rowCount: number
  columnCount: number
}

export interface SheetPreview {
  spreadsheetId: string
  title: string
  tabs: SheetTab[]
  preview: {
    tabName: string
    headers: string[]
    rows: string[][]
  }
}

/**
 * Escape single quotes for Google Drive API query strings
 * Google Drive uses single quotes for string literals, so we need to escape them
 */
function escapeQueryString(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

/**
 * Search for spreadsheets in user's Google Drive
 */
export async function searchSheets(accessToken: string, query: string): Promise<GoogleSheet[]> {
  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: accessToken })

  const drive = google.drive({ version: 'v3', auth })

  // Build search query (escape user input to prevent query injection)
  const safeQuery = escapeQueryString(query)
  const searchQuery = query
    ? `mimeType='application/vnd.google-apps.spreadsheet' and name contains '${safeQuery}' and trashed=false`
    : `mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`

  const response = await drive.files.list({
    q: searchQuery,
    fields: 'files(id, name, modifiedTime, owners, webViewLink)',
    orderBy: 'modifiedTime desc',
    pageSize: 20,
  })

  return (response.data.files || []).map((file) => ({
    id: file.id!,
    name: file.name!,
    url: file.webViewLink!,
    modifiedTime: file.modifiedTime!,
    owner: file.owners?.[0]?.displayName ?? undefined,
  }))
}

/**
 * Get spreadsheet metadata and preview
 */
export async function getSheetPreview(
  accessToken: string,
  spreadsheetId: string
): Promise<SheetPreview> {
  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: accessToken })

  const sheets = google.sheets({ version: 'v4', auth })

  // Fetch metadata and first-tab preview data in parallel
  // Range without sheet name defaults to the first visible sheet
  const [metadata, previewData] = await Promise.all([
    sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'spreadsheetId,properties.title,sheets.properties',
    }),
    sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'A1:Z6',
    }).catch((error) => {
      console.error('Error fetching preview data:', error)
      return null
    }),
  ])

  const tabs: SheetTab[] = (metadata.data.sheets || []).map((sheet) => ({
    sheetId: sheet.properties?.sheetId || 0,
    title: sheet.properties?.title || 'Untitled',
    rowCount: sheet.properties?.gridProperties?.rowCount || 0,
    columnCount: sheet.properties?.gridProperties?.columnCount || 0,
  }))

  const firstTab = tabs[0]
  let headers: string[] = []
  let rows: string[][] = []

  if (previewData) {
    const values = previewData.data.values || []
    if (values.length > 0) {
      headers = values[0].map((v) => String(v || ''))
      rows = values.slice(1).map((row) => row.map((v) => String(v || '')))
    }
  }

  return {
    spreadsheetId: metadata.data.spreadsheetId!,
    title: metadata.data.properties?.title || 'Untitled',
    tabs,
    preview: {
      tabName: firstTab?.title || '',
      headers,
      rows,
    },
  }
}

/**
 * Get all data from a specific tab
 * @param headerRow - 0-indexed row number for headers (default: 0)
 */
export async function getSheetData(
  accessToken: string,
  spreadsheetId: string,
  tabName: string,
  headerRow: number = 0
): Promise<{ headers: string[]; rows: string[][] }> {
  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: accessToken })

  const sheets = google.sheets({ version: 'v4', auth })

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${tabName}'`,
  })

  const values = response.data.values || []

  if (values.length === 0) {
    return { headers: [], rows: [] }
  }

  // Use specified header row, with data rows starting after it
  const effectiveHeaderRow = Math.min(headerRow, values.length - 1)

  return {
    headers: values[effectiveHeaderRow].map((v) => String(v || '')),
    rows: values.slice(effectiveHeaderRow + 1).map((row) => row.map((v) => String(v || ''))),
  }
}

/**
 * Get raw rows from a tab (no header assumption) for header detection
 */
export async function getSheetRawRows(
  accessToken: string,
  spreadsheetId: string,
  tabName: string,
  maxRows: number = 20
): Promise<{ rows: string[][]; totalRows: number }> {
  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: accessToken })

  const sheets = google.sheets({ version: 'v4', auth })

  // Fetch rows and metadata in parallel (saves 200-300ms vs sequential)
  const [response, metadata] = await Promise.all([
    sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${tabName}'!A1:ZZ${maxRows}`,
    }),
    sheets.spreadsheets.get({
      spreadsheetId,
      ranges: [`'${tabName}'`],
      fields: 'sheets.properties.gridProperties.rowCount',
    }),
  ])

  const values = response.data.values || []

  // Normalize rows to have consistent column count
  const maxCols = Math.max(...values.map(row => row?.length || 0), 0)
  const normalizedRows = values.map(row => {
    const normalized = Array(maxCols).fill('')
    if (row) {
      row.forEach((val, i) => {
        normalized[i] = String(val || '')
      })
    }
    return normalized
  })

  const totalRows = metadata.data.sheets?.[0]?.properties?.gridProperties?.rowCount || values.length

  return {
    rows: normalizedRows,
    totalRows,
  }
}

/**
 * Result of header row detection with confidence scoring
 */
export interface HeaderDetectionResult {
  rowIndex: number
  confidence: number  // 0-100
  reasons: string[]   // Human-readable explanations
}

/**
 * Common header keywords that suggest a row is a header
 */
const HEADER_KEYWORDS = [
  'id', 'name', 'email', 'status', 'date', 'brand', 'partner', 'staff',
  'phone', 'address', 'type', 'category', 'description', 'notes', 'title',
  'asin', 'sku', 'product', 'price', 'quantity', 'total', 'amount',
  'created', 'updated', 'modified', 'first', 'last', 'full', 'company',
  'manager', 'owner', 'assigned', 'department', 'role', 'tier', 'fee',
]

/**
 * Auto-detect header row by analyzing row content
 * Returns the likely header row index (0-based) with confidence score
 */
export function detectHeaderRow(rows: string[][]): HeaderDetectionResult {
  if (rows.length === 0) {
    return { rowIndex: 0, confidence: 0, reasons: ['No data in sheet'] }
  }

  let bestHeaderIndex = 0
  let bestScore = 0
  let bestReasons: string[] = []

  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const row = rows[i]
    let score = 0
    const reasons: string[] = []

    // Count non-empty cells
    const nonEmpty = row.filter(cell => cell.trim() !== '').length
    const nonEmptyRatio = nonEmpty / Math.max(row.length, 1)

    if (nonEmptyRatio > 0.5) {
      score += 10
      reasons.push(`${Math.round(nonEmptyRatio * 100)}% of cells filled`)
    }

    // Header keyword matching (+15 pts each, capped at 45)
    const keywordMatches = row.filter(cell => {
      const lower = cell.toLowerCase().trim()
      return HEADER_KEYWORDS.some(kw => lower.includes(kw))
    }).length
    if (keywordMatches > 0) {
      const keywordScore = Math.min(keywordMatches * 15, 45)
      score += keywordScore
      reasons.push(`${keywordMatches} header keyword${keywordMatches > 1 ? 's' : ''} found`)
    }

    // Uniqueness check (+20 pts): All non-empty cells are unique
    const nonEmptyCells = row.filter(cell => cell.trim() !== '')
    const uniqueCells = new Set(nonEmptyCells.map(c => c.toLowerCase().trim()))
    if (nonEmptyCells.length > 2 && uniqueCells.size === nonEmptyCells.length) {
      score += 20
      reasons.push('All values unique')
    }

    // All-text row (+15 pts): No pure numbers or dates in the row
    const allText = row.every(cell => {
      const trimmed = cell.trim()
      if (!trimmed) return true // Empty cells are fine
      const type = guessType(trimmed)
      return type === 'text' || type === 'empty'
    })
    if (allText && nonEmpty > 0) {
      score += 15
      reasons.push('All text values (no numbers/dates)')
    }

    // Position bonus (+10 pts row 0, +5 pts row 1)
    if (i === 0) {
      score += 10
      reasons.push('First row')
    } else if (i === 1) {
      score += 5
      reasons.push('Second row')
    }

    // Penalty for rows that look like data (have emails, URLs, long text)
    const dataLikeCells = row.filter(cell => {
      return cell.includes('@') || cell.includes('http') || cell.length > 100
    }).length
    if (dataLikeCells > 0) {
      score -= dataLikeCells * 10
      reasons.push(`Contains ${dataLikeCells} data-like value${dataLikeCells > 1 ? 's' : ''} (emails/URLs)`)
    }

    // Type diversity in subsequent rows (+15 pts)
    // Check if next row has different "type" (suggests this is header)
    if (i < rows.length - 1) {
      const nextRow = rows[i + 1]
      const currentTypes = row.map(c => guessType(c))
      const nextTypes = nextRow.map(c => guessType(c))
      const typeDiffs = currentTypes.filter((t, idx) => t !== nextTypes[idx]).length
      if (typeDiffs > currentTypes.length / 2) {
        score += 15
        reasons.push('Data types differ from next row')
      }
    }

    // Bonus if cells look like headers (short text, no numbers)
    const headerLikeCells = row.filter(cell => {
      const trimmed = cell.trim()
      if (!trimmed) return false
      if (trimmed.length > 50) return false
      if (/^\d+\.?\d*$/.test(trimmed)) return false
      return true
    }).length
    if (headerLikeCells > row.length / 2) {
      score += 5
      reasons.push('Most cells look like labels')
    }

    if (score > bestScore) {
      bestScore = score
      bestHeaderIndex = i
      bestReasons = reasons.filter(r => !r.includes('data-like')) // Remove penalty reasons from display
    }
  }

  // Convert score to confidence (0-100)
  // Max theoretical score is around 120 (keywords 45 + unique 20 + all-text 15 + position 10 + type-diff 15 + header-like 5 + filled 10)
  const confidence = Math.min(100, Math.round((bestScore / 100) * 100))

  return {
    rowIndex: bestHeaderIndex,
    confidence,
    reasons: bestReasons.length > 0 ? bestReasons : ['Best match based on content analysis'],
  }
}

/**
 * Legacy wrapper for backward compatibility
 * @deprecated Use detectHeaderRow() which returns HeaderDetectionResult
 */
export function detectHeaderRowIndex(rows: string[][]): number {
  return detectHeaderRow(rows).rowIndex
}

function guessType(value: string): 'empty' | 'number' | 'date' | 'email' | 'text' {
  const trimmed = value.trim()
  if (!trimmed) return 'empty'
  if (/^\d+\.?\d*$/.test(trimmed)) return 'number'
  if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(trimmed)) return 'date'
  if (trimmed.includes('@')) return 'email'
  return 'text'
}
