/**
 * Jest Setup File
 *
 * Global mocks and configuration for all tests.
 */

// Mock environment variables for tests
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
process.env.ADMIN_EMAILS = 'admin@test.com,tomas@sophiesociety.com'
process.env.NEXTAUTH_SECRET = 'test-secret'

// Mock NextResponse since it's not available outside Next.js runtime
jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number; headers?: Record<string, string> }) => ({
      body,
      status: init?.status || 200,
      headers: init?.headers || {},
      json: async () => body,
    }),
  },
}))

// Mock next-auth
jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}))

// Mock Supabase client
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => ({ data: null, error: null })),
          maybeSingle: jest.fn(() => ({ data: null, error: null })),
        })),
      })),
    })),
  })),
}))
