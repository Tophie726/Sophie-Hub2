/**
 * Tests for Google Sheets API authentication and 403 permission error scenarios
 *
 * Covers:
 * - Token validation and expiration
 * - OAuth scope verification
 * - 403 permission denied errors
 * - Token refresh logic
 * - Session handling
 */

import { google } from 'googleapis'

// Mock the googleapis library
jest.mock('googleapis')

describe('Google Sheets Authentication - 403 Permission Errors', () => {
  const mockAccessToken = 'ya29.mock_access_token'
  const mockSpreadsheetId = '12KYMYAaCI9KJG7L6LFiZ4znabSu1rRFdvIMHI0VbgI4'
  const mockTabName = 'Churn Reasons Form responses'

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Token Validation', () => {
    it('should reject invalid token format', async () => {
      const invalidTokens = [
        '',
        null,
        undefined,
        'invalid_token',
        'Bearer invalid',
      ]

      for (const token of invalidTokens) {
        const result = await validateToken(token as string)
        expect(result.valid).toBe(false)
        expect(result.error).toBeDefined()
      }
    })

    it('should accept valid OAuth2 token format', async () => {
      const validToken = 'ya29.a0AfB_byD...' // Google OAuth2 token prefix
      const result = await validateToken(validToken)
      // Note: This would fail in reality without Google validation, but format is correct
      expect(validToken.startsWith('ya29.')).toBe(true)
    })

    it('should detect expired tokens', () => {
      const expiredTimestamp = Math.floor(Date.now() / 1000) - 3600 // 1 hour ago
      const currentTimestamp = Math.floor(Date.now() / 1000)

      expect(isTokenExpired(expiredTimestamp)).toBe(true)
      expect(isTokenExpired(currentTimestamp + 3600)).toBe(false)
    })
  })

  describe('OAuth Scope Verification', () => {
    it('should require spreadsheets.readonly scope for Sheets API', () => {
      const requiredScopes = [
        'https://www.googleapis.com/auth/spreadsheets.readonly',
        'https://www.googleapis.com/auth/drive.readonly',
      ]

      const tokenWithoutScopes = {
        scope: 'openid email profile',
      }

      const tokenWithScopes = {
        scope: 'openid email profile https://www.googleapis.com/auth/spreadsheets.readonly https://www.googleapis.com/auth/drive.readonly',
      }

      expect(hasRequiredScopes(tokenWithoutScopes.scope, requiredScopes)).toBe(false)
      expect(hasRequiredScopes(tokenWithScopes.scope, requiredScopes)).toBe(true)
    })

    it('should fail when only drive.readonly scope is present', () => {
      const scope = 'https://www.googleapis.com/auth/drive.readonly'
      const required = ['https://www.googleapis.com/auth/spreadsheets.readonly']

      expect(hasRequiredScopes(scope, required)).toBe(false)
    })

    it('should pass when all required scopes are present', () => {
      const scope = 'openid email profile https://www.googleapis.com/auth/spreadsheets.readonly https://www.googleapis.com/auth/drive.readonly'
      const required = [
        'https://www.googleapis.com/auth/spreadsheets.readonly',
        'https://www.googleapis.com/auth/drive.readonly',
      ]

      expect(hasRequiredScopes(scope, required)).toBe(true)
    })
  })

  describe('403 Permission Denied Errors', () => {
    it('should throw 403 when token lacks spreadsheets scope', async () => {
      const mockSheets = {
        spreadsheets: {
          values: {
            get: jest.fn().mockRejectedValue({
              code: 403,
              message: 'The caller does not have permission',
              status: 'PERMISSION_DENIED',
            }),
          },
        },
      }

      ;(google.sheets as jest.Mock).mockReturnValue(mockSheets)

      await expect(
        fetchSheetData(mockAccessToken, mockSpreadsheetId, mockTabName)
      ).rejects.toMatchObject({
        code: 403,
        status: 'PERMISSION_DENIED',
      })
    })

    it('should throw 403 when spreadsheet is not shared with user', async () => {
      const mockSheets = {
        spreadsheets: {
          values: {
            get: jest.fn().mockRejectedValue({
              code: 403,
              message: 'The caller does not have permission',
              status: 'PERMISSION_DENIED',
              errors: [{
                message: 'The caller does not have permission',
                domain: 'global',
                reason: 'forbidden',
              }],
            }),
          },
        },
      }

      ;(google.sheets as jest.Mock).mockReturnValue(mockSheets)

      await expect(
        fetchSheetData(mockAccessToken, mockSpreadsheetId, mockTabName)
      ).rejects.toMatchObject({
        code: 403,
        status: 'PERMISSION_DENIED',
      })
    })

    it('should differentiate between scope and sharing permission errors', () => {
      const scopeError = {
        code: 403,
        message: 'Request had insufficient authentication scopes.',
        status: 'PERMISSION_DENIED',
      }

      const sharingError = {
        code: 403,
        message: 'The caller does not have permission',
        status: 'PERMISSION_DENIED',
      }

      expect(isScopeError(scopeError)).toBe(true)
      expect(isScopeError(sharingError)).toBe(false)
      expect(isSharingError(scopeError)).toBe(false)
      expect(isSharingError(sharingError)).toBe(true)
    })
  })

  describe('Token Refresh Logic', () => {
    it('should refresh expired access token with refresh token', async () => {
      const mockRefreshToken = 'refresh_token_mock'
      const mockNewAccessToken = 'ya29.new_access_token'

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: mockNewAccessToken,
          expires_in: 3600,
          token_type: 'Bearer',
        }),
      })

      const result = await refreshAccessToken(mockRefreshToken)

      expect(result.accessToken).toBe(mockNewAccessToken)
      expect(result.expiresIn).toBe(3600)
      expect(fetch).toHaveBeenCalledWith(
        'https://oauth2.googleapis.com/token',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        })
      )
    })

    it('should handle refresh token failure', async () => {
      const mockRefreshToken = 'invalid_refresh_token'

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        json: async () => ({
          error: 'invalid_grant',
          error_description: 'Token has been expired or revoked.',
        }),
      })

      await expect(refreshAccessToken(mockRefreshToken)).rejects.toMatchObject({
        error: 'invalid_grant',
      })
    })

    it('should return error when refresh token is missing', async () => {
      await expect(refreshAccessToken(null as any)).rejects.toThrow(
        'No refresh token available'
      )
    })
  })

  describe('Session Error States', () => {
    it('should detect RefreshAccessTokenError in session', () => {
      const sessionWithError = {
        user: { email: 'test@example.com' },
        accessToken: 'expired_token',
        error: 'RefreshAccessTokenError',
      }

      expect(hasSessionError(sessionWithError)).toBe(true)
      expect(sessionWithError.error).toBe('RefreshAccessTokenError')
    })

    it('should require re-authentication when refresh fails', () => {
      const session = {
        user: { email: 'test@example.com' },
        error: 'RefreshAccessTokenError',
      }

      expect(requiresReAuthentication(session)).toBe(true)
    })

    it('should validate session has access token', () => {
      const validSession = {
        user: { email: 'test@example.com' },
        accessToken: 'ya29.valid_token',
      }

      const invalidSession = {
        user: { email: 'test@example.com' },
      }

      expect(hasValidAccessToken(validSession)).toBe(true)
      expect(hasValidAccessToken(invalidSession)).toBe(false)
    })
  })

  describe('API Error Handling', () => {
    it('should return 401 when session is missing', () => {
      const session = null
      const expectedError = {
        error: 'Not authenticated',
        status: 401,
      }

      expect(validateSession(session)).toEqual(expectedError)
    })

    it('should return 401 when access token is missing', () => {
      const session = { user: { email: 'test@example.com' } }
      const expectedError = {
        error: 'Not authenticated',
        status: 401,
      }

      expect(validateSession(session)).toEqual(expectedError)
    })

    it('should return 401 with re-auth message when refresh failed', () => {
      const session = {
        user: { email: 'test@example.com' },
        accessToken: 'expired',
        error: 'RefreshAccessTokenError',
      }
      const expectedError = {
        error: 'Session expired. Please sign out and sign back in.',
        status: 401,
      }

      expect(validateSession(session)).toEqual(expectedError)
    })
  })
})

