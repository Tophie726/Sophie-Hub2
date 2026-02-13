/**
 * SupTask API Client
 *
 * Env-based authentication — secrets are NEVER serialized to DB, API responses, logs, or client payloads.
 *
 * Required env vars:
 *   SUPTASK_API_BASE_URL — e.g. https://public-api-prod.suptask.com/api/v2/public
 *   SUPTASK_API_TOKEN    — API token from SupTask support
 *   SUPTASK_API_AUTH_SCHEME — 'api_token' (default) or 'bearer'
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SupTaskTicket {
  ticketNumber: number
  teamId: string
  status: string
  archived: boolean
  requesterId: string | null
  assignee: string | null
  formId: string | null
  queueId: string | null
  subject: string | null
  createdAt: string | null
  updatedAt: string | null
  /** Raw API payload for zero-data-loss capture */
  raw: Record<string, unknown>
}

export interface SupTaskConnectionInfo {
  reachable: boolean
  sampleTicketNumber?: number
}

/** Error classifications for systemic failure detection */
export type SupTaskErrorKind = 'auth' | 'timeout' | 'network' | 'not_found' | 'server' | 'unknown'

export class SupTaskApiError extends Error {
  readonly kind: SupTaskErrorKind
  readonly statusCode: number | null

  constructor(message: string, kind: SupTaskErrorKind, statusCode: number | null = null) {
    super(message)
    this.name = 'SupTaskApiError'
    this.kind = kind
    this.statusCode = statusCode
  }
}

// ---------------------------------------------------------------------------
// Env validation
// ---------------------------------------------------------------------------

function getBaseUrl(): string {
  const url = process.env.SUPTASK_API_BASE_URL
  if (!url) throw new Error('SUPTASK_API_BASE_URL environment variable is required')
  return url.replace(/\/+$/, '') // strip trailing slash
}

function getToken(): string {
  const token = process.env.SUPTASK_API_TOKEN
  if (!token) throw new Error('SUPTASK_API_TOKEN environment variable is required')
  return token
}

function getAuthScheme(): string {
  return process.env.SUPTASK_API_AUTH_SCHEME || 'api_token'
}

// ---------------------------------------------------------------------------
// Secret-safe error sanitization (P1 fix)
// ---------------------------------------------------------------------------

/**
 * Strip any occurrence of the configured API token from a string.
 * Also masks common token-like patterns (Bearer xxx, Api-Token xxx).
 * Exported for testing.
 */
export function sanitizeError(raw: string): string {
  let cleaned = raw

  // Strip the actual token value if it appears anywhere
  try {
    const token = getToken()
    if (token && cleaned.includes(token)) {
      cleaned = cleaned.replaceAll(token, '[REDACTED]')
    }
  } catch {
    // Token env not set — nothing to strip
  }

  // Mask common auth header patterns
  cleaned = cleaned.replace(/(?:Bearer|Api-Token|Authorization:?\s*)\s*\S+/gi, '[AUTH_REDACTED]')

  // Truncate to safe length
  if (cleaned.length > 200) {
    cleaned = cleaned.slice(0, 200) + '…[truncated]'
  }

  return cleaned
}

// ---------------------------------------------------------------------------
// Request helper
// ---------------------------------------------------------------------------

export function buildAuthHeader(): Record<string, string> {
  const scheme = getAuthScheme()
  const token = getToken()

  if (scheme === 'bearer') {
    return { Authorization: `Bearer ${token}` }
  }
  // Default: Api-Token scheme
  return { Authorization: `Api-Token ${token}` }
}

/**
 * Classify an HTTP status code into an error kind for systemic failure detection.
 */
function classifyStatus(status: number): SupTaskErrorKind {
  if (status === 401 || status === 403) return 'auth'
  if (status === 404) return 'not_found'
  if (status >= 500) return 'server'
  return 'unknown'
}

