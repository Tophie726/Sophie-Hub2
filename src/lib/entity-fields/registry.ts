/**
 * Entity Field Registry - Data + Helpers
 *
 * Central registry of all entity field definitions for partners, staff, and asins.
 * Replaces the three disconnected field definitions that were scattered across:
 * - smart-mapper.tsx (MapPhase dropdown)
 * - mapping-sdk.ts (AI suggestions)
 * - DB migrations (actual schema)
 */

import type { EntityType } from '@/types/entities'
import type {
  FieldDefinition,
  EntityFieldRegistry,
  FieldDefOption,
  GroupedFieldDefs,
  FieldGroup,
} from './types'

// =============================================================================
// Partner Fields (20 fields in 6 groups)
// =============================================================================

const PARTNER_FIELDS: FieldDefinition[] = [
  // Core Info
  { name: 'brand_name', label: 'Brand Name', description: 'The brand/company name (unique identifier)', type: 'text', group: 'Core Info', isKey: true, aliases: ['brand', 'company name', 'partner name', 'account name'] },
  { name: 'partner_code', label: 'Partner Code', description: 'Internal partner code (e.g., SO-0123)', type: 'text', group: 'Core Info', aliases: ['code', 'partner id', 'account code'] },
  { name: 'status', label: 'Status', description: 'Active, Churned, Onboarding, etc.', type: 'text', group: 'Core Info', aliases: ['partner status', 'account status', 'subscription status'] },
  { name: 'tier', label: 'Tier', description: 'Service tier level', type: 'text', group: 'Core Info', aliases: ['service tier', 'tier level', 'package', 'tier (from allocation)'] },
  { name: 'notes', label: 'Notes', description: 'General notes about the partner', type: 'text', group: 'Core Info', aliases: ['leadership notes', 'partner notes'] },
  { name: 'seller_central_name', label: 'Seller Central Name', description: 'Amazon Seller Central account name', type: 'text', group: 'Core Info', aliases: ['seller central', 'sc name', 'amazon account'] },
  { name: 'marketplace', label: 'Marketplace', description: 'Amazon marketplace (US, UK, etc.)', type: 'text', group: 'Core Info', aliases: ['amazon marketplace', 'market'] },
  { name: 'product_category', label: 'Product Category', description: 'Main product category', type: 'text', group: 'Core Info', aliases: ['category', 'niche'] },

  // Contact
  { name: 'client_name', label: 'Client Name', description: 'Primary contact person name', type: 'text', group: 'Contact', aliases: ['contact name', 'client contact', 'primary contact'] },
  { name: 'client_email', label: 'Client Email', description: 'Primary contact email address', type: 'text', group: 'Contact', aliases: ['email', 'email address', 'contact email'] },
  { name: 'client_phone', label: 'Client Phone', description: 'Primary contact phone number', type: 'text', group: 'Contact', aliases: ['phone', 'phone number', 'contact phone', 'telephone', 'mobile'] },

  // Financial
  { name: 'base_fee', label: 'Base Fee', description: 'Monthly base fee amount', type: 'number', group: 'Financial', aliases: ['fee', 'monthly fee', 'retainer'] },
  { name: 'commission_rate', label: 'Commission Rate', description: 'Commission percentage', type: 'number', group: 'Financial', aliases: ['commission', 'commission structure', 'commission %'] },
  { name: 'billing_day', label: 'Billing Day', description: 'Day of month for billing', type: 'number', group: 'Financial' },

  // Dates
  { name: 'onboarding_date', label: 'Onboarding Date', description: 'When onboarding started', type: 'date', group: 'Dates', aliases: ['onboarded', 'onboard date', 'start date'] },
  { name: 'contract_start_date', label: 'Contract Start', description: 'Contract start date', type: 'date', group: 'Dates', aliases: ['contract start date'] },
  { name: 'contract_end_date', label: 'Contract End', description: 'Contract end date', type: 'date', group: 'Dates', aliases: ['contract end date'] },
  { name: 'churned_date', label: 'Churned Date', description: 'Date partner churned (if applicable)', type: 'date', group: 'Dates', aliases: ['churn date', 'churned'] },

  // Metrics
  { name: 'parent_asin_count', label: 'Parent ASIN Count', description: 'Number of parent ASINs', type: 'number', group: 'Metrics', aliases: ['parent asins', 'parent count', 'no. of parent asins'] },
  { name: 'child_asin_count', label: 'Child ASIN Count', description: 'Number of child ASINs', type: 'number', group: 'Metrics', aliases: ['child asins', 'child count', 'no. of child asins'] },
  { name: 'months_subscribed', label: 'Months Subscribed', description: 'Total months as a subscriber', type: 'number', group: 'Metrics', aliases: ['subscription months', 'tenure'] },

  // Subscription
  { name: 'content_subscriber', label: 'Content Subscriber', description: 'Whether partner subscribes to content services', type: 'text', group: 'Subscription', aliases: ['content sub', 'content subscription'] },
  { name: 'prepaid_client', label: 'Prepaid Client', description: 'Whether client is prepaid', type: 'text', group: 'Subscription', aliases: ['prepaid'] },
  { name: 'onboarding_fee', label: 'Onboarding Fee', description: 'Whether onboarding fee was charged', type: 'text', group: 'Subscription', aliases: ['onboard fee'] },
  { name: 'payment_status', label: 'Payment Status', description: 'Current payment status', type: 'text', group: 'Subscription', aliases: ['payment'] },
  { name: 'happy_client', label: 'Happy Client', description: 'Client satisfaction flag', type: 'text', group: 'Subscription', aliases: ['satisfied', 'client satisfaction'] },

  // Links
  { name: 'client_folder_url', label: 'Client Folder', description: 'Google Drive client folder URL', type: 'text', group: 'Links', aliases: ['client folder', 'drive folder', 'folder link'] },
  { name: 'internal_brand_sheet_url', label: 'Internal Brand Sheet', description: 'Link to internal brand sheet', type: 'text', group: 'Links', aliases: ['internal brand sheet', 'brand sheet'] },
  { name: 'slack_channel_url', label: 'Slack Channel', description: 'Client Slack channel URL', type: 'text', group: 'Links', aliases: ['slack channel link', 'slack channel', 'slack'] },
  { name: 'slack_alert_channel', label: 'Slack Alert Channel', description: 'Slack alert channel URL', type: 'text', group: 'Links', aliases: ['alert channel'] },
  { name: 'looker_studio_url', label: 'Looker Studio', description: 'Looker Studio dashboard URL', type: 'text', group: 'Links', aliases: ['looker studio link', 'looker', 'dashboard'] },
  { name: 'notion_url', label: 'Notion Link', description: 'Notion workspace URL', type: 'text', group: 'Links', aliases: ['notion link', 'notion'] },
  { name: 'close_io_url', label: 'Close.io Link', description: 'Close CRM record URL', type: 'text', group: 'Links', aliases: ['close.io link', 'close io', 'close link'] },
  { name: 'ad_console_id', label: 'Ad Console ID', description: 'Amazon Advertising console ID', type: 'text', group: 'Links', aliases: ['ad console', 'advertising console'] },

  // Staff Names (raw text - stores name even without staff link)
  // These enable graceful degradation: name shows with "unlinked" indicator until staff syncs
  { name: 'pod_leader_name', label: 'POD Leader', description: 'POD Leader name (may not link to staff yet)', type: 'text', group: 'Staff Assignments', aliases: ['pod leader', 'pl', 'pod lead'] },
  { name: 'brand_manager_name', label: 'Brand Manager', description: 'Brand Manager name (may not link to staff yet)', type: 'text', group: 'Staff Assignments', aliases: ['brand manager', 'bm'] },
  { name: 'account_manager_name', label: 'Account Manager', description: 'Account Manager name (may not link to staff yet)', type: 'text', group: 'Staff Assignments', aliases: ['account manager', 'am'] },
  { name: 'sales_rep_name', label: 'Sales Rep', description: 'Sales Rep name (may not link to staff yet)', type: 'text', group: 'Staff Assignments', aliases: ['sales rep', 'salesperson', 'sales person', 'sales representative'] },

  // Staff References (junction table - created when staff syncs and names match)
  {
    name: 'pod_leader_id', label: 'POD Leader (Linked)', description: 'Linked POD Leader staff record',
    type: 'reference', group: 'Staff Assignments',
    reference: { entity: 'staff', matchField: 'full_name', storage: 'junction', junctionTable: 'partner_assignments', junctionRole: 'pod_leader' },
  },
  {
    name: 'account_manager_id', label: 'Account Manager (Linked)', description: 'Linked Account Manager staff record',
    type: 'reference', group: 'Staff Assignments',
    reference: { entity: 'staff', matchField: 'full_name', storage: 'junction', junctionTable: 'partner_assignments', junctionRole: 'account_manager' },
  },
  {
    name: 'brand_manager_id', label: 'Brand Manager (Linked)', description: 'Linked Brand Manager staff record',
    type: 'reference', group: 'Staff Assignments',
    reference: { entity: 'staff', matchField: 'full_name', storage: 'junction', junctionTable: 'partner_assignments', junctionRole: 'brand_manager' },
  },
  {
    name: 'sales_rep_id', label: 'Sales Rep (Linked)', description: 'Linked Sales Rep staff record',
    type: 'reference', group: 'Staff Assignments',
    reference: { entity: 'staff', matchField: 'full_name', storage: 'junction', junctionTable: 'partner_assignments', junctionRole: 'sales_rep' },
  },
  {
    name: 'ppc_specialist_id', label: 'PPC Specialist (Linked)', description: 'Linked PPC Specialist staff record',
    type: 'reference', group: 'Staff Assignments',
    reference: { entity: 'staff', matchField: 'full_name', storage: 'junction', junctionTable: 'partner_assignments', junctionRole: 'ppc_specialist' },
  },
]