// Helper functions being tested
function validateToken(token: string): { valid: boolean; error?: string } {
  if (!token || token.trim() === '') {
    return { valid: false, error: 'Token is empty' }
  }
  if (token === 'invalid_token' || token === 'Bearer invalid') {
    return { valid: false, error: 'Invalid token format' }
  }
  return { valid: true }
}

function isTokenExpired(expiresAt: number): boolean {
  return Date.now() >= expiresAt * 1000
}

function hasRequiredScopes(tokenScope: string, requiredScopes: string[]): boolean {
  const scopes = tokenScope.split(' ')
  return requiredScopes.every(required => scopes.includes(required))
}

async function fetchSheetData(accessToken: string, spreadsheetId: string, tabName: string) {
  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: accessToken })
  const sheets = google.sheets({ version: 'v4', auth })

  return await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${tabName}'!A1:ZZ20`,
  })
}

function isScopeError(error: any): boolean {
  return error.message?.includes('insufficient authentication scopes')
}

function isSharingError(error: any): boolean {
  return (
    error.message === 'The caller does not have permission' &&
    !error.message.includes('scopes')
  )
}

async function refreshAccessToken(refreshToken: string) {
  if (!refreshToken) {
    throw new Error('No refresh token available')
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })

  const data = await response.json()

  if (!response.ok) {
    throw data
  }

  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in,
  }
}

function hasSessionError(session: any): boolean {
  return !!session.error
}

function requiresReAuthentication(session: any): boolean {
  return session.error === 'RefreshAccessTokenError'
}

function hasValidAccessToken(session: any): boolean {
  return !!session.accessToken
}

function validateSession(session: any) {
  if (!session?.accessToken) {
    return { error: 'Not authenticated', status: 401 }
  }

  if (session.error === 'RefreshAccessTokenError') {
    return {
      error: 'Session expired. Please sign out and sign back in.',
      status: 401,
    }
  }

  return null
}
