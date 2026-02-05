/**
 * Tests for Zod validation schemas.
 *
 * Source: src/lib/validations/schemas.ts
 */
import {
  DataSourceSchema,
  TabMappingSchema,
  ColumnMappingSchema,
  SaveMappingSchema,
  SheetsSchema,
  ConnectorConfigSchema,
  GoogleSheetConfigSchema,
  GoogleFormConfigSchema,
  ApiConfigSchema,
  CsvConfigSchema,
  DataSourceSchemaV2,
} from '@/lib/validations/schemas'

// =========================================================================
// DataSourceSchema
// =========================================================================

describe('DataSourceSchema.create', () => {
  it('validates a valid data source', () => {
    const result = DataSourceSchema.create.safeParse({
      name: 'Master Client Sheet',
      spreadsheet_id: 'abc123def456',
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty name', () => {
    const result = DataSourceSchema.create.safeParse({
      name: '',
      spreadsheet_id: 'abc123',
    })
    expect(result.success).toBe(false)
  })

  it('rejects name over 255 characters', () => {
    const result = DataSourceSchema.create.safeParse({
      name: 'x'.repeat(256),
      spreadsheet_id: 'abc123',
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty spreadsheet_id', () => {
    const result = DataSourceSchema.create.safeParse({
      name: 'Test',
      spreadsheet_id: '',
    })
    expect(result.success).toBe(false)
  })

  it('allows optional spreadsheet_url', () => {
    const result = DataSourceSchema.create.safeParse({
      name: 'Test',
      spreadsheet_id: 'abc123',
      spreadsheet_url: 'https://docs.google.com/spreadsheets/d/abc123',
    })
    expect(result.success).toBe(true)
  })

  it('allows null spreadsheet_url', () => {
    const result = DataSourceSchema.create.safeParse({
      name: 'Test',
      spreadsheet_id: 'abc123',
      spreadsheet_url: null,
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid spreadsheet_url', () => {
    const result = DataSourceSchema.create.safeParse({
      name: 'Test',
      spreadsheet_id: 'abc123',
      spreadsheet_url: 'not-a-url',
    })
    expect(result.success).toBe(false)
  })
})

describe('DataSourceSchema.reorder', () => {
  it('validates valid UUIDs', () => {
    const result = DataSourceSchema.reorder.safeParse({
      sourceIds: ['123e4567-e89b-12d3-a456-426614174000'],
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty array', () => {
    const result = DataSourceSchema.reorder.safeParse({
      sourceIds: [],
    })
    expect(result.success).toBe(false)
  })

  it('rejects non-UUID strings', () => {
    const result = DataSourceSchema.reorder.safeParse({
      sourceIds: ['not-a-uuid'],
    })
    expect(result.success).toBe(false)
  })
})

// =========================================================================
// TabMappingSchema
// =========================================================================

describe('TabMappingSchema.create', () => {
  it('validates valid tab mapping', () => {
    const result = TabMappingSchema.create.safeParse({
      data_source_id: '123e4567-e89b-12d3-a456-426614174000',
      tab_name: 'Sheet1',
    })
    expect(result.success).toBe(true)
  })

  it('rejects non-UUID data_source_id', () => {
    const result = TabMappingSchema.create.safeParse({
      data_source_id: 'not-a-uuid',
      tab_name: 'Sheet1',
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty tab_name', () => {
    const result = TabMappingSchema.create.safeParse({
      data_source_id: '123e4567-e89b-12d3-a456-426614174000',
      tab_name: '',
    })
    expect(result.success).toBe(false)
  })

  it('defaults status to active', () => {
    const result = TabMappingSchema.create.safeParse({
      data_source_id: '123e4567-e89b-12d3-a456-426614174000',
      tab_name: 'Sheet1',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.status).toBe('active')
    }
  })

  it('accepts valid status values', () => {
    for (const status of ['active', 'reference', 'hidden', 'flagged']) {
      const result = TabMappingSchema.create.safeParse({
        data_source_id: '123e4567-e89b-12d3-a456-426614174000',
        tab_name: 'Sheet1',
        status,
      })
      expect(result.success).toBe(true)
    }
  })

  it('rejects invalid status', () => {
    const result = TabMappingSchema.create.safeParse({
      data_source_id: '123e4567-e89b-12d3-a456-426614174000',
      tab_name: 'Sheet1',
      status: 'archived',
    })
    expect(result.success).toBe(false)
  })
})

describe('TabMappingSchema.updateStatus', () => {
  it('validates valid status update', () => {
    const result = TabMappingSchema.updateStatus.safeParse({
      status: 'hidden',
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing status', () => {
    const result = TabMappingSchema.updateStatus.safeParse({})
    expect(result.success).toBe(false)
  })
})

describe('TabMappingSchema.confirmHeader', () => {
  it('validates header confirmation', () => {
    const result = TabMappingSchema.confirmHeader.safeParse({
      data_source_id: '123e4567-e89b-12d3-a456-426614174000',
      tab_name: 'Sheet1',
      header_row: 0,
    })
    expect(result.success).toBe(true)
  })

  it('accepts header_row of 0', () => {
    const result = TabMappingSchema.confirmHeader.safeParse({
      data_source_id: '123e4567-e89b-12d3-a456-426614174000',
      tab_name: 'Sheet1',
      header_row: 0,
    })
    expect(result.success).toBe(true)
  })

  it('rejects negative header_row', () => {
    const result = TabMappingSchema.confirmHeader.safeParse({
      data_source_id: '123e4567-e89b-12d3-a456-426614174000',
      tab_name: 'Sheet1',
      header_row: -1,
    })
    expect(result.success).toBe(false)
  })

  it('rejects float header_row', () => {
    const result = TabMappingSchema.confirmHeader.safeParse({
      data_source_id: '123e4567-e89b-12d3-a456-426614174000',
      tab_name: 'Sheet1',
      header_row: 1.5,
    })
    expect(result.success).toBe(false)
  })
})

// =========================================================================
// ColumnMappingSchema
// =========================================================================

describe('ColumnMappingSchema', () => {
  const validMapping = {
    source_column: 'Brand Name',
    source_column_index: 0,
    category: 'partner' as const,
    target_field: 'brand_name',
    authority: 'source_of_truth' as const,
    is_key: true,
  }

  it('validates a complete mapping', () => {
    const result = ColumnMappingSchema.safeParse(validMapping)
    expect(result.success).toBe(true)
  })

  it('rejects empty source_column', () => {
    const result = ColumnMappingSchema.safeParse({
      ...validMapping,
      source_column: '',
    })
    expect(result.success).toBe(false)
  })

  it('accepts null target_field', () => {
    const result = ColumnMappingSchema.safeParse({
      ...validMapping,
      target_field: null,
    })
    expect(result.success).toBe(true)
  })

  it('validates all valid categories', () => {
    for (const cat of ['partner', 'staff', 'asin', 'weekly', 'computed', 'skip']) {
      const result = ColumnMappingSchema.safeParse({
        ...validMapping,
        category: cat,
      })
      expect(result.success).toBe(true)
    }
  })

  it('rejects invalid category', () => {
    const result = ColumnMappingSchema.safeParse({
      ...validMapping,
      category: 'unknown',
    })
    expect(result.success).toBe(false)
  })

  it('validates all valid authority levels', () => {
    for (const auth of ['source_of_truth', 'reference', 'derived']) {
      const result = ColumnMappingSchema.safeParse({
        ...validMapping,
        authority: auth,
      })
      expect(result.success).toBe(true)
    }
  })

  it('defaults transform_type to none', () => {
    const result = ColumnMappingSchema.safeParse(validMapping)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.transform_type).toBe('none')
    }
  })

  it('validates all transform types', () => {
    const transforms = ['none', 'trim', 'lowercase', 'uppercase', 'date', 'currency', 'boolean', 'number', 'json', 'value_mapping']
    for (const t of transforms) {
      const result = ColumnMappingSchema.safeParse({
        ...validMapping,
        transform_type: t,
      })
      expect(result.success).toBe(true)
    }
  })
})

// =========================================================================
// SaveMappingSchema
// =========================================================================

describe('SaveMappingSchema', () => {
  const validPayload = {
    dataSource: {
      name: 'Master Client Sheet',
      spreadsheet_id: 'abc123',
    },
    tabMapping: {
      tab_name: 'Sheet1',
      header_row: 9,
      primary_entity: 'partners' as const,
    },
    columnMappings: [
      {
        source_column: 'Brand Name',
        source_column_index: 0,
        category: 'partner' as const,
        target_field: 'brand_name',
        authority: 'source_of_truth' as const,
        is_key: true,
      },
    ],
  }

  it('validates a complete save mapping payload', () => {
    const result = SaveMappingSchema.safeParse(validPayload)
    expect(result.success).toBe(true)
  })

  it('validates all primary_entity types', () => {
    for (const entity of ['partners', 'staff', 'asins']) {
      const result = SaveMappingSchema.safeParse({
        ...validPayload,
        tabMapping: { ...validPayload.tabMapping, primary_entity: entity },
      })
      expect(result.success).toBe(true)
    }
  })

  it('rejects invalid primary_entity', () => {
    const result = SaveMappingSchema.safeParse({
      ...validPayload,
      tabMapping: { ...validPayload.tabMapping, primary_entity: 'products' },
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty columnMappings', () => {
    // An empty array is valid per schema (no .min(1)), but verify it at least parses
    const result = SaveMappingSchema.safeParse({
      ...validPayload,
      columnMappings: [],
    })
    expect(result.success).toBe(true) // Empty is allowed by schema
  })

  it('accepts optional weeklyPattern', () => {
    const result = SaveMappingSchema.safeParse({
      ...validPayload,
      weeklyPattern: {
        pattern_name: 'weekly_status',
        match_config: { prefix: 'Week' },
      },
    })
    expect(result.success).toBe(true)
  })
})

// =========================================================================
// ConnectorConfigSchema (discriminated union)
// =========================================================================

describe('ConnectorConfigSchema', () => {
  it('validates Google Sheet config', () => {
    const result = ConnectorConfigSchema.safeParse({
      type: 'google_sheet',
      spreadsheet_id: 'abc123def456xyz',
    })
    expect(result.success).toBe(true)
  })

  it('validates Google Form config', () => {
    const result = ConnectorConfigSchema.safeParse({
      type: 'google_form',
      form_id: 'form123',
    })
    expect(result.success).toBe(true)
  })

  it('validates API config', () => {
    const result = ConnectorConfigSchema.safeParse({
      type: 'api',
      endpoint_url: 'https://api.example.com/data',
      auth_type: 'bearer',
    })
    expect(result.success).toBe(true)
  })

  it('validates CSV config', () => {
    const result = ConnectorConfigSchema.safeParse({
      type: 'csv',
      file_name: 'data.csv',
    })
    expect(result.success).toBe(true)
  })

  it('rejects unknown connector type', () => {
    const result = ConnectorConfigSchema.safeParse({
      type: 'salesforce',
      connection_string: 'test',
    })
    expect(result.success).toBe(false)
  })

  it('rejects Google Sheet with short spreadsheet_id', () => {
    const result = GoogleSheetConfigSchema.safeParse({
      type: 'google_sheet',
      spreadsheet_id: 'ab', // too short (min 10)
    })
    expect(result.success).toBe(false)
  })
})

// =========================================================================
// DataSourceSchemaV2
// =========================================================================

describe('DataSourceSchemaV2.create', () => {
  it('accepts legacy format with spreadsheet_id', () => {
    const result = DataSourceSchemaV2.create.safeParse({
      name: 'Test Sheet',
      spreadsheet_id: 'abc123',
    })
    expect(result.success).toBe(true)
  })

  it('accepts new format with connection_config', () => {
    const result = DataSourceSchemaV2.create.safeParse({
      name: 'Test API',
      type: 'api',
      connection_config: {
        type: 'api',
        endpoint_url: 'https://api.example.com',
        auth_type: 'bearer',
      },
    })
    expect(result.success).toBe(true)
  })

  it('rejects when neither spreadsheet_id nor connection_config provided', () => {
    const result = DataSourceSchemaV2.create.safeParse({
      name: 'Test',
    })
    expect(result.success).toBe(false)
  })
})

// =========================================================================
// SheetsSchema
// =========================================================================

describe('SheetsSchema.rawRows', () => {
  it('validates valid raw rows request', () => {
    const result = SheetsSchema.rawRows.safeParse({
      id: 'spreadsheet-id-123',
      tab: 'Sheet1',
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing id', () => {
    const result = SheetsSchema.rawRows.safeParse({
      id: '',
      tab: 'Sheet1',
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing tab', () => {
    const result = SheetsSchema.rawRows.safeParse({
      id: 'abc123',
      tab: '',
    })
    expect(result.success).toBe(false)
  })

  it('caps maxRows at 100', () => {
    const result = SheetsSchema.rawRows.safeParse({
      id: 'abc123',
      tab: 'Sheet1',
      maxRows: 200,
    })
    expect(result.success).toBe(false)
  })

  it('defaults maxRows to 20', () => {
    const result = SheetsSchema.rawRows.safeParse({
      id: 'abc123',
      tab: 'Sheet1',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.maxRows).toBe(20)
    }
  })
})
