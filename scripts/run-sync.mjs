/**
 * Run sync for a tab mapping directly (bypasses API auth)
 */
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TAB_MAPPING_ID = '32ad8e22-a9b6-4e62-8293-93b61b17e0a2';

async function getGoogleToken() {
  // Get token from accounts table (stored by NextAuth)
  const { data, error } = await supabase
    .from('accounts')
    .select('access_token, refresh_token, expires_at')
    .eq('provider', 'google')
    .limit(1)
    .single();

  if (error || !data) {
    console.error('No Google account found:', error);
    return null;
  }

  return data.access_token;
}

async function runSync() {
  console.log('Starting sync for tab mapping:', TAB_MAPPING_ID);

  // Get tab mapping config
  const { data: tabMapping, error: tmError } = await supabase
    .from('tab_mappings')
    .select(`
      *,
      data_sources (*)
    `)
    .eq('id', TAB_MAPPING_ID)
    .single();

  if (tmError || !tabMapping) {
    console.error('Tab mapping not found:', tmError);
    return;
  }

  console.log('Tab:', tabMapping.tab_name);
  console.log('Entity:', tabMapping.primary_entity);

  // Get column mappings
  const { data: columnMappings } = await supabase
    .from('column_mappings')
    .select('*')
    .eq('tab_mapping_id', TAB_MAPPING_ID);

  const partnerMappings = columnMappings?.filter(m =>
    m.category === 'partner' && m.target_field
  ) || [];

  console.log(`\nMappings to sync (${partnerMappings.length}):`);
  partnerMappings.forEach(m => {
    console.log(`  ${m.source_column} → ${m.target_field} [${m.transform_type || 'none'}]`);
  });

  // Get Google token
  const token = await getGoogleToken();
  if (!token) {
    console.error('\nNo Google token available. Please log in to the app first.');
    return;
  }

  console.log('\nGoogle token available, fetching sheet data...');

  // Fetch sheet data
  const spreadsheetId = tabMapping.data_sources.spreadsheet_id;
  const tabName = tabMapping.tab_name.replace('_vPB', ''); // Remove suffix
  const headerRow = tabMapping.header_row || 0;

  const range = encodeURIComponent(tabName);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?majorDimension=ROWS`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!response.ok) {
    const err = await response.text();
    console.error('Failed to fetch sheet:', err);
    return;
  }

  const sheetData = await response.json();
  const rows = sheetData.values || [];
  const headers = rows[headerRow] || [];
  const dataRows = rows.slice(headerRow + 1);

  console.log(`Fetched ${dataRows.length} data rows`);

  // Build column index map
  const headerIndex = {};
  headers.forEach((h, i) => { headerIndex[h] = i; });

  // Find key field
  const keyMapping = partnerMappings.find(m => m.is_key);
  if (!keyMapping) {
    console.error('No key field mapped');
    return;
  }

  const keyColIndex = headerIndex[keyMapping.source_column];
  console.log(`Key field: ${keyMapping.source_column} (column ${keyColIndex}) → ${keyMapping.target_field}`);

  // Apply transforms
  const applyTransform = (value, mapping) => {
    if (!value || !mapping.transform_type || mapping.transform_type === 'none') {
      return value;
    }

    if (mapping.transform_type === 'value_mapping' && mapping.transform_config?.mappings) {
      const mapped = mapping.transform_config.mappings[value];
      return mapped !== undefined ? mapped : (mapping.transform_config.default || value);
    }

    if (mapping.transform_type === 'lowercase') return value.toLowerCase();
    if (mapping.transform_type === 'uppercase') return value.toUpperCase();
    if (mapping.transform_type === 'trim') return value.trim();

    return value;
  };

  // Process rows
  let updated = 0;
  let created = 0;
  let errors = 0;

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const keyValue = row[keyColIndex]?.trim();

    if (!keyValue) continue;

    // Build record
    const record = {};
    const sourceData = { gsheets: { [tabMapping.tab_name]: {} } };

    // Capture all columns in source_data
    headers.forEach((header, idx) => {
      sourceData.gsheets[tabMapping.tab_name][header] = row[idx] || '';
    });

    // Map fields
    for (const mapping of partnerMappings) {
      const colIdx = headerIndex[mapping.source_column];
      if (colIdx === undefined) continue;

      let value = row[colIdx] || '';
      value = applyTransform(value, mapping);

      if (value !== '' && value !== null) {
        record[mapping.target_field] = value;
      }
    }

    // Check if exists
    const { data: existing } = await supabase
      .from('partners')
      .select('id')
      .eq(keyMapping.target_field, keyValue)
      .maybeSingle();

    if (existing) {
      // Update
      const { error } = await supabase
        .from('partners')
        .update({ ...record, source_data: sourceData })
        .eq('id', existing.id);

      if (error) {
        console.error(`  Error updating ${keyValue}:`, error.message);
        errors++;
      } else {
        updated++;
      }
    } else {
      // Insert
      const { error } = await supabase
        .from('partners')
        .insert({ ...record, source_data: sourceData });

      if (error) {
        console.error(`  Error creating ${keyValue}:`, error.message);
        errors++;
      } else {
        created++;
      }
    }

    // Progress
    if ((i + 1) % 200 === 0) {
      console.log(`  Processed ${i + 1}/${dataRows.length} rows...`);
    }
  }

  console.log(`\nSync complete:`);
  console.log(`  Created: ${created}`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Errors: ${errors}`);
}

runSync().catch(console.error);
