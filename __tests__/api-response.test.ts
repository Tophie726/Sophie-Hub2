/**
 * Tests for API response helpers: apiSuccess, apiError, apiValidationError, ApiErrors
 *
 * Source: src/lib/api/response.ts
 */
import {
  apiSuccess,
  apiError,
  apiValidationError,
  ApiErrors,
  ErrorCodes,
} from '@/lib/api/response'
import { ZodError, ZodIssue } from 'zod'

describe('apiSuccess()', () => {
  it('returns success response with data', async () => {
    const response = apiSuccess({ partners: [{ id: '1', name: 'Test' }] })
    const body = await response.json()

    expect(body.success).toBe(true)
    expect(body.data.partners).toHaveLength(1)
    expect(body.data.partners[0].name).toBe('Test')
    expect(body.meta.timestamp).toBeDefined()
  })

  it('defaults to 200 status', () => {
    const response = apiSuccess({ ok: true })
    expect(response.status).toBe(200)
  })

  it('allows custom status code', () => {
    const response = apiSuccess({ id: '123' }, 201)
    expect(response.status).toBe(201)
  })

  it('includes timestamp in meta', async () => {
    const before = new Date().toISOString()
    const response = apiSuccess({})
    const body = await response.json()
    const after = new Date().toISOString()

    expect(body.meta.timestamp >= before).toBe(true)
    expect(body.meta.timestamp <= after).toBe(true)
  })
})

describe('apiError()', () => {
  it('returns error response with code and message', async () => {
    const response = apiError('NOT_FOUND', 'Partner not found', 404)
    const body = await response.json()

    expect(body.success).toBe(false)
    expect(body.error.code).toBe('NOT_FOUND')
    expect(body.error.message).toBe('Partner not found')
    expect(response.status).toBe(404)
  })

  it('defaults to 500 status', () => {
    const response = apiError('INTERNAL_ERROR', 'Something broke')
    expect(response.status).toBe(500)
  })

  it('includes details when provided', async () => {
    const response = apiError('VALIDATION_ERROR', 'Bad input', 400, { field: 'name' })
    const body = await response.json()

    expect(body.error.details).toEqual({ field: 'name' })
  })

  it('omits details when not provided', async () => {
    const response = apiError('NOT_FOUND', 'Not found', 404)
    const body = await response.json()

    expect(body.error.details).toBeUndefined()
  })
})

describe('apiValidationError()', () => {
  it('wraps a ZodError into a 400 validation response', async () => {
    const zodError = new ZodError([
      {
        code: 'too_small',
        minimum: 1,
        type: 'string',
        inclusive: true,
        message: 'Name is required',
        path: ['name'],
      } as ZodIssue,
    ])

    const response = apiValidationError(zodError)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.success).toBe(false)
    expect(body.error.code).toBe(ErrorCodes.VALIDATION_ERROR)
    expect(body.error.message).toBe('Invalid input')
    expect(body.error.details).toBeDefined()
  })
})

describe('ApiErrors convenience methods', () => {
  it('unauthorized() returns 401', async () => {
    const response = ApiErrors.unauthorized()
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error.code).toBe(ErrorCodes.UNAUTHORIZED)
    expect(body.error.message).toBe('Authentication required')
  })

  it('unauthorized() accepts custom message', async () => {
    const response = ApiErrors.unauthorized('Token expired')
    const body = await response.json()

    expect(body.error.message).toBe('Token expired')
  })

  it('forbidden() returns 403', async () => {
    const response = ApiErrors.forbidden()
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body.error.code).toBe(ErrorCodes.FORBIDDEN)
  })

  it('notFound() returns 404 with resource name', async () => {
    const response = ApiErrors.notFound('Partner')
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.error.message).toBe('Partner not found')
  })

  it('conflict() returns 409', async () => {
    const response = ApiErrors.conflict('Already exists')
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.error.code).toBe(ErrorCodes.CONFLICT)
  })

  it('rateLimited() returns 429', async () => {
    const response = ApiErrors.rateLimited()
    expect(response.status).toBe(429)
  })

  it('internal() returns 500', async () => {
    const response = ApiErrors.internal('Top secret stack trace')
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error.code).toBe(ErrorCodes.INTERNAL_ERROR)
    expect(body.error.message).toBe('An unexpected error occurred')
  })

  it('database() returns 500 with DATABASE_ERROR code', async () => {
    const response = ApiErrors.database('Connection timeout')
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error.code).toBe(ErrorCodes.DATABASE_ERROR)
    expect(body.error.message).toBe('Database error')
  })

  it('externalApi() returns 502', async () => {
    const response = ApiErrors.externalApi('Google Sheets', 'Rate limit exceeded')
    const body = await response.json()

    expect(response.status).toBe(502)
    expect(body.error.code).toBe(ErrorCodes.EXTERNAL_API_ERROR)
    expect(body.error.message).toBe('Rate limit exceeded')
  })

  it('externalApi() uses default message when none provided', async () => {
    const response = ApiErrors.externalApi('BigQuery')
    const body = await response.json()

    expect(body.error.message).toBe('BigQuery API error')
  })
})

describe('ErrorCodes', () => {
  it('has all expected error codes', () => {
    expect(ErrorCodes.VALIDATION_ERROR).toBe('VALIDATION_ERROR')
    expect(ErrorCodes.UNAUTHORIZED).toBe('UNAUTHORIZED')
    expect(ErrorCodes.FORBIDDEN).toBe('FORBIDDEN')
    expect(ErrorCodes.NOT_FOUND).toBe('NOT_FOUND')
    expect(ErrorCodes.CONFLICT).toBe('CONFLICT')
    expect(ErrorCodes.RATE_LIMITED).toBe('RATE_LIMITED')
    expect(ErrorCodes.INTERNAL_ERROR).toBe('INTERNAL_ERROR')
    expect(ErrorCodes.DATABASE_ERROR).toBe('DATABASE_ERROR')
    expect(ErrorCodes.EXTERNAL_API_ERROR).toBe('EXTERNAL_API_ERROR')
  })
})
