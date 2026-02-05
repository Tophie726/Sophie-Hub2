/**
 * One-time script to seed sensible default status color mappings
 * Run with: node --env-file=.env.local --import=tsx scripts/seed-status-mappings.ts
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE env vars')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Sensible defaults for common weekly status texts
// Based on real data patterns from the Sophie Hub sheets
const DEFAULT_MAPPINGS: { status: string; bucket: string }[] = [
  // Green (Healthy) - Good performance
  { status: 'high performing', bucket: 'healthy' },
  { status: 'on track', bucket: 'healthy' },
  { status: 'on track - happy', bucket: 'healthy' },
  { status: 'subscribed', bucket: 'healthy' },
  { status: 'active', bucket: 'healthy' },

  // Blue (Onboarding) - New/Setting up
  { status: 'onboarding', bucket: 'onboarding' },
  { status: 'waiting', bucket: 'onboarding' },
  { status: 'new', bucket: 'onboarding' },

  // Amber (Warning/At Risk) - Needs attention
  { status: 'proactive at risk', bucket: 'warning' },
  { status: 'at risk', bucket: 'warning' },
  { status: 'under-performing', bucket: 'warning' },
  { status: 'underperforming', bucket: 'warning' },
  { status: 'on track - unhappy', bucket: 'warning' },
  { status: 'needs attention', bucket: 'warning' },

  // Gray (Paused) - Temporarily inactive
  { status: 'paused', bucket: 'paused' },
  { status: 'on hold', bucket: 'paused' },
  { status: 'inactive', bucket: 'paused' },

  // Orange (Offboarding) - Leaving soon
  { status: 'announced churn', bucket: 'offboarding' },
  { status: 'offboarding', bucket: 'offboarding' },
  { status: 'winding down', bucket: 'offboarding' },

  // Red (Churned) - Left
  { status: 'churned', bucket: 'churned' },
  { status: 'cancelled', bucket: 'churned' },
  { status: 'terminated', bucket: 'churned' },
]

async function seedMappings() {
  console.log('Seeding status color mappings...\n')

  let added = 0
  let skipped = 0

  for (const { status, bucket } of DEFAULT_MAPPINGS) {
    // Check if already exists (case-insensitive)
    const { data: existing } = await supabase
      .from('status_color_mappings')
      .select('id')
      .ilike('status_pattern', status)
      .maybeSingle()

    if (existing) {
      console.log(`  ⏭️  "${status}" already exists, skipping`)
      skipped++
      continue
    }

    // Insert new mapping
    const { error } = await supabase
      .from('status_color_mappings')
      .insert({
        status_pattern: status.toLowerCase(),
        bucket,
        priority: 100, // High priority for exact matches
        is_system_default: false,
        is_active: true,
      })

    if (error) {
      console.error(`  ❌ Failed to add "${status}":`, error.message)
    } else {
      console.log(`  ✅ Added "${status}" → ${bucket}`)
      added++
    }
  }

  console.log(`\nDone! Added ${added}, skipped ${skipped} existing.`)
}

seedMappings().catch(console.error)