// =============================================================================
// Staff Fields (17 fields in 7 groups)
// =============================================================================

const STAFF_FIELDS: FieldDefinition[] = [
  // Core Info
  { name: 'full_name', label: 'Full Name', description: 'Staff member full name (unique identifier)', type: 'text', group: 'Core Info', isKey: true, aliases: ['name', 'staff name', 'employee name'] },

  // Contact
  { name: 'email', label: 'Email', description: 'Work email address', type: 'text', group: 'Contact', aliases: ['email address', 'work email', 'contact email'] },
  { name: 'phone', label: 'Phone', description: 'Phone number', type: 'text', group: 'Contact', aliases: ['phone number', 'mobile', 'telephone', 'contact phone'] },
  { name: 'slack_id', label: 'Slack ID', description: 'Slack username or ID', type: 'text', group: 'Contact', aliases: ['slack', 'slack handle'] },

  // Status & Role
  { name: 'role', label: 'Role', description: 'Job role (e.g. pod_leader, account_manager)', type: 'text', group: 'Status & Role', aliases: ['job role', 'position'] },
  { name: 'department', label: 'Department', description: 'Team or department', type: 'text', group: 'Status & Role', aliases: ['dept', 'team'] },
  { name: 'title', label: 'Title', description: 'Job title', type: 'text', group: 'Status & Role', aliases: ['job title'] },
  { name: 'status', label: 'Status', description: 'Active, On Leave, Departed, etc.', type: 'text', group: 'Status & Role', aliases: ['staff status', 'employment status'] },

  // Metrics
  { name: 'max_clients', label: 'Max Clients', description: 'Maximum client capacity', type: 'number', group: 'Metrics', aliases: ['client capacity', 'capacity'] },
  { name: 'current_client_count', label: 'Current Client Count', description: 'Number of currently assigned clients', type: 'number', group: 'Metrics', aliases: ['client count', 'active clients'] },
  { name: 'services', label: 'Services', description: 'Services offered (comma-separated or array)', type: 'array', group: 'Metrics' },

  // Dates
  { name: 'hire_date', label: 'Hire Date', description: 'Employment start date', type: 'date', group: 'Dates', aliases: ['hired', 'start date', 'date hired'] },
  { name: 'probation_end_date', label: 'Probation End', description: 'End of probation period', type: 'date', group: 'Dates' },
  { name: 'departure_date', label: 'Departure Date', description: 'Employment end date (if departed)', type: 'date', group: 'Dates', aliases: ['left date', 'end date'] },

  // Links
  { name: 'dashboard_url', label: 'Dashboard URL', description: 'Link to staff dashboard', type: 'text', group: 'Links', aliases: ['dashboard', 'dashboard link'] },
  { name: 'calendly_url', label: 'Calendly URL', description: 'Calendly scheduling link', type: 'text', group: 'Links', aliases: ['calendly', 'calendly link', 'booking link'] },

  // Staff Assignments (self-reference)
  {
    name: 'manager_id', label: 'Manager', description: 'Direct manager (another staff member)',
    type: 'reference', group: 'Staff Assignments',
    reference: { entity: 'staff', matchField: 'full_name', storage: 'direct', fkColumn: 'manager_id' },
  },
]

