/**
 * Google Workspace Admin SDK Client
 *
 * Wraps the Google Admin SDK Directory API for listing and reading users.
 * Uses service account with domain-wide delegation.
 *
 * Credentials are env-only — never stored in config, DB, or client payloads.
 *
 * Required env vars:
 *   GOOGLE_WORKSPACE_CLIENT_EMAIL
 *   GOOGLE_WORKSPACE_PRIVATE_KEY (or GOOGLE_WORKSPACE_PRIVATE_KEY_BASE64)
 *   GOOGLE_WORKSPACE_ADMIN_EMAIL
 */

import { google } from 'googleapis'
import type { GoogleDirectoryUser } from './types'

// =============================================================================
// Credential Resolution (env-only)
// =============================================================================

interface GWSCredentials {
  clientEmail: string
  privateKey: string
  adminEmail: string
}

function getCredentials(): GWSCredentials {
  const clientEmail = process.env.GOOGLE_WORKSPACE_CLIENT_EMAIL
  const privateKey =
    process.env.GOOGLE_WORKSPACE_PRIVATE_KEY ||
    (process.env.GOOGLE_WORKSPACE_PRIVATE_KEY_BASE64
      ? Buffer.from(process.env.GOOGLE_WORKSPACE_PRIVATE_KEY_BASE64, 'base64').toString('utf-8')
      : undefined)
  const adminEmail = process.env.GOOGLE_WORKSPACE_ADMIN_EMAIL

  if (!clientEmail || !privateKey || !adminEmail) {
    throw new Error(
      'Google Workspace credentials not configured. ' +
      'Set GOOGLE_WORKSPACE_CLIENT_EMAIL, GOOGLE_WORKSPACE_PRIVATE_KEY (or _BASE64), ' +
      'and GOOGLE_WORKSPACE_ADMIN_EMAIL environment variables.'
    )
  }

  return { clientEmail, privateKey, adminEmail }
}

// =============================================================================
// Auth Client
// =============================================================================

function getAuthClient() {
  const creds = getCredentials()

  const auth = new google.auth.JWT({
    email: creds.clientEmail,
    key: creds.privateKey,
    scopes: [
      'https://www.googleapis.com/auth/admin.directory.user.readonly',
      'https://www.googleapis.com/auth/admin.directory.group.readonly',
    ],
    subject: creds.adminEmail, // Impersonate this admin
  })

  return auth
}

function getDirectoryService() {
  const auth = getAuthClient()
  return google.admin({ version: 'directory_v1', auth })
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Test connection to Google Workspace by fetching a single page of users.
 * Returns workspace domain and approximate user count.
 */
export async function testConnection(domain: string): Promise<{
  domain: string
  userCount: number
}> {
  // Count users across all pages so the UI doesn't report a misleading "1 user found".
  const users = await listUsers(domain, {
    includeSuspended: true,
    includeDeleted: false,
  })

  return {
    domain,
    userCount: users.length,
  }
}

/**
 * List all directory users for a domain.
 * Paginates automatically to fetch all users.
 */
export async function listUsers(
  domain: string,
  options?: {
    includeSuspended?: boolean
    includeDeleted?: boolean
  }
): Promise<GoogleDirectoryUser[]> {
  const service = getDirectoryService()
  const allUsers: GoogleDirectoryUser[] = []
  let pageToken: string | undefined

  do {
    const res = await service.users.list({
      domain,
      maxResults: 100,
      projection: 'full',
      showDeleted: options?.includeDeleted ? 'true' : undefined,
      pageToken,
    })

    const users = res.data.users || []

    for (const u of users) {
      // Skip suspended if not requested
      if (u.suspended && options?.includeSuspended === false) continue

      allUsers.push(mapApiUser(u))
    }

    pageToken = res.data.nextPageToken || undefined
  } while (pageToken)

  return allUsers
}

/**
 * Get a single user by email or immutable user ID.
 */
export async function getUser(
  userKey: string
): Promise<GoogleDirectoryUser | null> {
  const service = getDirectoryService()

  try {
    const res = await service.users.get({
      userKey,
      projection: 'full',
    })
    return mapApiUser(res.data)
  } catch (error: unknown) {
    const err = error as { code?: number }
    if (err.code === 404) return null
    throw error
  }
}

// =============================================================================
// Internal Helpers
// =============================================================================

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapApiUser(u: any): GoogleDirectoryUser {
  const phones = u.phones as Array<{ value: string; type: string; primary?: boolean }> | undefined
  const organizations = u.organizations as Array<Record<string, unknown>> | undefined
  const primaryOrg = organizations?.find(org => Boolean(org.primary)) || organizations?.[0]
  const relations = u.relations as Array<Record<string, unknown>> | undefined
  const managerRelation = relations?.find(
    relation => String(relation.type || '').toLowerCase() === 'manager'
  )
  const managerEmail = managerRelation && typeof managerRelation.value === 'string'
    ? managerRelation.value
    : undefined

  return {
    id: u.id,
    primaryEmail: u.primaryEmail,
    name: {
      givenName: u.name?.givenName || '',
      familyName: u.name?.familyName || '',
      fullName: u.name?.fullName || `${u.name?.givenName || ''} ${u.name?.familyName || ''}`.trim(),
    },
    orgUnitPath: u.orgUnitPath || undefined,
    suspended: u.suspended || false,
    isAdmin: u.isAdmin || false,
    title: u.organizations?.[0]?.title || undefined,
    phones: phones || undefined,
    aliases: u.aliases || undefined,
    nonEditableAliases: u.nonEditableAliases || undefined,
    thumbnailPhotoUrl: u.thumbnailPhotoUrl || undefined,
    creationTime: u.creationTime || undefined,
    lastLoginTime: u.lastLoginTime || undefined,
    isDelegatedAdmin: u.isDelegatedAdmin || false,
    department: (primaryOrg?.department as string | undefined) || undefined,
    costCenter: (primaryOrg?.costCenter as string | undefined) || undefined,
    location: (primaryOrg?.location as string | undefined) || undefined,
    managerEmail,
    rawProfile: u,
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */
