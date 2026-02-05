/**
 * Tests for BigQuery connector validation and query building logic.
 *
 * Source: src/lib/connectors/bigquery.ts
 *
 * Note: These tests focus on validateConfig() and metadata.
 * Actual BigQuery API calls are not tested (they require credentials).
 */
import { BigQueryConnector, UNIFIED_VIEWS } from '@/lib/connectors/bigquery'
import type { BigQueryConnectorConfig } from '@/lib/connectors/types'

// Mock the BigQuery client to prevent actual API calls
jest.mock('@google-cloud/bigquery', () => ({
  BigQuery: jest.fn().mockImplementation(() => ({
    dataset: jest.fn(() => ({
      getTables: jest.fn().mockResolvedValue([[]]),
    })),
    createQueryJob: jest.fn().mockResolvedValue([{
      getQueryResults: jest.fn().mockResolvedValue([[]]),
    }]),
    query: jest.fn().mockResolvedValue([[]]),
    getDatasets: jest.fn().mockResolvedValue([[]]),
  })),
}))

describe('BigQueryConnector', () => {
  let connector: BigQueryConnector

  beforeEach(() => {
    connector = new BigQueryConnector()
  })

  // =========================================================================
  // Metadata
  // =========================================================================

  describe('metadata', () => {
    it('has correct id', () => {
      expect(connector.metadata.id).toBe('bigquery')
    })

    it('has correct name', () => {
      expect(connector.metadata.name).toBe('BigQuery')
    })

    it('is enabled', () => {
      expect(connector.metadata.enabled).toBe(true)
    })

    it('does not support search', () => {
      expect(connector.metadata.capabilities.search).toBe(false)
    })

    it('supports tabs (views)', () => {
      expect(connector.metadata.capabilities.hasTabs).toBe(true)
    })

    it('supports incremental sync', () => {
      expect(connector.metadata.capabilities.incrementalSync).toBe(true)
    })

    it('is read-only', () => {
      expect(connector.metadata.capabilities.writeBack).toBe(false)
    })

    it('does not support real-time sync', () => {
      expect(connector.metadata.capabilities.realTimeSync).toBe(false)
    })
  })

  // =========================================================================
  // validateConfig
  // =========================================================================

  describe('validateConfig()', () => {
    it('validates a valid config', () => {
      const config: BigQueryConnectorConfig = {
        type: 'bigquery',
        project_id: 'sophie-society-reporting',
        dataset_id: 'pbi',
      }
      expect(connector.validateConfig(config)).toBe(true)
    })

    it('rejects missing project_id', () => {
      const config = {
        type: 'bigquery',
        project_id: '',
        dataset_id: 'pbi',
      } as BigQueryConnectorConfig
      expect(connector.validateConfig(config)).toBe('Project ID is required')
    })

    it('rejects missing dataset_id', () => {
      const config = {
        type: 'bigquery',
        project_id: 'my-project',
        dataset_id: '',
      } as BigQueryConnectorConfig
      expect(connector.validateConfig(config)).toBe('Dataset ID is required')
    })

    it('accepts optional view_name', () => {
      const config: BigQueryConnectorConfig = {
        type: 'bigquery',
        project_id: 'my-project',
        dataset_id: 'pbi',
        view_name: 'pbi_sp_par_unified_latest',
      }
      expect(connector.validateConfig(config)).toBe(true)
    })

    it('accepts optional partner_field', () => {
      const config: BigQueryConnectorConfig = {
        type: 'bigquery',
        project_id: 'my-project',
        dataset_id: 'pbi',
        partner_field: 'brand_name',
      }
      expect(connector.validateConfig(config)).toBe(true)
    })
  })

  // =========================================================================
  // UNIFIED_VIEWS
  // =========================================================================

  describe('UNIFIED_VIEWS', () => {
    it('contains expected view names', () => {
      expect(UNIFIED_VIEWS).toContain('pbi_sp_par_unified_latest')
      expect(UNIFIED_VIEWS).toContain('pbi_sd_par_unified_latest')
      expect(UNIFIED_VIEWS).toContain('pbi_sellingpartner_sales_unified_latest')
      expect(UNIFIED_VIEWS).toContain('pbi_dim_products_unified_latest')
    })

    it('has 7 views', () => {
      expect(UNIFIED_VIEWS).toHaveLength(7)
    })

    it('all entries are non-empty strings', () => {
      for (const view of UNIFIED_VIEWS) {
        expect(typeof view).toBe('string')
        expect(view.length).toBeGreaterThan(0)
      }
    })
  })
})

// =========================================================================
// Type guards from connector types
// =========================================================================

describe('Connector type guards', () => {
  // Import type guards
  const {
    isGoogleSheetConfig,
    isGoogleFormConfig,
    isApiConfig,
    isCsvConfig,
    isBigQueryConfig,
  } = require('@/lib/connectors/types')

  it('isBigQueryConfig identifies bigquery config', () => {
    expect(isBigQueryConfig({ type: 'bigquery', project_id: 'test', dataset_id: 'ds' })).toBe(true)
    expect(isBigQueryConfig({ type: 'google_sheet', spreadsheet_id: 'test' })).toBe(false)
  })

  it('isGoogleSheetConfig identifies google_sheet config', () => {
    expect(isGoogleSheetConfig({ type: 'google_sheet', spreadsheet_id: 'test' })).toBe(true)
    expect(isGoogleSheetConfig({ type: 'bigquery', project_id: 'test', dataset_id: 'ds' })).toBe(false)
  })

  it('isGoogleFormConfig identifies google_form config', () => {
    expect(isGoogleFormConfig({ type: 'google_form', form_id: 'test' })).toBe(true)
    expect(isGoogleFormConfig({ type: 'csv', file_name: 'test.csv' })).toBe(false)
  })

  it('isApiConfig identifies api config', () => {
    expect(isApiConfig({ type: 'api', endpoint_url: 'https://test.com', auth_type: 'none' })).toBe(true)
    expect(isApiConfig({ type: 'bigquery', project_id: 'test', dataset_id: 'ds' })).toBe(false)
  })

  it('isCsvConfig identifies csv config', () => {
    expect(isCsvConfig({ type: 'csv', file_name: 'test.csv' })).toBe(true)
    expect(isCsvConfig({ type: 'api', endpoint_url: 'https://test.com', auth_type: 'none' })).toBe(false)
  })
})
