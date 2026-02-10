/**
 * Tests for view precedence resolver
 *
 * Source: src/lib/views/resolve-view.ts
 */
import type { ViewResolverInput } from '@/lib/auth/viewer-context'

// ---------------------------------------------------------------------------
// Mock Supabase query builder
// ---------------------------------------------------------------------------

type MockRule = {
  id: string
  view_id: string
  tier: number
  target_type: string
  target_id: string | null
  priority: number
  is_active: boolean
  created_at: string
  view_profiles: {
    id: string
    slug: string
    name: string
    description: string | null
    is_default: boolean
    is_active: boolean
    created_by: string | null
    created_at: string
    updated_at: string
  }
}

let mockRules: MockRule[] = []

// Build a chainable mock query builder
interface MockQueryBuilder {
  select: jest.Mock
  eq: jest.Mock
  is: jest.Mock
  order: jest.Mock
  then: unknown
}

function createMockQueryBuilder(): MockQueryBuilder {
  let filters: Record<string, unknown> = {}
  let isNullField: string | null = null

  const builder: MockQueryBuilder = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn((field: string, value: unknown) => {
      filters[field] = value
      return builder
    }),
    is: jest.fn((field: string, _value: unknown) => {
      isNullField = field
      return builder
    }),
    order: jest.fn().mockReturnThis(),
    then: undefined as unknown,
  }

  // Make it thenable so `await query` works
  Object.defineProperty(builder, 'then', {
    get: () => {
      return (resolve: (val: unknown) => void) => {
        // Filter mockRules based on accumulated filters
        const filtered = mockRules.filter(r => {
          for (const [key, val] of Object.entries(filters)) {
            // Handle nested filter like view_profiles.is_active
            if (key.includes('.')) {
              const [parent, child] = key.split('.')
              const nested = r[parent as keyof MockRule] as Record<string, unknown> | undefined
              if (nested && nested[child] !== val) return false
            } else if ((r as Record<string, unknown>)[key] !== val) {
              return false
            }
          }
          if (isNullField && (r as Record<string, unknown>)[isNullField] !== null) {
            return false
          }
          return true
        })

        // Sort by priority ASC, created_at ASC
        filtered.sort((a, b) => {
          if (a.priority !== b.priority) return a.priority - b.priority
          return a.created_at.localeCompare(b.created_at)
        })

        resolve({ data: filtered, error: null })
      }
    },
  })

  return builder
}

jest.mock('@/lib/supabase/admin', () => ({
  getAdminClient: () => ({
    from: () => createMockQueryBuilder(),
  }),
}))

// Import after mocks
import { resolveEffectiveView } from '@/lib/views/resolve-view'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NOW = '2026-02-10T00:00:00Z'

function makeView(slug: string, name: string, overrides?: Partial<MockRule['view_profiles']>) {
  return {
    id: `view-${slug}`,
    slug,
    name,
    description: null,
    is_default: false,
    is_active: true,
    created_by: null,
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  }
}

function makeRule(
  tier: number,
  targetType: string,
  targetId: string | null,
  viewSlug: string,
  overrides?: Partial<MockRule>,
): MockRule {
  return {
    id: `rule-${tier}-${targetType}-${targetId || 'default'}`,
    view_id: `view-${viewSlug}`,
    tier,
    target_type: targetType,
    target_id: targetId,
    priority: 0,
    is_active: true,
    created_at: NOW,
    view_profiles: makeView(viewSlug, `${viewSlug} view`),
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockRules = []
})

