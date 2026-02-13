import { getAdminClient } from '@/lib/supabase/admin'
import {
  detectHeaderRow,
  getSheetPreview,
  getSheetRawRows,
  type SheetPreview,
  type SheetTab,
} from '@/lib/google/sheets'
import { invalidateClientNamesCache } from '@/lib/connectors/bigquery-cache'
import { inferMarketplaceCodeFromText } from '@/lib/amazon/marketplaces'

const supabase = getAdminClient()

const DEFAULT_REFERENCE_SPREADSHEET_ID = '1PJqI5AkiosJ8b-J7zkjXiPO55XqNmyQi1MfNMei47lU'
const DEFAULT_REFERENCE_TAB_GID = 0
const MAX_REFERENCE_ROWS = 5000

const CLIENT_ID_HEADERS = [
  'client id',
  'client_id',
  'clientid',
  'bigquery client id',
  'bq client id',
]

const BRAND_HEADERS = [
  'brand',
  'brand name',
  'partner',
  'partner name',
]

const CLIENT_NAME_HEADERS = [
  'client name',
  'client_name',
  'bigquery client name',
  'bq client name',
]

type PartnerMatchType = 'exact' | 'normalized'

type SuggestionStatus =
  | 'ready'
  | 'already_mapped'
  | 'partner_not_found'
  | 'ambiguous_partner'
  | 'client_conflict'
  | 'missing_data'

interface PartnerRow {
  id: string
  brand_name: string
}

interface ExternalMappingRow {
  id: string
  entity_id: string
  external_id: string
  metadata: Record<string, unknown> | null
}

interface ReferenceSheetRow {
  rowNumber: number
  brand: string
  clientId: string
  clientName: string | null
}

export interface BigQuerySheetSuggestion {
  rowNumber: number
  brand: string
  clientId: string
  clientName: string | null
  matchedPartnerId: string | null
  matchedPartnerName: string | null
  partnerMatchType: PartnerMatchType | null
  status: SuggestionStatus
  currentPartnerMappingId: string | null
  currentPartnerExternalId: string | null
  currentPartnerMappingMetadata: Record<string, unknown> | null
  conflictingPartnerName: string | null
}

interface ReferenceSheetColumns {
  clientId: string | null
  brand: string | null
  clientName: string | null
}

interface ReferenceSheetContext {
  spreadsheetId: string
  title: string
  tab: SheetTab
  headerRow: number
  columns: ReferenceSheetColumns
  rows: ReferenceSheetRow[]
}

export interface BigQueryReferenceSheetPreview {
  sheet: {
    spreadsheetId: string
    title: string
    tabName: string
    tabId: number
    headerRow: number
    columns: ReferenceSheetColumns
    parsedRows: number
    maxRowsFetched: number
  }
  summary: Record<SuggestionStatus, number>
  suggestions: BigQuerySheetSuggestion[]
}

export interface BigQueryReferenceSheetSyncResult extends BigQueryReferenceSheetPreview {
  applied: number
  inserted: number
  updated: number
  skipped: number
  conflicts: number
  dryRun: boolean
}

export interface ReferenceSheetSyncTriggerResult {
  triggered: boolean
  reason?: string
  result?: BigQueryReferenceSheetSyncResult
}

function normalizeHeader(value: string): string {
  return value
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase()
}

function foldToAscii(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
}

