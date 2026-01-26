'use client'

import { Building2, Users, Package, FileSpreadsheet } from 'lucide-react'

/**
 * Legend panel showing the color coding and edge types used in the flow map.
 */
export function FlowLegend() {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm space-y-3">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Legend
      </h4>

      {/* Entity types */}
      <div className="space-y-2">
        <LegendItem
          icon={<Building2 className="w-3.5 h-3.5 text-blue-500" />}
          label="Partners"
        />
        <LegendItem
          icon={<Users className="w-3.5 h-3.5 text-green-500" />}
          label="Staff"
        />
        <LegendItem
          icon={<Package className="w-3.5 h-3.5 text-orange-500" />}
          label="ASINs"
        />
        <LegendItem
          icon={<FileSpreadsheet className="w-3.5 h-3.5 text-green-600" />}
          label="Data Source"
        />
      </div>

      {/* Divider */}
      <div className="border-t border-border/50" />

      {/* Edge types */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs">
          <div className="w-8 h-0 border-t-2 border-blue-500" />
          <span className="text-muted-foreground">Data mapping</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <div className="w-8 h-0 border-t-2 border-dashed border-gray-400" />
          <span className="text-muted-foreground">Reference</span>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-border/50" />

      {/* Interactions */}
      <div className="space-y-1 text-xs text-muted-foreground">
        <p>Click entity to expand groups</p>
        <p>Scroll to zoom, drag to pan</p>
      </div>
    </div>
  )
}

function LegendItem({
  icon,
  label,
}: {
  icon: React.ReactNode
  label: string
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <div className="flex items-center justify-center w-5 h-5">{icon}</div>
      <span className="text-foreground">{label}</span>
    </div>
  )
}