async function suptaskFetch<T>(
  path: string,
  options: { method?: string; body?: unknown; timeout?: number } = {}
): Promise<T> {
  const baseUrl = getBaseUrl()
  const url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`
  const { method = 'GET', body, timeout = 15_000 } = options

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)

  try {
    const res = await fetch(url, {
      method,
      headers: {
        ...buildAuthHeader(),
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })

    if (!res.ok) {
      const status = res.status
      const kind = classifyStatus(status)
      let rawMessage: string
      try {
        rawMessage = await res.text()
      } catch {
        rawMessage = res.statusText
      }
      // Sanitize before creating error — never let token leak
      const safeMessage = sanitizeError(rawMessage)
      throw new SupTaskApiError(`SupTask API ${status}: ${safeMessage}`, kind, status)
    }

    return (await res.json()) as T
  } catch (err) {
    if (err instanceof SupTaskApiError) throw err
    if (err instanceof Error && err.name === 'AbortError') {
      throw new SupTaskApiError('SupTask API request timed out', 'timeout')
    }
    // Network errors (DNS, connection refused, etc.)
    const msg = err instanceof Error ? sanitizeError(err.message) : 'Network error'
    throw new SupTaskApiError(msg, 'network')
  } finally {
    clearTimeout(timer)
  }
}

// ---------------------------------------------------------------------------
// Public API methods
// ---------------------------------------------------------------------------

/** Probe ticket numbers to try for connection test (avoids hardcoding a single ticket). */
const PROBE_TICKETS = [1, 2, 3]

/**
 * Test connectivity to the SupTask API.
 *
 * Probes multiple low-numbered tickets. A 404 (ticket not found) still proves
 * the API is reachable and auth is valid. Only 401/403 indicates bad auth.
 */
export async function testConnection(): Promise<SupTaskConnectionInfo> {
  for (const ticketNum of PROBE_TICKETS) {
    try {
      const ticket = await getTicketByNumber(ticketNum)
      return { reachable: true, sampleTicketNumber: ticket.ticketNumber }
    } catch (err) {
      if (err instanceof SupTaskApiError) {
        // Auth errors are definitive — fail immediately
        if (err.kind === 'auth') {
          throw new Error('Invalid or expired SupTask API token')
        }
        // 404 means API is reachable, auth works, ticket just doesn't exist
        if (err.kind === 'not_found') {
          return { reachable: true }
        }
        // Timeout/network errors are definitive
        if (err.kind === 'timeout' || err.kind === 'network') {
          throw new Error(`SupTask API unreachable: ${err.message}`)
        }
        // Server errors — try next ticket
        continue
      }
      throw err
    }
  }
  // All probes failed with server errors — API likely degraded
  throw new Error('SupTask API is unreachable or degraded (all probe tickets returned errors)')
}

/**
 * Fetch a single ticket by its ticket number.
 */
export async function getTicketByNumber(ticketNumber: number): Promise<SupTaskTicket> {
  const data = await suptaskFetch<Record<string, unknown>>(`/ticket/${ticketNumber}`)
  return normalizeTicket(data)
}

/** Threshold: if this many consecutive tickets fail with the same systemic error, abort early. */
const SYSTEMIC_FAILURE_THRESHOLD = 5

/**
 * Fetch a range of tickets by number for bulk ingestion.
 *
 * Per-ticket 404/500 errors are tolerated (logged + continues).
 * Systemic errors (auth, timeout, network) fail fast after threshold.
 *
 * @param start - First ticket number (inclusive)
 * @param end - Last ticket number (inclusive)
 * @returns Successfully fetched tickets, per-ticket error list, and abort reason if any
 */
export async function getTicketRange(
  start: number,
  end: number
): Promise<{
  tickets: SupTaskTicket[]
  errors: { ticketNumber: number; error: string }[]
  abortReason: string | null
}> {
  const tickets: SupTaskTicket[] = []
  const errors: { ticketNumber: number; error: string }[] = []
  let consecutiveSystemicFailures = 0
  let lastSystemicKind: SupTaskErrorKind | null = null

  for (let n = start; n <= end; n++) {
    try {
      const ticket = await getTicketByNumber(n)
      tickets.push(ticket)
      // Reset consecutive failures on success
      consecutiveSystemicFailures = 0
      lastSystemicKind = null
    } catch (err) {
      const message = err instanceof Error ? sanitizeError(err.message) : 'Unknown error'

      if (err instanceof SupTaskApiError) {
        // Auth errors are always systemic — abort immediately
        if (err.kind === 'auth') {
          errors.push({ ticketNumber: n, error: message })
          return {
            tickets,
            errors,
            abortReason: `Systemic auth failure (${err.statusCode}): invalid or expired token`,
          }
        }

        // Network/timeout errors count toward systemic threshold
        if (err.kind === 'timeout' || err.kind === 'network') {
          consecutiveSystemicFailures++
          lastSystemicKind = err.kind
        } else {
          // Server errors (500) or not_found (404) are per-ticket — reset counter
          consecutiveSystemicFailures = 0
          lastSystemicKind = null
        }
      } else {
        // Unknown error — count as systemic
        consecutiveSystemicFailures++
        lastSystemicKind = 'unknown'
      }

      errors.push({ ticketNumber: n, error: message })

      // Fail fast if consecutive systemic failures exceed threshold
      if (consecutiveSystemicFailures >= SYSTEMIC_FAILURE_THRESHOLD) {
        return {
          tickets,
          errors,
          abortReason: `Systemic failure: ${consecutiveSystemicFailures} consecutive ${lastSystemicKind} errors — aborting`,
        }
      }
    }
  }

  return { tickets, errors, abortReason: null }
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

function normalizeTicket(raw: Record<string, unknown>): SupTaskTicket {
  return {
    ticketNumber: Number(raw.ticketNumber ?? raw.ticket_number ?? 0),
    teamId: String(raw.teamId ?? raw.team_id ?? ''),
    status: String(raw.status ?? 'unknown'),
    archived: Boolean(raw.archived),
    requesterId: (raw.requesterId ?? raw.requester_id ?? null) as string | null,
    assignee: (raw.assignee ?? null) as string | null,
    formId: (raw.formId ?? raw.form_id ?? null) as string | null,
    queueId: (raw.queueId ?? raw.queue_id ?? null) as string | null,
    subject: (raw.subject ?? null) as string | null,
    createdAt: (raw.createdAt ?? raw.created_at ?? null) as string | null,
    updatedAt: (raw.updatedAt ?? raw.updated_at ?? null) as string | null,
    raw,
  }
}
