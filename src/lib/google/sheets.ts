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
 * Search for spreadsheets in user's Google Drive
 */
export async function searchSheets(accessToken: string, query: string): Promise<GoogleSheet[]> {
  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: accessToken })

  const drive = google.drive({ version: 'v3', auth })

  // Build search query
  const searchQuery = query
    ? `mimeType='application/vnd.google-apps.spreadsheet' and name contains '${query}' and trashed=false`
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
    owner: file.owners?.[0]?.displayName,
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

  // Get spreadsheet metadata
  const metadata = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'spreadsheetId,properties.title,sheets.properties',
  })

  const tabs: SheetTab[] = (metadata.data.sheets || []).map((sheet) => ({
    sheetId: sheet.properties?.sheetId || 0,
    title: sheet.properties?.title || 'Untitled',
    rowCount: sheet.properties?.gridProperties?.rowCount || 0,
    columnCount: sheet.properties?.gridProperties?.columnCount || 0,
  }))

  // Get preview data from first tab (first 6 rows)
  const firstTab = tabs[0]
  let headers: string[] = []
  let rows: string[][] = []

  if (firstTab) {
    try {
      const previewData = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `'${firstTab.title}'!A1:Z6`,
      })

      const values = previewData.data.values || []
      if (values.length > 0) {
        headers = values[0].map((v) => String(v || ''))
        rows = values.slice(1).map((row) => row.map((v) => String(v || '')))
      }
    } catch (error) {
      console.error('Error fetching preview data:', error)
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
 */
export async function getSheetData(
  accessToken: string,
  spreadsheetId: string,
  tabName: string
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

  return {
    headers: values[0].map((v) => String(v || '')),
    rows: values.slice(1).map((row) => row.map((v) => String(v || ''))),
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

  // Get first N rows for preview
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${tabName}'!A1:ZZ${maxRows}`,
  })

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

  // Get total row count from metadata
  const metadata = await sheets.spreadsheets.get({
    spreadsheetId,
    ranges: [`'${tabName}'`],
    fields: 'sheets.properties.gridProperties.rowCount',
  })

  const totalRows = metadata.data.sheets?.[0]?.properties?.gridProperties?.rowCount || values.length

  return {
    rows: normalizedRows,
    totalRows,
  }
}

/**
 * Auto-detect header row by analyzing row content
 * Returns the likely header row index (0-based)
 */
export function detectHeaderRow(rows: string[][]): number {
  if (rows.length === 0) return 0

  // Heuristics:
  // 1. Header rows typically have more non-empty cells
  // 2. Header rows have text-like values (not numbers/dates)
  // 3. First row after empty/sparse rows is likely header

  let bestHeaderIndex = 0
  let bestScore = 0

  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const row = rows[i]
    let score = 0

    // Count non-empty cells
    const nonEmpty = row.filter(cell => cell.trim() !== '').length
    score += nonEmpty * 2

    // Bonus if cells look like headers (short text, no numbers)
    const headerLikeCells = row.filter(cell => {
      const trimmed = cell.trim()
      if (!trimmed) return false
      // Headers are usually short and text-like
      if (trimmed.length > 50) return false
      // Headers usually don't start with numbers
      if (/^\d+\.?\d*$/.test(trimmed)) return false
      return true
    }).length
    score += headerLikeCells * 3

    // Penalty for rows that look like data (have emails, URLs, long text)
    const dataLikeCells = row.filter(cell => {
      return cell.includes('@') || cell.includes('http') || cell.length > 100
    }).length
    score -= dataLikeCells * 5

    // Check if next row has different "type" (suggests this is header)
    if (i < rows.length - 1) {
      const nextRow = rows[i + 1]
      const currentTypes = row.map(c => guessType(c))
      const nextTypes = nextRow.map(c => guessType(c))
      const typeDiffs = currentTypes.filter((t, idx) => t !== nextTypes[idx]).length
      if (typeDiffs > currentTypes.length / 2) {
        score += 10 // This row is likely a header
      }
    }

    if (score > bestScore) {
      bestScore = score
      bestHeaderIndex = i
    }
  }

  return bestHeaderIndex
}

function guessType(value: string): 'empty' | 'number' | 'date' | 'email' | 'text' {
  const trimmed = value.trim()
  if (!trimmed) return 'empty'
  if (/^\d+\.?\d*$/.test(trimmed)) return 'number'
  if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(trimmed)) return 'date'
  if (trimmed.includes('@')) return 'email'
  return 'text'
}
