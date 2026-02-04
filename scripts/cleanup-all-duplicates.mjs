import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function cleanupDuplicates() {
  console.log('Fetching all partners...');

  // Fetch ALL partners with pagination (Supabase limits to 1000 by default)
  let allPartners = [];
  let offset = 0;
  const pageSize = 1000;

  while (true) {
    const { data: batch, error } = await supabase
      .from('partners')
      .select('id, brand_name, created_at')
      .order('created_at', { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) {
      console.error('Error fetching partners:', error);
      process.exit(1);
    }

    if (!batch || batch.length === 0) break;

    allPartners = allPartners.concat(batch);
    console.log(`  Fetched ${allPartners.length} partners...`);

    if (batch.length < pageSize) break;
    offset += pageSize;
  }

  const partners = allPartners;
  console.log(`Found ${partners.length} total partners`);

  // Group by brand_name
  const byName = {};
  for (const p of partners) {
    const bn = p.brand_name;
    if (!byName[bn]) byName[bn] = [];
    byName[bn].push(p);
  }

  // Find duplicates - keep first (oldest), delete rest
  const toDelete = [];
  for (const [name, records] of Object.entries(byName)) {
    if (records.length > 1) {
      console.log(`  ${name}: ${records.length} records (keeping oldest)`);
      // Skip first (oldest), mark rest for deletion
      for (let i = 1; i < records.length; i++) {
        toDelete.push(records[i].id);
      }
    }
  }

  if (toDelete.length === 0) {
    console.log('\n✓ No duplicates found!');
    return;
  }

  console.log(`\nDeleting ${toDelete.length} duplicate records...`);

  // Delete in batches of 100
  const batchSize = 100;
  for (let i = 0; i < toDelete.length; i += batchSize) {
    const batch = toDelete.slice(i, i + batchSize);
    const { error: deleteError } = await supabase
      .from('partners')
      .delete()
      .in('id', batch);

    if (deleteError) {
      console.error(`Error deleting batch ${i / batchSize + 1}:`, deleteError);
    } else {
      console.log(`  Deleted batch ${Math.floor(i / batchSize) + 1}: ${batch.length} records`);
    }
  }

  console.log(`\n✓ Deleted ${toDelete.length} duplicates`);

  // Verify
  const { data: remaining } = await supabase
    .from('partners')
    .select('brand_name')
    .order('brand_name');

  const check = {};
  let stillDups = 0;
  for (const p of remaining) {
    if (check[p.brand_name]) stillDups++;
    check[p.brand_name] = true;
  }

  if (stillDups === 0) {
    console.log('✓ Verified: No duplicates remain');
  } else {
    console.log(`⚠ Still found ${stillDups} duplicates - run again`);
  }
}

cleanupDuplicates();