function normalizeName(value: string): string {
  return foldToAscii(value)
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function compactName(value: string): string {
  return normalizeName(value).replace(/[^a-z0-9]/g, '')
}

const CANONICAL_NOISE_TOKENS = new Set([
  'and',
  'co',
  'company',
  'corp',
  'corporation',
  'group',
  'holdings',
  'inc',
  'incorporated',
  'international',
  'intl',
  'limited',
  'llc',
  'ltd',
  'official',
  'plc',
  'pty',
  'shop',
  'the',
  'us',
  'usa',
  'uk',
  'ca',
  'mx',
])

function tokenizeName(value: string): string[] {
  return foldToAscii(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .map(token => token.trim())
    .filter(Boolean)
}

function canonicalCompactName(value: string): string {
  const filtered = tokenizeName(value).filter(token => !CANONICAL_NOISE_TOKENS.has(token))
  const compact = filtered.join('')
  return compact || compactName(value)
}

function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  const prev = new Array<number>(b.length + 1)
  const curr = new Array<number>(b.length + 1)

  for (let j = 0; j <= b.length; j++) {
    prev[j] = j
  }

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i
    const aChar = a.charCodeAt(i - 1)

    for (let j = 1; j <= b.length; j++) {
      const cost = aChar === b.charCodeAt(j - 1) ? 0 : 1
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + cost
      )
    }

    for (let j = 0; j <= b.length; j++) {
      prev[j] = curr[j]
    }
  }

  return prev[b.length]
}

function getReferenceSpreadsheetId(): string {
  return process.env.BIGQUERY_REFERENCE_SHEET_ID?.trim() || DEFAULT_REFERENCE_SPREADSHEET_ID
}

function getReferenceTabName(): string | null {
  const tabName = process.env.BIGQUERY_REFERENCE_SHEET_TAB_NAME?.trim()
  return tabName || null
}

function getReferenceTabGid(): number {
  const raw = process.env.BIGQUERY_REFERENCE_SHEET_TAB_GID
  const parsed = raw ? Number.parseInt(raw, 10) : DEFAULT_REFERENCE_TAB_GID
  return Number.isFinite(parsed) ? parsed : DEFAULT_REFERENCE_TAB_GID
}

function getColumnHint(envKey: string): string | null {
  const value = process.env[envKey]?.trim()
  return value ? normalizeHeader(value) : null
}

function resolveTab(preview: SheetPreview): SheetTab {
  const preferredTabName = getReferenceTabName()
  const preferredTabGid = getReferenceTabGid()

  if (preferredTabName) {
    const byName = preview.tabs.find(tab => tab.title.toLowerCase() === preferredTabName.toLowerCase())
    if (byName) return byName
  }

  const byGid = preview.tabs.find(tab => tab.sheetId === preferredTabGid)
  if (byGid) return byGid

  if (preview.tabs.length === 0) {
    throw new Error('Reference sheet has no tabs')
  }

  return preview.tabs[0]
}

function findHeaderIndex(
  headers: string[],
  candidates: string[],
  hint: string | null
): number {
  const normalizedHeaders = headers.map(normalizeHeader)

  if (hint) {
    const exactHint = normalizedHeaders.findIndex(header => header === hint)
    if (exactHint >= 0) return exactHint
  }

  for (const candidate of candidates.map(normalizeHeader)) {
    const exact = normalizedHeaders.findIndex(header => header === candidate)
    if (exact >= 0) return exact
  }

  for (const candidate of candidates.map(normalizeHeader)) {
    const fuzzy = normalizedHeaders.findIndex(header => header.includes(candidate))
    if (fuzzy >= 0) return fuzzy
  }

  return -1
}

function buildSummary(suggestions: BigQuerySheetSuggestion[]): Record<SuggestionStatus, number> {
  const summary: Record<SuggestionStatus, number> = {
    ready: 0,
    already_mapped: 0,
    partner_not_found: 0,
    ambiguous_partner: 0,
    client_conflict: 0,
    missing_data: 0,
  }

  for (const suggestion of suggestions) {
    summary[suggestion.status] += 1
  }

  return summary
}

