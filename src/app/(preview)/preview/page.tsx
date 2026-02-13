import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth/config'
import { isTrueAdmin } from '@/lib/auth/admin-access'
import { getAdminClient } from '@/lib/supabase/admin'
import { CANONICAL_PARTNER_TYPE_LABELS } from '@/lib/partners/computed-partner-type'
import { verifyPreviewToken, type PreviewSessionPayload } from '@/lib/views/preview-session'
import { PreviewShell } from '@/components/views/preview-shell'
import type { PreviewModule } from '@/lib/views/module-nav'

// ---------------------------------------------------------------------------
// Error component (shown for invalid/expired tokens)
// ---------------------------------------------------------------------------

function PreviewError({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-8">
      <div className="max-w-md w-full">
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center">
          <div className="mx-auto h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center mb-3">
            <svg
              className="h-5 w-5 text-destructive"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <h2 className="text-sm font-semibold text-destructive mb-1">Preview Unavailable</h2>
          <p className="text-xs text-destructive/80">{message}</p>
          <a
            href="/admin/views"
            className="inline-block mt-4 text-xs font-medium text-primary hover:underline"
          >
            Return to Views
          </a>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helper: fetch modules for the view
// ---------------------------------------------------------------------------

async function fetchPreviewModules(payload: PreviewSessionPayload): Promise<PreviewModule[]> {
  const supabase = getAdminClient()
  const { vid: viewId, subjectType, targetId } = payload

  const { data: assignments, error: assignmentsError } = await supabase
    .from('view_profile_modules')
    .select('module_id, dashboard_id, sort_order')
    .eq('view_id', viewId)
    .order('sort_order', { ascending: true })

  if (assignmentsError || !assignments || assignments.length === 0) return []

  const moduleIds = Array.from(new Set(assignments.map((a) => a.module_id)))
  const { data: moduleRows, error: modulesError } = await supabase
    .from('modules')
    .select('id, slug, name, icon, color')
    .in('id', moduleIds)

  if (modulesError) return []

  const { data: dashboards } = await supabase
    .from('dashboards')
    .select('id, module_id, partner_id, is_template, updated_at')
    .in('module_id', moduleIds)
    .order('updated_at', { ascending: false })

  const moduleById = new Map((moduleRows || []).map((module) => [module.id, module]))
  const dashboardsByModule = new Map<string, Array<{
    id: string
    module_id: string
    partner_id: string | null
    is_template: boolean
    updated_at: string
  }>>()

  for (const dashboard of dashboards || []) {
    const list = dashboardsByModule.get(dashboard.module_id) || []
    list.push(dashboard)
    dashboardsByModule.set(dashboard.module_id, list)
  }

  function pickDashboardId(moduleId: string, current: string | null): string | null {
    if (current) return current

    const candidates = dashboardsByModule.get(moduleId) || []
    if (candidates.length === 0) return null

    if (subjectType === 'partner' && targetId) {
      const partnerSpecific = candidates.find((dashboard) => dashboard.partner_id === targetId)
      if (partnerSpecific) return partnerSpecific.id
    }

    const template = candidates.find((dashboard) => dashboard.is_template || dashboard.partner_id === null)
    if (template) return template.id

    return candidates[0]?.id || null
  }

  return assignments.map((a) => {
    const mod = moduleById.get(a.module_id) as {
      id: string
      slug: string
      name: string
      icon: string | null
      color: string | null
    } | null

    return {
      moduleId: a.module_id,
      slug: mod?.slug ?? 'unknown',
      name: mod?.name ?? 'Unknown Module',
      icon: mod?.icon ?? 'Blocks',
      color: mod?.color ?? 'gray',
      sortOrder: a.sort_order,
      dashboardId: pickDashboardId(a.module_id, a.dashboard_id),
    }
  })
}

function mapRoleLabel(role: string | null | undefined): string {
  switch (role) {
    case 'admin':
      return 'Admin'
    case 'pod_leader':
      return 'PPC Strategist'
    case 'partner':
      return 'Partner'
    default:
      return 'Staff'
  }
}

async function resolvePreviewIdentity(
  payload: PreviewSessionPayload,
  sessionName: string | null | undefined,
): Promise<{ name: string; roleLabel: string }> {
  const supabase = getAdminClient()

  if (payload.subjectType === 'staff' && payload.targetId) {
    const { data: staff } = await supabase
      .from('staff')
      .select('full_name, email, role')
      .eq('id', payload.targetId)
      .maybeSingle()

    return {
      name: staff?.full_name || staff?.email || 'Staff Member',
      roleLabel: mapRoleLabel(staff?.role),
    }
  }

  if (payload.subjectType === 'partner' && payload.targetId) {
    const { data: partner } = await supabase
      .from('partners')
      .select('brand_name')
      .eq('id', payload.targetId)
      .maybeSingle()

    return {
      name: partner?.brand_name || 'Partner',
      roleLabel: 'Partner',
    }
  }

  if (payload.subjectType === 'partner_type' && payload.targetId) {
    const key = payload.targetId as keyof typeof CANONICAL_PARTNER_TYPE_LABELS
    return {
      name: CANONICAL_PARTNER_TYPE_LABELS[key] || payload.targetId,
      roleLabel: 'Partner Type',
    }
  }

  if (payload.subjectType === 'role' && payload.targetId) {
    return {
      name: mapRoleLabel(payload.targetId),
      roleLabel: 'Role Template',
    }
  }

  return {
    name: sessionName || 'Current User',
    roleLabel: mapRoleLabel(payload.resolvedRole),
  }
}

// ---------------------------------------------------------------------------
// Page (Server Component — P1.1: server-only token verification)
// ---------------------------------------------------------------------------

export default async function PreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  // 1. Verify admin session (server-side)
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    redirect('/login.html')
  }

  // 2. Verify admin entitlement (HR-7: isTrueAdmin gate)
  const supabase = getAdminClient()
  const { data: staff } = await supabase
    .from('staff')
    .select('id, role')
    .eq('email', session.user.email)
    .maybeSingle()

  const staffRole = staff?.role ?? null
  const staffId = staff?.id ?? session.user.email

  if (!isTrueAdmin(staffRole, session.user.email)) {
    redirect('/dashboard')
  }

  // 3. Verify token (P1.1: server-side only — preview-session.ts has 'server-only' guard)
  const { token } = await searchParams
  if (!token) {
    return <PreviewError message="No preview token provided. Open this page from the View Builder." />
  }

  const payload = verifyPreviewToken(token)
  if (!payload) {
    return <PreviewError message="Preview token is invalid or has expired. Return to the builder to get a new one." />
  }

  // 4. Actor-binding check (P1.2 / HR-6: payload.act must match authenticated user)
  if (payload.actorId !== staffId) {
    return <PreviewError message="This preview session belongs to a different admin." />
  }

  // 5. Resolve modules server-side
  const modules = await fetchPreviewModules(payload)
  const previewIdentity = await resolvePreviewIdentity(payload, session.user.name)

  // 6. Render the preview shell (client component with providers)
  return <PreviewShell session={payload} modules={modules} previewIdentity={previewIdentity} />
}
