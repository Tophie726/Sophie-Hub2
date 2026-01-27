import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { format, parseISO } from 'date-fns'

interface FieldValue {
  label: string
  value: string | number | boolean | string[] | null | undefined
  type?: 'text' | 'number' | 'date' | 'currency' | 'percent' | 'array' | 'url' | 'email' | 'phone'
}

interface FieldGroupSectionProps {
  title: string
  icon?: React.ReactNode
  fields: FieldValue[]
}

function formatFieldValue(field: FieldValue): React.ReactNode {
  const { value, type } = field

  if (value === null || value === undefined || value === '') {
    return <span className="text-muted-foreground">--</span>
  }

  switch (type) {
    case 'date':
      try {
        return format(parseISO(String(value)), 'MMM d, yyyy')
      } catch {
        return String(value)
      }
    case 'currency':
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(Number(value))
    case 'percent':
      return `${Number(value)}%`
    case 'array':
      if (Array.isArray(value) && value.length > 0) {
        return (
          <div className="flex flex-wrap gap-1">
            {value.map((v, i) => (
              <span
                key={i}
                className="inline-flex px-1.5 py-0.5 text-[11px] rounded bg-muted text-muted-foreground"
              >
                {String(v).replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        )
      }
      return <span className="text-muted-foreground">--</span>
    case 'url':
      return (
        <a
          href={String(value)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline truncate block"
        >
          {String(value).replace(/^https?:\/\//, '')}
        </a>
      )
    case 'email':
      return (
        <a href={`mailto:${value}`} className="text-primary hover:underline">
          {String(value)}
        </a>
      )
    case 'phone':
      return (
        <a href={`tel:${value}`} className="text-primary hover:underline">
          {String(value)}
        </a>
      )
    case 'number':
      return (
        <span className="tabular-nums">
          {typeof value === 'number' ? value.toLocaleString() : String(value)}
        </span>
      )
    default:
      return String(value)
  }
}

export function FieldGroupSection({ title, icon, fields }: FieldGroupSectionProps) {
  // Filter out fields where all values are null/undefined (completely empty group)
  const hasAnyValue = fields.some(f => f.value !== null && f.value !== undefined && f.value !== '')
  if (!hasAnyValue && fields.length > 0) {
    // Still show the section, just with "--" placeholders
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
          {fields.map((field, i) => (
            <div key={i} className="space-y-0.5">
              <dt className="text-xs text-muted-foreground">{field.label}</dt>
              <dd className="text-sm">{formatFieldValue(field)}</dd>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