function mergeSheetMetadata(
  existing: Record<string, unknown> | null,
  context: ReferenceSheetContext,
  suggestion: BigQuerySheetSuggestion
): Record<string, unknown> {
  const metadata = existing && typeof existing === 'object' ? { ...existing } : {}
  const inferredMarketplaceCode = inferMarketplaceCodeFromText(
    suggestion.clientId,
    suggestion.clientName,
    suggestion.brand
  )

  metadata.reference_sheet = {
    spreadsheet_id: context.spreadsheetId,
    tab_name: context.tab.title,
    tab_gid: context.tab.sheetId,
    row_number: suggestion.rowNumber,
    brand: suggestion.brand,
    client_id: suggestion.clientId,
    client_name: suggestion.clientName,
    marketplace_code: inferredMarketplaceCode,
    synced_at: new Date().toISOString(),
  }

  if (inferredMarketplaceCode) {
    metadata.marketplace_code = inferredMarketplaceCode
    metadata.marketplace_source = 'reference_sheet_inference'
  }

  return metadata
}

async function shouldRunForTriggerTab(tabMappingId: string, spreadsheetId: string): Promise<boolean> {
  const { data: tabMapping, error } = await supabase
    .from('tab_mappings')
    .select(`
      id,
      data_source:data_sources (
        spreadsheet_id,
        connection_config
      )
    `)
    .eq('id', tabMappingId)
    .maybeSingle()

  if (error || !tabMapping) return false

  const rawDataSource = tabMapping.data_source as unknown
  const dataSource = (Array.isArray(rawDataSource) ? rawDataSource[0] : rawDataSource) as {
    spreadsheet_id: string | null
    connection_config: Record<string, unknown> | null
  } | null

  const configSpreadsheetId = typeof dataSource?.connection_config?.spreadsheet_id === 'string'
    ? dataSource.connection_config.spreadsheet_id
    : null
  const effectiveSpreadsheetId = configSpreadsheetId || dataSource?.spreadsheet_id || null

  return effectiveSpreadsheetId === spreadsheetId
}

async function loadReferenceSheetContext(accessToken: string): Promise<ReferenceSheetContext> {
  const spreadsheetId = getReferenceSpreadsheetId()
  const preview = await getSheetPreview(accessToken, spreadsheetId)
  const tab = resolveTab(preview)
  const { rows: rawRows } = await getSheetRawRows(accessToken, spreadsheetId, tab.title, MAX_REFERENCE_ROWS)

  if (!rawRows || rawRows.length === 0) {
    return {
      spreadsheetId,
      title: preview.title,
      tab,
      headerRow: 0,
      columns: {
        clientId: null,
        brand: null,
        clientName: null,
      },
      rows: [],
    }
  }

  const headerDetection = detectHeaderRow(rawRows)
  const headerRow = Math.max(0, Math.min(headerDetection.rowIndex, rawRows.length - 1))
  const headers = rawRows[headerRow] || []

  const clientIdIdx = findHeaderIndex(
    headers,
    CLIENT_ID_HEADERS,
    getColumnHint('BIGQUERY_REFERENCE_SHEET_CLIENT_ID_COLUMN')
  )
  const brandIdx = findHeaderIndex(
    headers,
    BRAND_HEADERS,
    getColumnHint('BIGQUERY_REFERENCE_SHEET_BRAND_COLUMN')
  )
  const clientNameIdx = findHeaderIndex(
    headers,
    CLIENT_NAME_HEADERS,
    getColumnHint('BIGQUERY_REFERENCE_SHEET_CLIENT_NAME_COLUMN')
  )

  const rows: ReferenceSheetRow[] = []
  for (let i = headerRow + 1; i < rawRows.length; i++) {
    const row = rawRows[i] || []
    const clientId = clientIdIdx >= 0 ? String(row[clientIdIdx] || '').trim() : ''
    const brand = brandIdx >= 0 ? String(row[brandIdx] || '').trim() : ''
    const clientName = clientNameIdx >= 0 ? String(row[clientNameIdx] || '').trim() : ''

    if (!clientId && !brand) continue

    rows.push({
      rowNumber: i + 1,
      clientId,
      brand,
      clientName: clientName || null,
    })
  }

  return {
    spreadsheetId,
    title: preview.title,
    tab,
    headerRow,
    columns: {
      clientId: clientIdIdx >= 0 ? headers[clientIdIdx] || null : null,
      brand: brandIdx >= 0 ? headers[brandIdx] || null : null,
      clientName: clientNameIdx >= 0 ? headers[clientNameIdx] || null : null,
    },
    rows,
  }
}

