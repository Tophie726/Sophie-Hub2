import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { requireAuth, canAccessPartner } from '@/lib/auth/api-auth'
import { apiSuccess, ApiErrors } from '@/lib/api/response'
import { getAdminClient } from '@/lib/supabase/admin'
import { google } from 'googleapis'
import { mapSheetsAuthError, resolveSheetsAccessToken } from '@/lib/google/sheets-auth'

const supabase = getAdminClient()

interface SourceUrlResponse {
  spreadsheet_url: string | null
  source_name: string
  tab_name: string
  row_number: number | null
  column_letter: string | null
  cell_reference: string | null
}

// Convert column index (0-based) to letter (A, B, ... Z, AA, AB, etc.)
function columnIndexToLetter(index: number): string {
  let letter = ''
  let temp = index
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter
    temp = Math.floor(temp / 26) - 1
  }
  return letter
}

// Check if a column name is a weekly status column
function isWeeklyColumn(columnName: string): boolean {
  // Pattern: date followed by "Week" and a number
  // Examples: "1/1/24\nWeek 1", "12/30/24\nWeek 53", "2/5/24 Week 6"
  return /\d{1,2}\/\d{1,2}\/\d{2,4}[\s\n]+Week\s*\d+/i.test(columnName)
}

// Parse date from weekly column name
function parseWeeklyColumnDate(columnName: string): Date | null {
  const match = columnName.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/)
  if (!match) return null

  const [, month, day, year] = match
  let fullYear = parseInt(year, 10)
  if (fullYear < 100) {
    fullYear += fullYear > 50 ? 1900 : 2000
  }

  return new Date(fullYear, parseInt(month, 10) - 1, parseInt(day, 10))
}

