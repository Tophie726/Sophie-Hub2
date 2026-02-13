'use client'

import { useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import type { SmartTextWidgetProps } from '@/lib/reporting/types'
import type { ViewerContext } from '@/lib/auth/viewer-context'
import type { SmartTextTokenKey } from '@/lib/reporting/smart-text'
import { interpolateSmartText, smartTextDateValues } from '@/lib/reporting/smart-text'

type PartnerSummary = {
  brand_name?: string | null
  status?: string | null
  tier?: string | null
  computed_partner_type_label?: string | null
}

type StaffSummary = {
  full_name?: string | null
  role?: string | null
  email?: string | null
}

function toRoleLabel(role?: string | null): string {
  if (!role) return 'Staff'
  if (role === 'pod_leader') return 'PPC Strategist'
  if (role === 'operations_admin') return 'Operations Admin'
  return role.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

export function SmartTextWidget({ config, partnerId, title }: SmartTextWidgetProps) {
  const [viewerContext, setViewerContext] = useState<ViewerContext | null>(null)
  const [partner, setPartner] = useState<PartnerSummary | null>(null)
  const [staff, setStaff] = useState<StaffSummary | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadViewerContext() {
      try {
        const res = await fetch('/api/viewer-context')
        if (!res.ok) return
        const json = await res.json()
        if (!cancelled) setViewerContext((json.data?.viewerContext || null) as ViewerContext | null)
      } catch {
        // Best-effort context fetch; widget still renders placeholders.
      }
    }

    void loadViewerContext()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!partnerId || partnerId === 'snapshot-partner') {
      setPartner(null)
      return
    }

    let cancelled = false

    async function loadPartner() {
      try {
        const res = await fetch(`/api/partners/${partnerId}`)
        if (!res.ok) {
          if (!cancelled) setPartner(null)
          return
        }

        const json = await res.json()
        if (!cancelled) {
          setPartner((json.data?.partner || null) as PartnerSummary | null)
        }
      } catch {
        if (!cancelled) setPartner(null)
      }
    }

    void loadPartner()

    return () => {
      cancelled = true
    }
  }, [partnerId])

  useEffect(() => {
    const subject = viewerContext?.subject
    const staffId = subject?.type === 'staff' ? subject.targetId : null

    if (!staffId || staffId.startsWith('temp-')) {
      setStaff(null)
      return
    }

    let cancelled = false

    async function loadStaff() {
      try {
        const res = await fetch(`/api/staff/${staffId}`)
        if (!res.ok) {
          if (!cancelled) setStaff(null)
          return
        }

        const json = await res.json()
        if (!cancelled) {
          setStaff((json.data?.staff || null) as StaffSummary | null)
        }
      } catch {
        if (!cancelled) setStaff(null)
      }
    }

    void loadStaff()

    return () => {
      cancelled = true
    }
  }, [viewerContext])

  const tokenValues = useMemo(() => {
    const subject = viewerContext?.subject
    const actor = viewerContext?.actor

    const values: Partial<Record<SmartTextTokenKey, string>> = {
      ...smartTextDateValues(),
      'partner.brand_name': partner?.brand_name || (subject?.type === 'partner' ? subject.targetLabel : ''),
      'partner.status': partner?.status || '',
      'partner.tier': partner?.tier || '',
      'partner.type': partner?.computed_partner_type_label || '',
      'staff.name': staff?.full_name || subject?.targetLabel || actor?.email || '',
      'staff.role': toRoleLabel(staff?.role || subject?.resolvedRole || actor?.role),
      'staff.email': staff?.email || actor?.email || '',
      'view.name': title || 'Current View',
    }

    return values
  }, [viewerContext, partner, staff, title])

  const renderedText = useMemo(() => {
    return interpolateSmartText(config.template || '', tokenValues)
  }, [config.template, tokenValues])

  const styleClass =
    config.style === 'heading'
      ? 'text-xl font-semibold leading-tight'
      : config.style === 'callout'
        ? 'rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm font-medium'
        : 'text-sm'

  const alignmentClass =
    config.alignment === 'center'
      ? 'text-center'
      : config.alignment === 'right'
        ? 'text-right'
        : 'text-left'

  return (
    <div className={cn('h-full p-4 md:p-6 antialiased', alignmentClass)}>
      <div className={cn('whitespace-pre-wrap text-muted-foreground', styleClass)}>
        {renderedText || 'Add a smart text template to display personalized content.'}
      </div>
    </div>
  )
}