function resolvePartnerMatch(
  brand: string,
  exactMap: Map<string, PartnerRow[]>,
  compactMap: Map<string, PartnerRow[]>,
  canonicalMap: Map<string, PartnerRow[]>
): { partner: PartnerRow | null; matchType: PartnerMatchType | null; ambiguous: boolean } {
  const normalizedBrand = normalizeName(brand)
  if (!normalizedBrand) {
    return { partner: null, matchType: null, ambiguous: false }
  }

  const exactMatches = exactMap.get(normalizedBrand) || []
  if (exactMatches.length === 1) {
    return { partner: exactMatches[0], matchType: 'exact', ambiguous: false }
  }
  if (exactMatches.length > 1) {
    return { partner: null, matchType: null, ambiguous: true }
  }

  const compactBrand = compactName(brand)
  if (!compactBrand) {
    return { partner: null, matchType: null, ambiguous: false }
  }

  const normalizedMatches = compactMap.get(compactBrand) || []
  if (normalizedMatches.length === 1) {
    return { partner: normalizedMatches[0], matchType: 'normalized', ambiguous: false }
  }
  if (normalizedMatches.length > 1) {
    return { partner: null, matchType: null, ambiguous: true }
  }

  const canonicalBrand = canonicalCompactName(brand)
  if (!canonicalBrand) {
    return { partner: null, matchType: null, ambiguous: false }
  }

  const canonicalMatches = canonicalMap.get(canonicalBrand) || []
  if (canonicalMatches.length === 1) {
    return { partner: canonicalMatches[0], matchType: 'normalized', ambiguous: false }
  }
  if (canonicalMatches.length > 1) {
    return { partner: null, matchType: null, ambiguous: true }
  }

  // Fallback 1: unique containment/prefix match with confidence scoring.
  // Handles variants like "AquaCare" vs "AquaCare UK Holdings".
  const containsScoresByPartner = new Map<string, { partner: PartnerRow; score: number }>()
  canonicalMap.forEach((partners, partnerCanonical) => {
    if (!partnerCanonical) return

    if (partnerCanonical.includes(canonicalBrand) || canonicalBrand.includes(partnerCanonical)) {
      const shortest = Math.min(canonicalBrand.length, partnerCanonical.length)
      const longest = Math.max(canonicalBrand.length, partnerCanonical.length)
      if (shortest < 5 || longest === 0) return

      const score = shortest / longest
      if (score < 0.45) return

      for (const partner of partners) {
        const existing = containsScoresByPartner.get(partner.id)
        if (!existing || score > existing.score) {
          containsScoresByPartner.set(partner.id, { partner, score })
        }
      }
    }
  })

  const containsCandidates = Array.from(containsScoresByPartner.values())
    .sort((a, b) => b.score - a.score)

  if (containsCandidates.length === 1) {
    return { partner: containsCandidates[0].partner, matchType: 'normalized', ambiguous: false }
  }
  if (containsCandidates.length > 1) {
    const top = containsCandidates[0]
    const second = containsCandidates[1]
    const isDistinctTop = (top.score - second.score) >= 0.18 && top.score >= 0.55
    if (isDistinctTop) {
      return { partner: top.partner, matchType: 'normalized', ambiguous: false }
    }
    return { partner: null, matchType: null, ambiguous: true }
  }

  // Fallback 2: unique close typo match on canonical strings.
  let bestDistance = Number.POSITIVE_INFINITY
  let bestCandidates: PartnerRow[] = []
  canonicalMap.forEach((partners, partnerCanonical) => {
    if (!partnerCanonical) return

    const maxLen = Math.max(canonicalBrand.length, partnerCanonical.length)
    if (maxLen < 5) return

    const distance = levenshteinDistance(canonicalBrand, partnerCanonical)
    const threshold = maxLen >= 10 ? 2 : 1
    if (distance > threshold) return

    if (distance < bestDistance) {
      bestDistance = distance
      bestCandidates = [...partners]
      return
    }

    if (distance === bestDistance) {
      bestCandidates.push(...partners)
    }
  })

  if (bestCandidates.length > 0) {
    const uniqueBest = Array.from(new Map(bestCandidates.map(partner => [partner.id, partner])).values())
    if (uniqueBest.length === 1) {
      return { partner: uniqueBest[0], matchType: 'normalized', ambiguous: false }
    }
    return { partner: null, matchType: null, ambiguous: true }
  }

  return { partner: null, matchType: null, ambiguous: false }
}

