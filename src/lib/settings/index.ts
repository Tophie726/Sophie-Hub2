import { getAdminClient } from '@/lib/supabase/admin'
import { decrypt } from '@/lib/encryption'

/**
 * Get a system setting value by key.
 * Automatically decrypts if the value is encrypted.
 * Returns null if not found.
 */
export async function getSystemSetting(key: string): Promise<string | null> {
  try {
    const supabase = getAdminClient()

    const { data, error } = await supabase
      .from('system_settings')
      .select('value, encrypted')
      .eq('key', key)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // Not found
        return null
      }
      console.error(`Failed to fetch setting ${key}:`, error)
      return null
    }

    if (!data?.value) {
      return null
    }

    // Decrypt if encrypted
    if (data.encrypted) {
      try {
        return decrypt(data.value)
      } catch (decryptError) {
        console.error(`Failed to decrypt setting ${key}:`, decryptError)
        return null
      }
    }

    return data.value
  } catch (error) {
    console.error(`Error fetching setting ${key}:`, error)
    return null
  }
}

/**
 * Check if a system setting exists and has a value.
 */
export async function hasSystemSetting(key: string): Promise<boolean> {
  const value = await getSystemSetting(key)
  return value !== null && value.length > 0
}

/**
 * Get the Anthropic API key from database, with fallback to env var.
 * Throws an error if not configured anywhere.
 */
export async function getAnthropicApiKey(): Promise<string> {
  // First check database
  const dbKey = await getSystemSetting('anthropic_api_key')
  if (dbKey) {
    return dbKey
  }

  // Fallback to env (for development/migration)
  const envKey = process.env.ANTHROPIC_API_KEY
  if (envKey) {
    return envKey
  }

  throw new Error(
    'Anthropic API key not configured. Add it in Admin Settings → API Keys.'
  )
}
