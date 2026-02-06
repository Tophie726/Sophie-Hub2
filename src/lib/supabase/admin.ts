import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Singleton instance for server-side admin operations
let adminClient: SupabaseClient | null = null

const BUILD_TIME_SUPABASE_URL = 'https://build-placeholder.supabase.co'
const BUILD_TIME_SUPABASE_KEY = 'build-time-placeholder-key'

/**
 * Get the singleton Supabase admin client with service role
 * Use only on server side for admin operations
 *
 * This singleton pattern prevents creating multiple clients per request,
 * which can exhaust connection pools under load.
 */
export function getAdminClient(): SupabaseClient {
  if (!adminClient) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    // Vercel/Next can import route modules at build time before runtime env vars exist.
    // Use a harmless placeholder client so module import does not hard-crash the build.
    const url = supabaseUrl || BUILD_TIME_SUPABASE_URL
    const key = serviceRoleKey || BUILD_TIME_SUPABASE_KEY

    adminClient = createClient(
      url,
      key,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )
  }
  return adminClient
}

/**
 * @deprecated Use getAdminClient() instead for singleton pattern
 */
export function createAdminClient(): SupabaseClient {
  return getAdminClient()
}