async function buildSuggestions(
  context: ReferenceSheetContext
): Promise<{
  suggestions: BigQuerySheetSuggestion[]
  mappingsByPartnerId: Map<string, ExternalMappingRow[]>
  mappingByPartnerExternal: Map<string, ExternalMappingRow>
}> {
  const [{ data: partners, error: partnerError }, { data: mappings, error: mappingError }] = await Promise.all([
    supabase
      .from('partners')
      .select('id, brand_name')
      .order('brand_name'),
    supabase
      .from('entity_external_ids')
      .select('id, entity_id, external_id, metadata')
      .eq('entity_type', 'partners')
      .eq('source', 'bigquery'),
  ])

  if (partnerError) {
    throw new Error(`Failed to load partners: ${partnerError.message}`)
  }
  if (mappingError) {
    throw new Error(`Failed to load BigQuery mappings: ${mappingError.message}`)
  }

  const partnerRows = (partners || []) as PartnerRow[]
  const mappingRows = (mappings || []) as ExternalMappingRow[]

  const exactMap = new Map<string, PartnerRow[]>()
  const compactMap = new Map<string, PartnerRow[]>()
  const canonicalMap = new Map<string, PartnerRow[]>()
  const partnerById = new Map<string, PartnerRow>()

  for (const partner of partnerRows) {
    partnerById.set(partner.id, partner)

    const normalized = normalizeName(partner.brand_name)
    if (normalized) {
      const byExact = exactMap.get(normalized) || []
      byExact.push(partner)
      exactMap.set(normalized, byExact)
    }

    const compact = compactName(partner.brand_name)
    if (compact) {
      const byCompact = compactMap.get(compact) || []
      byCompact.push(partner)
      compactMap.set(compact, byCompact)
    }

    const canonical = canonicalCompactName(partner.brand_name)
    if (canonical) {
      const byCanonical = canonicalMap.get(canonical) || []
      byCanonical.push(partner)
      canonicalMap.set(canonical, byCanonical)
    }
  }

  const mappingsByPartnerId = new Map<string, ExternalMappingRow[]>()
  const mappingByExternalId = new Map<string, ExternalMappingRow>()
  const mappingByPartnerExternal = new Map<string, ExternalMappingRow>()

  for (const mapping of mappingRows) {
    const byPartner = mappingsByPartnerId.get(mapping.entity_id) || []
    byPartner.push(mapping)
    mappingsByPartnerId.set(mapping.entity_id, byPartner)

    mappingByExternalId.set(normalizeKey(mapping.external_id), mapping)
    mappingByPartnerExternal.set(
      `${mapping.entity_id}::${normalizeKey(mapping.external_id)}`,
      mapping
    )
  }

  const suggestions = context.rows.map((row): BigQuerySheetSuggestion => {
    const hasClientId = !!row.clientId
    const hasBrand = !!row.brand

    if (!hasClientId || !hasBrand) {
      return {
        rowNumber: row.rowNumber,
        brand: row.brand,
        clientId: row.clientId,
        clientName: row.clientName,
        matchedPartnerId: null,
        matchedPartnerName: null,
        partnerMatchType: null,
        status: 'missing_data',
        currentPartnerMappingId: null,
        currentPartnerExternalId: null,
        currentPartnerMappingMetadata: null,
        conflictingPartnerName: null,
      }
    }

    const match = resolvePartnerMatch(row.brand, exactMap, compactMap, canonicalMap)
    if (match.ambiguous) {
      return {
        rowNumber: row.rowNumber,
        brand: row.brand,
        clientId: row.clientId,
        clientName: row.clientName,
        matchedPartnerId: null,
        matchedPartnerName: null,
        partnerMatchType: null,
        status: 'ambiguous_partner',
        currentPartnerMappingId: null,
        currentPartnerExternalId: null,
        currentPartnerMappingMetadata: null,
        conflictingPartnerName: null,
      }
    }

    if (!match.partner) {
      return {
        rowNumber: row.rowNumber,
        brand: row.brand,
        clientId: row.clientId,
        clientName: row.clientName,
        matchedPartnerId: null,
        matchedPartnerName: null,
        partnerMatchType: null,
        status: 'partner_not_found',
        currentPartnerMappingId: null,
        currentPartnerExternalId: null,
        currentPartnerMappingMetadata: null,
        conflictingPartnerName: null,
      }
    }

    const currentPartnerMapping = mappingByPartnerExternal.get(
      `${match.partner.id}::${normalizeKey(row.clientId)}`
    ) || null
    const clientIdMapping = mappingByExternalId.get(normalizeKey(row.clientId)) || null

    let status: SuggestionStatus = 'ready'
    let conflictingPartnerName: string | null = null

    if (clientIdMapping && clientIdMapping.entity_id !== match.partner.id) {
      const conflictingPartner = partnerById.get(clientIdMapping.entity_id)
      conflictingPartnerName = conflictingPartner?.brand_name || null
      status = 'client_conflict'
    } else if (
      currentPartnerMapping &&
      normalizeKey(currentPartnerMapping.external_id) === normalizeKey(row.clientId)
    ) {
      status = 'already_mapped'
    }

    return {
      rowNumber: row.rowNumber,
      brand: row.brand,
      clientId: row.clientId,
      clientName: row.clientName,
      matchedPartnerId: match.partner.id,
      matchedPartnerName: match.partner.brand_name,
      partnerMatchType: match.matchType,
      status,
      currentPartnerMappingId: currentPartnerMapping?.id || null,
      currentPartnerExternalId: currentPartnerMapping?.external_id || null,
      currentPartnerMappingMetadata: currentPartnerMapping?.metadata || null,
      conflictingPartnerName,
    }
  })

  return { suggestions, mappingsByPartnerId, mappingByPartnerExternal }
}

