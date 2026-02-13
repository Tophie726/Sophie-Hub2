import { format } from 'date-fns'

export const SMART_TEXT_TOKENS = [
  { key: 'partner.brand_name', label: 'Partner Name' },
  { key: 'partner.status', label: 'Partner Status' },
  { key: 'partner.tier', label: 'Partner Tier' },
  { key: 'partner.type', label: 'Partner Type' },
  { key: 'staff.name', label: 'Staff Name' },
  { key: 'staff.role', label: 'Staff Role' },
  { key: 'staff.email', label: 'Staff Email' },
  { key: 'view.name', label: 'View Name' },
  { key: 'date.today', label: 'Today (e.g. 2026-02-10)' },
  { key: 'date.month', label: 'Current Month' },
] as const

export type SmartTextTokenKey = (typeof SMART_TEXT_TOKENS)[number]['key']

const TOKEN_PATTERN = /{{\s*([a-zA-Z0-9_.-]+)\s*}}/g

export function extractSmartTextVariables(template: string): string[] {
  const found = new Set<string>()
  let match: RegExpExecArray | null

  while ((match = TOKEN_PATTERN.exec(template)) !== null) {
    if (match[1]) found.add(match[1])
  }

  return Array.from(found)
}

export function interpolateSmartText(template: string, values: Partial<Record<SmartTextTokenKey, string>>): string {
  return template.replace(TOKEN_PATTERN, (_full, key: string) => {
    const value = values[key as SmartTextTokenKey]
    return value && value.trim().length > 0 ? value : `{{${key}}}`
  })
}

export function smartTextDateValues(now: Date = new Date()): Pick<Record<SmartTextTokenKey, string>, 'date.today' | 'date.month'> {
  return {
    'date.today': format(now, 'yyyy-MM-dd'),
    'date.month': format(now, 'MMMM'),
  }
}