describe('resolveEffectiveView()', () => {
  describe('individual tiers', () => {
    it('resolves tier 1 (staff)', async () => {
      mockRules = [makeRule(1, 'staff', 'staff-001', 'staff-view')]

      const result = await resolveEffectiveView({
        staffId: 'staff-001',
        roleSlug: null,
        partnerId: null,
        partnerTypeSlug: null,
      })

      expect(result).not.toBeNull()
      expect(result!.slug).toBe('staff-view')
    })

    it('resolves tier 2 (role)', async () => {
      mockRules = [makeRule(2, 'role', 'pod_leader', 'pod-view')]

      const result = await resolveEffectiveView({
        staffId: null,
        roleSlug: 'pod_leader',
        partnerId: null,
        partnerTypeSlug: null,
      })

      expect(result).not.toBeNull()
      expect(result!.slug).toBe('pod-view')
    })

    it('resolves tier 3 (partner)', async () => {
      mockRules = [makeRule(3, 'partner', 'partner-100', 'partner-view')]

      const result = await resolveEffectiveView({
        staffId: null,
        roleSlug: null,
        partnerId: 'partner-100',
        partnerTypeSlug: null,
      })

      expect(result).not.toBeNull()
      expect(result!.slug).toBe('partner-view')
    })

    it('resolves tier 4 (partner_type)', async () => {
      mockRules = [makeRule(4, 'partner_type', 'wholesale', 'wholesale-view')]

      const result = await resolveEffectiveView({
        staffId: null,
        roleSlug: null,
        partnerId: null,
        partnerTypeSlug: 'wholesale',
      })

      expect(result).not.toBeNull()
      expect(result!.slug).toBe('wholesale-view')
    })

    it('resolves tier 5 (default)', async () => {
      mockRules = [makeRule(5, 'default', null, 'default-view')]

      const result = await resolveEffectiveView({
        staffId: null,
        roleSlug: null,
        partnerId: null,
        partnerTypeSlug: null,
      })

      expect(result).not.toBeNull()
      expect(result!.slug).toBe('default-view')
    })
  })

  describe('tier precedence', () => {
    it('staff (tier 1) overrides role (tier 2)', async () => {
      mockRules = [
        makeRule(1, 'staff', 'staff-001', 'staff-view'),
        makeRule(2, 'role', 'admin', 'role-view'),
      ]

      const result = await resolveEffectiveView({
        staffId: 'staff-001',
        roleSlug: 'admin',
        partnerId: null,
        partnerTypeSlug: null,
      })

      expect(result!.slug).toBe('staff-view')
    })

    it('role (tier 2) overrides default (tier 5)', async () => {
      mockRules = [
        makeRule(2, 'role', 'staff', 'staff-role-view'),
        makeRule(5, 'default', null, 'default-view'),
      ]

      const result = await resolveEffectiveView({
        staffId: null,
        roleSlug: 'staff',
        partnerId: null,
        partnerTypeSlug: null,
      })

      expect(result!.slug).toBe('staff-role-view')
    })

    it('partner (tier 3) overrides partner_type (tier 4)', async () => {
      mockRules = [
        makeRule(3, 'partner', 'partner-100', 'partner-specific'),
        makeRule(4, 'partner_type', 'wholesale', 'wholesale-generic'),
      ]

      const result = await resolveEffectiveView({
        staffId: null,
        roleSlug: null,
        partnerId: 'partner-100',
        partnerTypeSlug: 'wholesale',
      })

      expect(result!.slug).toBe('partner-specific')
    })
  })

  describe('tie-breaking', () => {
    it('selects lower priority number within same tier', async () => {
      mockRules = [
        makeRule(2, 'role', 'admin', 'low-priority', { priority: 10 }),
        makeRule(2, 'role', 'admin', 'high-priority', { priority: 0 }),
      ]

      const result = await resolveEffectiveView({
        staffId: null,
        roleSlug: 'admin',
        partnerId: null,
        partnerTypeSlug: null,
      })

      expect(result!.slug).toBe('high-priority')
    })

    it('selects earlier created_at when priorities are equal', async () => {
      mockRules = [
        makeRule(2, 'role', 'admin', 'newer', { priority: 0, created_at: '2026-02-10T12:00:00Z' }),
        makeRule(2, 'role', 'admin', 'older', { priority: 0, created_at: '2026-01-01T00:00:00Z' }),
      ]

      const result = await resolveEffectiveView({
        staffId: null,
        roleSlug: 'admin',
        partnerId: null,
        partnerTypeSlug: null,
      })

      expect(result!.slug).toBe('older')
    })
  })

  describe('filtering', () => {
    it('skips inactive rules', async () => {
      mockRules = [
        makeRule(1, 'staff', 'staff-001', 'inactive-view', { is_active: false }),
        makeRule(5, 'default', null, 'fallback-view'),
      ]

      const result = await resolveEffectiveView({
        staffId: 'staff-001',
        roleSlug: null,
        partnerId: null,
        partnerTypeSlug: null,
      })

      expect(result!.slug).toBe('fallback-view')
    })

    it('skips inactive view profiles', async () => {
      mockRules = [
        makeRule(1, 'staff', 'staff-001', 'disabled-view', {
          view_profiles: makeView('disabled-view', 'Disabled', { is_active: false }),
        }),
        makeRule(5, 'default', null, 'fallback-view'),
      ]

      const result = await resolveEffectiveView({
        staffId: 'staff-001',
        roleSlug: null,
        partnerId: null,
        partnerTypeSlug: null,
      })

      expect(result!.slug).toBe('fallback-view')
    })

    it('returns null when no rules match', async () => {
      mockRules = []

      const result = await resolveEffectiveView({
        staffId: 'staff-999',
        roleSlug: 'admin',
        partnerId: null,
        partnerTypeSlug: null,
      })

      expect(result).toBeNull()
    })
  })
})
