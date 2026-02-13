interface GoogleTokenResponse {
  access_token?: string
  error?: string
  error_description?: string
}

export interface ResolvedSheetsAccessToken {
  accessToken: string
  source: 'viewer' | 'shared'
}

type SheetsAuthErrorCode =
  | 'VIEWER_TOKEN_MISSING'
  | 'GOOGLE_OAUTH_CLIENT_MISSING'
  | 'SHARED_TOKEN_REFRESH_FAILED'

export class SheetsAuthError extends Error {
  code: SheetsAuthErrorCode

  constructor(code: SheetsAuthErrorCode, message: string) {
    super(message)
    this.name = 'SheetsAuthError'
    this.code = code
  }
}

/**
 * Resolve which token to use for Google Sheets API:
 * 1) Shared connector identity (if GOOGLE_SHEETS_SHARED_REFRESH_TOKEN is configured)
 * 2) Fallback to viewer OAuth token (current behavior)
 */
export async function resolveSheetsAccessToken(
  viewerAccessToken?: string
): Promise<ResolvedSheetsAccessToken> {
  const sharedRefreshToken = process.env.GOOGLE_SHEETS_SHARED_REFRESH_TOKEN?.trim()

  // Preserve current behavior when shared auth is not configured.
  if (!sharedRefreshToken) {
    if (!viewerAccessToken) {
      throw new SheetsAuthError(
        'VIEWER_TOKEN_MISSING',
        'No Google access token available. Please sign in again.'
      )
    }
    return { accessToken: viewerAccessToken, source: 'viewer' }
  }

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    if (viewerAccessToken) {
      return { accessToken: viewerAccessToken, source: 'viewer' }
    }
    throw new SheetsAuthError(
      'GOOGLE_OAUTH_CLIENT_MISSING',
      'Google OAuth client configuration is missing on the server.'
    )
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: sharedRefreshToken,
    }),
  })

  const tokenResponse = await response.json() as GoogleTokenResponse

  if (!response.ok || !tokenResponse.access_token) {
    if (viewerAccessToken) {
      return { accessToken: viewerAccessToken, source: 'viewer' }
    }
    throw new SheetsAuthError(
      'SHARED_TOKEN_REFRESH_FAILED',
      tokenResponse.error_description || tokenResponse.error || 'Failed to refresh shared Google Sheets token.'
    )
  }

  return { accessToken: tokenResponse.access_token, source: 'shared' }
}

export function mapSheetsAuthError(error: unknown): { status: number; message: string } {
  if (error instanceof SheetsAuthError) {
    switch (error.code) {
      case 'VIEWER_TOKEN_MISSING':
        return { status: 401, message: error.message }
      case 'GOOGLE_OAUTH_CLIENT_MISSING':
      case 'SHARED_TOKEN_REFRESH_FAILED':
        return { status: 500, message: 'Google Sheets shared authentication is not configured correctly.' }
    }
  }

  return {
    status: 500,
    message: 'Failed to authenticate with Google Sheets.',
  }
}