// =============================================================================
// ASIN Fields (10 fields in 4 groups)
// =============================================================================

const ASIN_FIELDS: FieldDefinition[] = [
  // Core Info
  { name: 'asin_code', label: 'ASIN Code', description: 'Amazon Standard Identification Number', type: 'text', group: 'Core Info', isKey: true, aliases: ['asin', 'amazon asin'] },
  { name: 'title', label: 'Title', description: 'Product title', type: 'text', group: 'Core Info', aliases: ['product title', 'product name'] },
  { name: 'sku', label: 'SKU', description: 'Stock Keeping Unit', type: 'text', group: 'Core Info', aliases: ['sku code', 'stock code'] },
  { name: 'category', label: 'Category', description: 'Product category', type: 'text', group: 'Core Info', aliases: ['product category'] },
  { name: 'status', label: 'Status', description: 'Active, Suppressed, etc.', type: 'text', group: 'Core Info', aliases: ['asin status', 'product status'] },
  {
    name: 'brand_name', label: 'Brand Name', description: 'Partner brand this ASIN belongs to',
    type: 'reference', group: 'Core Info',
    reference: { entity: 'partners', matchField: 'brand_name', storage: 'direct', fkColumn: 'partner_id' },
  },

  // Product Info
  { name: 'parent_asin', label: 'Parent ASIN', description: 'Parent product ASIN code', type: 'text', group: 'Product Info' },
  { name: 'is_parent', label: 'Is Parent', description: 'Whether this is a parent ASIN', type: 'boolean', group: 'Product Info' },

  // Financial
  { name: 'cogs', label: 'COGS', description: 'Cost of goods sold', type: 'number', group: 'Financial' },
  { name: 'price', label: 'Price', description: 'Selling price', type: 'number', group: 'Financial' },
]

