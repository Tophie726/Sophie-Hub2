import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Add unique constraint on brand_name
// Using raw SQL via rpc or direct query
const { error } = await supabase.rpc('exec_sql', {
  query: 'ALTER TABLE partners ADD CONSTRAINT partners_brand_name_unique UNIQUE (brand_name);'
});

if (error) {
  // Try alternative approach - Supabase might not have exec_sql
  console.log('RPC not available, constraint needs to be added via Supabase Dashboard or migration');
  console.log('SQL to run:');
  console.log('  ALTER TABLE partners ADD CONSTRAINT partners_brand_name_unique UNIQUE (brand_name);');
} else {
  console.log('Unique constraint added successfully!');
}