/**
 * GET /api/partners/[id]/source-url
 *
 * Returns the Google Sheet URL linking directly to the partner's
 * latest weekly status cell.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth()
  if (!auth.authenticated) return auth.response

  const { id: partnerId } = await params

  if (!partnerId) {
    return ApiErrors.notFound('Partner ID')
  }

  // Verify the user has access to this specific partner
  const hasAccess = await canAccessPartner(auth.user.id, auth.user.role, partnerId)
  if (!hasAccess) {
    return ApiErrors.forbidden('You do not have access to this partner')
  }

  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return ApiErrors.unauthorized('Not authenticated')
  }

  let accessToken: string | null = null
  try {
    const resolved = await resolveSheetsAccessToken(session.accessToken)
    accessToken = resolved.accessToken
  } catch (authError) {
    const mapped = mapSheetsAuthError(authError)
    // Source URL can still return a non-cell deep link when auth is unavailable.
    // Only hard-fail auth errors that indicate an unauthenticated user.
    if (mapped.status === 401) {
      return ApiErrors.unauthorized(mapped.message)
    }
  }

  try {
    // 1. Get the partner
    const { data: partner, error: partnerError } = await supabase
      .from('partners')
      .select('id, brand_name, partner_code')
      .eq('id', partnerId)
      .single()

    if (partnerError || !partner) {
      return ApiErrors.notFound('Partner')
    }

    // 2. Find tab mapping for partners entity
    const { data: tabMapping, error: tabError } = await supabase
      .from('tab_mappings')
      .select(`
        id,
        tab_name,
        header_row,
        data_source:data_source_id (
          id,
          name,
          connection_config
        )
      `)
      .eq('primary_entity', 'partners')
      .limit(1)
      .single()

    if (tabError) {
      if (tabError.code === 'PGRST116') {
        return apiSuccess({
          spreadsheet_url: null,
          source_name: 'No data source configured',
          tab_name: '',
          row_number: null,
          column_letter: null,
          cell_reference: null,
        } satisfies SourceUrlResponse)
      }
      return ApiErrors.database()
    }

    const dataSource = tabMapping?.data_source as unknown as {
      id: string
      name: string
      connection_config: {
        spreadsheet_url?: string
        spreadsheet_id?: string
      }
    } | null

    if (!dataSource) {
      return apiSuccess({
        spreadsheet_url: null,
        source_name: 'Data source not found',
        tab_name: tabMapping?.tab_name || '',
        row_number: null,
        column_letter: null,
        cell_reference: null,
      } satisfies SourceUrlResponse)
    }

    // Get spreadsheet ID
    let spreadsheetId = dataSource.connection_config?.spreadsheet_id
    if (!spreadsheetId && dataSource.connection_config?.spreadsheet_url) {
      const match = dataSource.connection_config.spreadsheet_url.match(/\/d\/([a-zA-Z0-9-_]+)/)
      spreadsheetId = match?.[1]
    }

    if (!spreadsheetId) {
      return apiSuccess({
        spreadsheet_url: null,
        source_name: dataSource.name,
        tab_name: tabMapping.tab_name,
        row_number: null,
        column_letter: null,
        cell_reference: null,
      } satisfies SourceUrlResponse)
    }

    // 3. Find the key column mapping
    const { data: keyMapping } = await supabase
      .from('column_mappings')
      .select('source_column, target_field')
      .eq('tab_mapping_id', tabMapping.id)
      .eq('is_key', true)
      .single()

    // Key value - use brand_name as the lookup value
    const keyValue = partner.brand_name
    // Source column for key - try from mapping, fallback to common names
    const sourceKeyColumn = keyMapping?.source_column || 'Brand'

    // 4. Fetch sheet data and find the partner's row + latest weekly column
    let rowNumber: number | null = null
    let columnLetter: string | null = null
    let cellReference: string | null = null
    let tabGid: number | null = null

    console.log(`[source-url] Looking up: ${partner.brand_name}, keyColumn: ${sourceKeyColumn}, hasToken: ${!!accessToken}`)

    if (accessToken && keyValue) {
      try {
        const googleAuth = new google.auth.OAuth2()
        googleAuth.setCredentials({ access_token: accessToken })
        const sheets = google.sheets({ version: 'v4', auth: googleAuth })

        // Get spreadsheet metadata for GID
        const metadata = await sheets.spreadsheets.get({
          spreadsheetId,
          fields: 'sheets.properties',
        })

        const targetTab = metadata.data.sheets?.find(
          sheet => sheet.properties?.title === tabMapping.tab_name
        )
        tabGid = targetTab?.properties?.sheetId ?? null

        // Fetch sheet data
        const headerRow = tabMapping.header_row ?? 0
        const dataResponse = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `'${tabMapping.tab_name}'!A${headerRow + 1}:ZZ`,
        })

        const rows = dataResponse.data.values || []
        console.log(`[source-url] Fetched ${rows.length} rows, headerRow: ${headerRow}`)

        if (rows.length > 0) {
          const headers = rows[0] as string[]

          // Try to find key column - check configured name and common alternatives
          let keyColIndex = headers.findIndex(h => h === sourceKeyColumn)
          if (keyColIndex === -1) {
            // Try common column names for brand/partner identification
            const alternatives = ['Brand', 'Brand Name', 'Partner', 'Partner Name', 'Client', 'Company', 'Account']
            for (const alt of alternatives) {
              keyColIndex = headers.findIndex(h => h?.toLowerCase() === alt.toLowerCase())
              if (keyColIndex !== -1) break
            }
          }

          console.log(`[source-url] Key column index: ${keyColIndex}, headers sample: ${headers.slice(0, 5).join(', ')}`)

          if (keyColIndex !== -1) {
            // Find the partner's row
            for (let i = 1; i < rows.length; i++) {
              const cellValue = rows[i]?.[keyColIndex]?.toString().trim()
              if (cellValue?.toLowerCase() === keyValue.toLowerCase()) {
                // Found the row! Row number = header_row + 1 (for header in A1 notation) + i (0-based data index) + 1 (1-based sheets)
                rowNumber = headerRow + 1 + i + 1

                // Now find the latest weekly column WITH DATA for this partner
                let latestDate: Date | null = null
                let latestColIndex: number | null = null

                for (let colIdx = 0; colIdx < headers.length; colIdx++) {
                  const header = headers[colIdx]
                  if (!header || !isWeeklyColumn(header)) continue

                  // Check if this cell has data for this partner
                  const cellData = rows[i]?.[colIdx]
                  if (!cellData || cellData.toString().trim() === '') continue

                  const colDate = parseWeeklyColumnDate(header)
                  if (colDate && (!latestDate || colDate > latestDate)) {
                    latestDate = colDate
                    latestColIndex = colIdx
                  }
                }

                console.log(`[source-url] Found row ${rowNumber}, latestColIndex: ${latestColIndex}`)

                if (latestColIndex !== null) {
                  columnLetter = columnIndexToLetter(latestColIndex)
                  cellReference = `${columnLetter}${rowNumber}`
                }

                break
              }
            }
          }
        }

        console.log(`[source-url] Result - Partner: ${partner.brand_name}, Row: ${rowNumber}, Cell: ${cellReference}, GID: ${tabGid}`)

      } catch (error) {
        console.error('[source-url] Error fetching sheet data:', error)
      }
    } else {
      console.log(`[source-url] Skipping lookup - no accessToken or keyValue`)
    }

    // 5. Build the URL
    // Google Sheets URL format: /edit#gid=SHEET_ID&range=CELL
    let spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`

    if (tabGid !== null && cellReference) {
      // Direct link to the specific cell
      spreadsheetUrl += `#gid=${tabGid}&range=${cellReference}`
    } else if (tabGid !== null && rowNumber) {
      // Fallback: link to row in column A
      spreadsheetUrl += `#gid=${tabGid}&range=A${rowNumber}`
    } else if (tabGid !== null) {
      // Just the tab
      spreadsheetUrl += `#gid=${tabGid}`
    }

    return apiSuccess({
      spreadsheet_url: spreadsheetUrl,
      source_name: dataSource.name,
      tab_name: tabMapping.tab_name,
      row_number: rowNumber,
      column_letter: columnLetter,
      cell_reference: cellReference,
    } satisfies SourceUrlResponse)

  } catch (error) {
    console.error('Error in GET /api/partners/[id]/source-url:', error)
    return ApiErrors.internal()
  }
}
