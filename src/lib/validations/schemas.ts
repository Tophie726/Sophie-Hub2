/**
 * Zod validation schemas for API input validation
 *
 * Usage in API routes:
 * ```typescript
 * import { DataSourceSchema } from '@/lib/validations/schemas'
 *
 * const result = DataSourceSchema.create.safeParse(body)
 * if (!result.success) {
 *   return apiError('VALIDATION_ERROR', 'Invalid input', result.error.flatten())
 * }
 * // Use result.data (typed and validated)
 * ```
 */

import { z } from 'zod'

// =============================================================================
// Data Sources
// =============================================================================

export const DataSourceSchema = {
  create: z.object({
    name: z
      .string()
      .min(1, 'Name is required')
      .max(255, 'Name must be less than 255 characters'),
    spreadsheet_id: z
      .string()
      .min(1, 'Spreadsheet ID is required'),
    spreadsheet_url: z
      .string()
      .url('Must be a valid URL')
      .optional()
      .nullable(),
  }),

  reorder: z.object({
    sourceIds: z
      .array(z.string().uuid('Invalid source ID'))
      .min(1, 'At least one source ID required'),
  }),
}

// =============================================================================
// Tab Mappings
// =============================================================================

export const TabMappingSchema = {
  create: z.object({
    data_source_id: z
      .string()
      .uuid('Invalid data source ID'),
    tab_name: z
      .string()
      .min(1, 'Tab name is required')
      .max(255, 'Tab name must be less than 255 characters'),
    status: z
      .enum(['active', 'reference', 'hidden', 'flagged'])
      .optional()
      .default('active'),
    notes: z
      .string()
      .max(1000, 'Notes must be less than 1000 characters')
      .optional()
      .nullable(),
  }),

  updateStatus: z.object({
    status: z.enum(['active', 'reference', 'hidden', 'flagged']),
    notes: z
      .string()
      .max(1000, 'Notes must be less than 1000 characters')
      .optional()
      .nullable(),
  }),

  confirmHeader: z.object({
    data_source_id: z
      .string()
      .uuid('Invalid data source ID'),
    tab_name: z
      .string()
      .min(1, 'Tab name is required'),
    header_row: z
      .number()
      .int('Header row must be an integer')
      .min(0, 'Header row must be 0 or greater'),
  }),

  draft: z.object({
    data_source_id: z
      .string()
      .uuid('Invalid data source ID'),
    tab_name: z
      .string()
      .min(1, 'Tab name is required'),
    draft_state: z.object({
      phase: z.enum(['preview', 'classify', 'map']),
      headerRow: z.number().int().min(0),
      columns: z.array(z.object({
        sourceIndex: z.number().int(),
        sourceColumn: z.string(),
        category: z.string().nullable(),
        targetField: z.string().nullable(),
        authority: z.string(),
        isKey: z.boolean(),
        computedConfig: z.record(z.string(), z.unknown()).optional(),
      })),
      timestamp: z.number(),
    }),
    updated_by: z.string().optional(),
  }),
}

// =============================================================================
// Column Mappings (for save endpoint)
// =============================================================================

export const ColumnMappingSchema = z.object({
  source_column: z.string(),
  source_column_index: z.number().int().min(0),
  category: z.enum(['partner', 'staff', 'asin', 'weekly', 'computed', 'skip']),
  target_field: z.string().nullable(),
  authority: z.enum(['source_of_truth', 'reference', 'derived']).default('reference'),
  is_key: z.boolean().default(false),
  tag_ids: z.array(z.string().uuid()).optional(),
})

export const SaveMappingSchema = z.object({
  dataSource: z.object({
    name: z.string().min(1),
    spreadsheet_id: z.string().min(1),
    spreadsheet_url: z.string().url().optional().nullable(),
  }),
  tabMapping: z.object({
    tab_name: z.string().min(1),
    header_row: z.number().int().min(0),
    primary_entity: z.enum(['partners', 'staff', 'asins']),
  }),
  columnMappings: z.array(ColumnMappingSchema),
  weeklyPattern: z.object({
    pattern_name: z.string().optional(),
    match_config: z.record(z.string(), z.unknown()),
  }).optional(),
  computedFields: z.array(z.object({
    target_table: z.string(),
    target_field: z.string(),
    display_name: z.string(),
    computation_type: z.string(),
    source_column: z.string().optional(),
    config: z.record(z.string(), z.unknown()),
    description: z.string().optional(),
  })).optional(),
})

// =============================================================================
// Sheets API
// =============================================================================

export const SheetsSchema = {
  search: z.object({
    q: z.string().max(500, 'Search query too long').optional(),
  }),

  preview: z.object({
    id: z.string().min(1, 'Spreadsheet ID is required'),
  }),

  rawRows: z.object({
    id: z.string().min(1, 'Spreadsheet ID is required'),
    tab: z.string().min(1, 'Tab name is required'),
    maxRows: z.coerce.number().int().min(1).max(100).optional().default(20),
  }),
}

// =============================================================================
// Type exports for use in routes
// =============================================================================

export type CreateDataSourceInput = z.infer<typeof DataSourceSchema.create>
export type ReorderDataSourcesInput = z.infer<typeof DataSourceSchema.reorder>
export type CreateTabMappingInput = z.infer<typeof TabMappingSchema.create>
export type UpdateTabStatusInput = z.infer<typeof TabMappingSchema.updateStatus>
export type ConfirmHeaderInput = z.infer<typeof TabMappingSchema.confirmHeader>
export type SaveMappingInput = z.infer<typeof SaveMappingSchema>

