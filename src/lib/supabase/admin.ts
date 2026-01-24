import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Singleton instance for server-side admin operations
let adminClient: SupabaseClient | null = null

/**
 * Get the singleton Supabase admin client with service role
 * Use only on server side for admin operations
 *
 * This singleton pattern prevents creating multiple clients per request,
 * which can exhaust connection pools under load.
 */
export function getAdminClient(): SupabaseClient {
  if (!adminClient) {
    adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
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
