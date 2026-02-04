/**
 * Fix columns that are marked as 'skip' but should be 'partner' with proper target fields
 */
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Columns that should be partner fields with their target mappings
// Note: Staff references (Brand Manager, POD Leader, Sales Person) use junction table
// and need special handling - not direct column mapping
const FIXES = [
  { source: 'Tier (from allocation)', target: 'tier', category: 'partner' },
  { source: 'Leadership Notes', target: 'notes', category: 'partner' },
  // Commission Structure contains text like "Base Or 5% of PPC Revenue" - not a simple number
  // Skip for now, captured in source_data
];

// Also fix partner columns that have null target_field
const PARTNER_FIXES = [
  { source: 'Seller Central Name', target: null }, // No matching column in partners table
  { source: 'Content Subscriber', target: null }, // No matching column
  { source: 'Internal Brand Sheet', target: null }, // Could add as URL field
  { source: 'Client Count', target: null }, // Computed field, not direct mapping
];

async function fixMappings() {
  console.log('Fixing skip → partner mappings...\n');

  for (const fix of FIXES) {
    const { data, error } = await supabase
      .from('column_mappings')
      .update({
        category: fix.category,
        target_field: fix.target
      })
      .eq('source_column', fix.source)
      .select();

    if (error) {
      console.error(`✗ ${fix.source}: ${error.message}`);
    } else if (data?.length > 0) {
      console.log(`✓ ${fix.source} → ${fix.target} (${fix.category})`);
    } else {
      console.log(`- ${fix.source}: not found in database`);
    }
  }

  console.log('\nDone! Now re-sync to populate the columns.');
}

fixMappings();