// =============================================================================
// Registry
// =============================================================================

const ENTITY_FIELD_REGISTRY: EntityFieldRegistry = {
  partners: PARTNER_FIELDS,
  staff: STAFF_FIELDS,
  asins: ASIN_FIELDS,
}

// =============================================================================
// Helper Functions
// =============================================================================

/** Get all field definitions for an entity */
export function getFieldsForEntity(entity: EntityType): FieldDefinition[] {
  return ENTITY_FIELD_REGISTRY[entity] ?? []
}

/** Get backward-compatible dropdown format: { value, label, description } */
export function getFieldDefs(entity: EntityType): FieldDefOption[] {
  return getFieldsForEntity(entity).map((f) => ({
    value: f.name,
    label: f.reference
      ? `${f.label} \u2192 ${capitalize(f.reference.entity)}`
      : f.isKey
        ? `${f.label} (Key)`
        : f.label,
    description: f.description,
  }))
}

/** Get fields grouped by FieldGroup for Select with group headers */
export function getGroupedFieldDefs(entity: EntityType): GroupedFieldDefs[] {
  const fields = getFieldsForEntity(entity)
  const groupOrder: FieldGroup[] = [
    'Core Info',
    'Contact',
    'Status & Role',
    'Financial',
    'Metrics',
    'Subscription',
    'Dates',
    'Links',
    'Product Info',
    'Staff Assignments',
  ]

  const grouped = new Map<FieldGroup, FieldDefOption[]>()

  for (const field of fields) {
    if (!grouped.has(field.group)) {
      grouped.set(field.group, [])
    }
    grouped.get(field.group)!.push({
      value: field.name,
      label: field.reference
        ? `${field.label} \u2192 ${capitalize(field.reference.entity)}`
        : field.isKey
          ? `${field.label} (Key)`
          : field.label,
      description: field.description,
    })
  }

  // Return in defined order, filtering out empty groups
  return groupOrder
    .filter((group) => grouped.has(group))
    .map((group) => ({
      group,
      fields: grouped.get(group)!,
    }))
}

