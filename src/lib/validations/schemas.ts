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