// =============================================================================
// Connector Schemas
// =============================================================================

/**
 * Connector type enum - matches ConnectorTypeId in types.ts
 */
export const ConnectorTypeSchema = z.enum([
  'google_sheet',
  'google_form',
  'api',
  'csv',
])

/**
 * Google Sheets connector configuration
 */
export const GoogleSheetConfigSchema = z.object({
  type: z.literal('google_sheet'),
  spreadsheet_id: z
    .string()
    .min(10, 'Invalid spreadsheet ID'),
  spreadsheet_url: z
    .string()
    .url('Must be a valid URL')
    .optional()
    .nullable(),
})

/**
 * Google Forms connector configuration
 */
export const GoogleFormConfigSchema = z.object({
  type: z.literal('google_form'),
  form_id: z
    .string()
    .min(1, 'Form ID is required'),
  form_url: z
    .string()
    .url('Must be a valid URL')
    .optional()
    .nullable(),
})

/**
 * API connector configuration
 */
export const ApiConfigSchema = z.object({
  type: z.literal('api'),
  endpoint_url: z
    .string()
    .url('Must be a valid URL'),
  auth_type: z.enum(['bearer', 'api_key', 'basic', 'none']),
  headers: z.record(z.string(), z.string()).optional(),
})

/**
 * CSV connector configuration
 */
export const CsvConfigSchema = z.object({
  type: z.literal('csv'),
  file_name: z
    .string()
    .min(1, 'File name is required'),
  file_url: z
    .string()
    .url('Must be a valid URL')
    .optional()
    .nullable(),
  delimiter: z.string().optional(),
  encoding: z.string().optional(),
})

/**
 * Discriminated union of all connector configurations
 * Automatically validates based on the 'type' field
 */
export const ConnectorConfigSchema = z.discriminatedUnion('type', [
  GoogleSheetConfigSchema,
  GoogleFormConfigSchema,
  ApiConfigSchema,
  CsvConfigSchema,
])

/**
 * Extended data source creation schema with connector support
 * Supports both legacy format (spreadsheet_id) and new format (type + connection_config)
 */
export const DataSourceSchemaV2 = {
  create: z.object({
    name: z
      .string()
      .min(1, 'Name is required')
      .max(255, 'Name must be less than 255 characters'),
    // Legacy fields (still supported for backward compatibility)
    spreadsheet_id: z
      .string()
      .min(1)
      .optional(),
    spreadsheet_url: z
      .string()
      .url('Must be a valid URL')
      .optional()
      .nullable(),
    // New connector fields
    type: ConnectorTypeSchema.optional(),
    connection_config: ConnectorConfigSchema.optional(),
  }).refine(
    (data) => {
      // Either legacy spreadsheet_id OR new connection_config must be provided
      const hasLegacy = !!data.spreadsheet_id
      const hasNew = !!data.connection_config
      return hasLegacy || hasNew
    },
    {
      message: 'Either spreadsheet_id or connection_config must be provided',
      path: ['spreadsheet_id'],
    }
  ),
}

/**
 * Extended save mapping schema with connector support
 */
export const SaveMappingSchemaV2 = z.object({
  dataSource: z.object({
    name: z.string().min(1),
    // Legacy fields (still supported)
    spreadsheet_id: z.string().min(1).optional(),
    spreadsheet_url: z.string().url().optional().nullable(),
    // New connector fields
    type: ConnectorTypeSchema.optional(),
    connection_config: ConnectorConfigSchema.optional(),
  }).refine(
    (data) => {
      const hasLegacy = !!data.spreadsheet_id
      const hasNew = !!data.connection_config
      return hasLegacy || hasNew
    },
    {
      message: 'Either spreadsheet_id or connection_config must be provided',
      path: ['spreadsheet_id'],
    }
  ),
  tabMapping: z.object({
    tab_name: z.string().min(1),
    header_row: z.number().int().min(0),
    primary_entity: z.enum(['partners', 'staff', 'asins']),
  }),
  columnMappings: z.array(ColumnMappingSchema),
  weeklyPattern: z.object({
    pattern_name: z.string().optional(),
    match_config: z.record(z.string(), z.unknown()),
  }).optional(),
  computedFields: z.array(z.object({
    target_table: z.string(),
    target_field: z.string(),
    display_name: z.string(),
    computation_type: z.string(),
    source_column: z.string().optional(),
    config: z.record(z.string(), z.unknown()),
    description: z.string().optional(),
  })).optional(),
})

// =============================================================================
// Connector Type exports
// =============================================================================

export type ConnectorType = z.infer<typeof ConnectorTypeSchema>
export type GoogleSheetConfig = z.infer<typeof GoogleSheetConfigSchema>
export type GoogleFormConfig = z.infer<typeof GoogleFormConfigSchema>
export type ApiConfig = z.infer<typeof ApiConfigSchema>
export type CsvConfig = z.infer<typeof CsvConfigSchema>
export type ConnectorConfigInput = z.infer<typeof ConnectorConfigSchema>
export type CreateDataSourceInputV2 = z.infer<typeof DataSourceSchemaV2.create>
export type SaveMappingInputV2 = z.infer<typeof SaveMappingSchemaV2>
