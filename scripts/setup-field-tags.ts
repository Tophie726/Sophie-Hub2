// Run with: npx tsx scripts/setup-field-tags.ts
// This script creates the field_tags table and seeds default data

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const defaultTags = [
  { name: 'Finance', color: 'emerald', description: 'Financial data: fees, salaries, invoices, billing' },
  { name: 'Operations', color: 'blue', description: 'Operational data: status, capacity, assignments' },
  { name: 'Contact', color: 'violet', description: 'Contact information: email, phone, address, Slack' },
  { name: 'HR', color: 'amber', description: 'Human resources: hire dates, PTO, training' },
  { name: 'Product', color: 'orange', description: 'Product data: categories, pricing, inventory' },
]

async function setupFieldTags() {
  console.log('Setting up field_tags...')

  // Try to insert tags - table must already exist
  // If you get an error, run the SQL manually in Supabase Dashboard:
  /*
  CREATE TABLE IF NOT EXISTS field_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    color TEXT DEFAULT 'gray',
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
  );
  */

  for (const tag of defaultTags) {
    const { data, error } = await supabase
      .from('field_tags')
      .upsert(tag, { onConflict: 'name' })
      .select()

    if (error) {
      console.error(`Error inserting ${tag.name}:`, error.message)
    } else {
      console.log(`✓ ${tag.name}`)
    }
  }

  // Verify
  const { data: allTags } = await supabase
    .from('field_tags')
    .select('*')

  console.log('\nCurrent tags:', allTags)
}

setupFieldTags()
