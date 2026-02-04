/**
 * Fix unmapped entity fields by auto-matching to target fields based on aliases
 */
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Field aliases from the registry
const PARTNER_ALIASES = {
  brand_name: ['brand', 'company name', 'partner name', 'account name'],
  status: ['partner status', 'account status', 'subscription status'],
  tier: ['service tier', 'tier level', 'package', 'tier (from allocation)'],
  notes: ['notes', 'leadership notes'],
  client_name: ['contact name', 'client contact', 'primary contact', 'client name'],
  client_email: ['email', 'email address', 'contact email'],
  client_phone: ['phone', 'phone number', 'contact phone', 'telephone', 'mobile'],
  base_fee: ['fee', 'monthly fee', 'retainer', 'subscription base fee'],
  commission_rate: ['commission', 'commission structure', 'commission %'],
  billing_day: ['billing day', 'billing date'],
  onboarding_date: ['onboarded', 'onboard date', 'start date', 'onboarding call date'],
  contract_start_date: ['contract start date', 'contract start'],
  contract_end_date: ['contract end date', 'contract end'],
  churned_date: ['churn date', 'churned'],
  parent_asin_count: ['parent asins', 'parent count', 'no. of parent asins'],
  child_asin_count: ['child asins', 'child count', 'no. of child asins'],
  // Reference fields - stored as names, will need staff lookup later
  pod_leader_id: ['pod leader', 'pl', 'pod lead'],
  brand_manager_id: ['brand manager', 'bm'],
  account_manager_id: ['account manager', 'am'],
  sales_rep_id: ['sales rep', 'salesperson', 'sales person', 'sales representative'],
};

function normalize(s) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function findTargetField(sourceColumn) {
  const normalizedSource = normalize(sourceColumn);

  for (const [field, aliases] of Object.entries(PARTNER_ALIASES)) {
    // Check field name
    if (normalize(field) === normalizedSource) return field;
    // Check aliases
    if (aliases.some(alias => normalize(alias) === normalizedSource)) return field;
  }

  return null;
}

async function fixMappings() {
  // Fetch all partner category mappings with null target_field
  const { data: mappings, error } = await supabase
    .from('column_mappings')
    .select('id, source_column, target_field, category')
    .eq('category', 'partner')
    .is('target_field', null);

  if (error) {
    console.error('Error fetching mappings:', error);
    return;
  }

  console.log(`Found ${mappings.length} unmapped partner columns\n`);

  const updates = [];
  const unmatched = [];

  for (const mapping of mappings) {
    const targetField = findTargetField(mapping.source_column);

    if (targetField) {
      console.log(`✓ ${mapping.source_column} → ${targetField}`);
      updates.push({ id: mapping.id, source_column: mapping.source_column, target_field: targetField });
    } else {
      console.log(`✗ ${mapping.source_column} → (no match)`);
      unmatched.push(mapping.source_column);
    }
  }

  console.log(`\n${updates.length} matches found, ${unmatched.length} unmatched`);

  if (updates.length === 0) {
    console.log('Nothing to update');
    return;
  }

  // Apply updates
  console.log('\nUpdating database...');

  for (const update of updates) {
    const { error: updateError } = await supabase
      .from('column_mappings')
      .update({ target_field: update.target_field })
      .eq('id', update.id);

    if (updateError) {
      console.error(`  Error updating ${update.source_column}:`, updateError);
    } else {
      console.log(`  Updated: ${update.source_column} → ${update.target_field}`);
    }
  }

  console.log('\nDone!');

  if (unmatched.length > 0) {
    console.log('\nUnmatched columns (need manual mapping):');
    unmatched.forEach(col => console.log(`  - ${col}`));
  }
}

fixMappings();
