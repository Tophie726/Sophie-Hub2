import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Get all partners and find duplicates
const { data, error } = await supabase
  .from('partners')
  .select('id, brand_name, created_at')
  .order('brand_name')
  .order('created_at');

if (error) {
  console.error('Error:', error);
  process.exit(1);
}

// Find duplicates
const counts = {};
const byName = {};

for (const p of data) {
  counts[p.brand_name] = (counts[p.brand_name] || 0) + 1;
  if (!byName[p.brand_name]) byName[p.brand_name] = [];
  byName[p.brand_name].push(p);
}

const dupNames = Object.entries(counts)
  .filter(([_, count]) => count > 1)
  .sort((a, b) => b[1] - a[1]);

console.log('Total partners:', data.length);
console.log('Unique brand names:', Object.keys(counts).length);
console.log('Duplicated brand names:', dupNames.length);

if (dupNames.length > 0) {
  console.log('\nTop duplicates:');
  dupNames.slice(0, 10).forEach(([name, count]) => {
    console.log(`  ${count}x: ${name}`);
  });

  // Calculate IDs to delete (keep oldest, delete newer)
  const idsToDelete = [];
  for (const [name] of dupNames) {
    const records = byName[name].sort((a, b) =>
      new Date(a.created_at) - new Date(b.created_at)
    );
    // Keep first (oldest), delete rest
    for (let i = 1; i < records.length; i++) {
      idsToDelete.push(records[i].id);
    }
  }

  console.log('\nIDs to delete (keeping oldest):', idsToDelete.length);

  // If running with --delete flag, actually delete
  if (process.argv.includes('--delete')) {
    console.log('\nDeleting duplicates...');
    const { error: deleteError } = await supabase
      .from('partners')
      .delete()
      .in('id', idsToDelete);

    if (deleteError) {
      console.error('Delete error:', deleteError);
    } else {
      console.log(`Deleted ${idsToDelete.length} duplicate records`);
    }
  } else {
    console.log('\nRun with --delete to remove duplicates');
  }
}