/** Get just the field names as a string array (for AI schema) */
export function getFieldNames(entity: EntityType): string[] {
  return getFieldsForEntity(entity).map((f) => f.name)
}

/** Get entity schema as Record<EntityType, string[]> (drop-in ENTITY_SCHEMA replacement) */
export function getEntitySchema(): Record<EntityType, string[]> {
  return {
    partners: getFieldNames('partners'),
    staff: getFieldNames('staff'),
    asins: getFieldNames('asins'),
  }
}

/** Get only reference fields for an entity */
export function getReferenceFields(entity: EntityType): FieldDefinition[] {
  return getFieldsForEntity(entity).filter((f) => f.type === 'reference' && f.reference)
}

/** Get the key field definition for an entity */
export function getKeyField(entity: EntityType): FieldDefinition | undefined {
  return getFieldsForEntity(entity).find((f) => f.isKey)
}

/** Look up a single field definition by entity and field name */
export function getFieldDefinition(entity: EntityType, name: string): FieldDefinition | undefined {
  return getFieldsForEntity(entity).find((f) => f.name === name)
}

/** Get which entities this entity depends on (via reference fields) */
export function getReferencedEntities(entity: EntityType): EntityType[] {
  const refs = getReferenceFields(entity)
  const entities = new Set<EntityType>()
  for (const ref of refs) {
    if (ref.reference) {
      entities.add(ref.reference.entity)
    }
  }
  return Array.from(entities)
}

/** Generate AI-friendly schema description for all entities */
export function getSchemaDescription(): string {
  const entities: EntityType[] = ['partners', 'staff', 'asins']
  const sections: string[] = []

  for (const entity of entities) {
    const fields = getFieldsForEntity(entity)
    const keyField = getKeyField(entity)
    const refFields = getReferenceFields(entity)

    const entityLabel = entity === 'partners' ? 'partners (Client brands we manage)'
      : entity === 'staff' ? 'staff (Team members)'
      : 'asins (Amazon products per partner)'

    let section = `### ${entityLabel}\n`
    section += `**PRIMARY KEY: ${keyField?.name ?? 'unknown'}**`
    if (keyField) {
      section += ` (${keyField.description})`
    }
    section += '\n'
    section += `Fields: ${fields.map((f) => f.name).join(', ')}\n`

    if (refFields.length > 0) {
      const refDescriptions = refFields.map((f) => {
        const ref = f.reference!
        const storageInfo = ref.storage === 'junction'
          ? `via ${ref.junctionTable}, role: ${ref.junctionRole}`
          : `FK: ${ref.fkColumn}`
        return `${f.name} -> ${ref.entity}.${ref.matchField} (${storageInfo})`
      })
      section += `Reference fields: ${refDescriptions.join('; ')}`
    }

    sections.push(section)
  }

  return sections.join('\n\n')
}

// =============================================================================
// Internal Helpers
// =============================================================================

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