export async function buildBigQueryReferenceSheetPreview(
  accessToken: string
): Promise<BigQueryReferenceSheetPreview> {
  const context = await loadReferenceSheetContext(accessToken)
  const { suggestions } = await buildSuggestions(context)

  return {
    sheet: {
      spreadsheetId: context.spreadsheetId,
      title: context.title,
      tabName: context.tab.title,
      tabId: context.tab.sheetId,
      headerRow: context.headerRow,
      columns: context.columns,
      parsedRows: context.rows.length,
      maxRowsFetched: MAX_REFERENCE_ROWS,
    },
    summary: buildSummary(suggestions),
    suggestions,
  }
}

export async function applyBigQueryReferenceSheetMappings(
  accessToken: string,
  options?: {
    dryRun?: boolean
  }
): Promise<BigQueryReferenceSheetSyncResult> {
  const context = await loadReferenceSheetContext(accessToken)
  const { suggestions, mappingsByPartnerId, mappingByPartnerExternal } = await buildSuggestions(context)
  const summary = buildSummary(suggestions)
  const dryRun = options?.dryRun === true

  const readySuggestions = suggestions.filter(
    suggestion => suggestion.status === 'ready' && suggestion.matchedPartnerId
  )

  let inserted = 0
  let updated = 0
  let skipped = 0
  let conflicts = 0
  const processedMappingKeys = new Set<string>()

  if (!dryRun) {
    for (const suggestion of readySuggestions) {
      const partnerId = suggestion.matchedPartnerId!
      const mappingKey = `${partnerId}::${normalizeKey(suggestion.clientId)}`
      if (processedMappingKeys.has(mappingKey)) {
        skipped += 1
        continue
      }
      processedMappingKeys.add(mappingKey)

      const existing = mappingByPartnerExternal.get(mappingKey) || null
      const metadata = mergeSheetMetadata(
        (existing?.metadata as Record<string, unknown> | null) || suggestion.currentPartnerMappingMetadata,
        context,
        suggestion
      )

      const payload = {
        entity_type: 'partners' as const,
        entity_id: partnerId,
        source: 'bigquery' as const,
        external_id: suggestion.clientId,
        metadata,
        updated_at: new Date().toISOString(),
      }

      if (existing?.id) {
        const { data: updatedMapping, error } = await supabase
          .from('entity_external_ids')
          .update(payload)
          .eq('id', existing.id)
          .select('id, entity_id, external_id, metadata')
          .single()

        if (error) {
          if (error.code === '23505') {
            conflicts += 1
            continue
          }
          throw new Error(`Failed to update BigQuery mapping: ${error.message}`)
        }

        if (updatedMapping) {
          const normalizedUpdated = updatedMapping as ExternalMappingRow
          const byPartner = mappingsByPartnerId.get(partnerId) || []
          const idx = byPartner.findIndex(item => item.id === normalizedUpdated.id)
          if (idx >= 0) {
            byPartner[idx] = normalizedUpdated
          } else {
            byPartner.push(normalizedUpdated)
          }
          mappingsByPartnerId.set(partnerId, byPartner)
          mappingByPartnerExternal.set(mappingKey, normalizedUpdated)
          updated += 1
        } else {
          skipped += 1
        }
      } else {
        const { data: insertedMapping, error } = await supabase
          .from('entity_external_ids')
          .insert(payload)
          .select('id, entity_id, external_id, metadata')
          .single()

        if (error) {
          if (error.code === '23505') {
            conflicts += 1
            continue
          }
          throw new Error(`Failed to create BigQuery mapping: ${error.message}`)
        }

        if (insertedMapping) {
          const normalizedInserted = insertedMapping as ExternalMappingRow
          const byPartner = mappingsByPartnerId.get(partnerId) || []
          byPartner.push(normalizedInserted)
          mappingsByPartnerId.set(partnerId, byPartner)
          mappingByPartnerExternal.set(mappingKey, normalizedInserted)
          inserted += 1
        } else {
          skipped += 1
        }
      }
    }

    if (inserted > 0 || updated > 0) {
      invalidateClientNamesCache()
    }
  }

  return {
    sheet: {
      spreadsheetId: context.spreadsheetId,
      title: context.title,
      tabName: context.tab.title,
      tabId: context.tab.sheetId,
      headerRow: context.headerRow,
      columns: context.columns,
      parsedRows: context.rows.length,
      maxRowsFetched: MAX_REFERENCE_ROWS,
    },
    summary,
    suggestions,
    applied: dryRun ? readySuggestions.length : inserted + updated,
    inserted: dryRun ? 0 : inserted,
    updated: dryRun ? 0 : updated,
    skipped: dryRun ? 0 : skipped,
    conflicts: dryRun ? 0 : conflicts,
    dryRun,
  }
}

export async function maybeSyncBigQueryMappingsFromReferenceSheetOnTabSync(
  accessToken: string,
  options: {
    triggerTabMappingId: string
    dryRun?: boolean
  }
): Promise<ReferenceSheetSyncTriggerResult> {
  const spreadsheetId = getReferenceSpreadsheetId()
  const shouldRun = await shouldRunForTriggerTab(options.triggerTabMappingId, spreadsheetId)

  if (!shouldRun) {
    return {
      triggered: false,
      reason: 'sync-tab-not-on-reference-sheet',
    }
  }

  const result = await applyBigQueryReferenceSheetMappings(accessToken, {
    dryRun: options.dryRun,
  })

  return {
    triggered: true,
    result,
  }
}
