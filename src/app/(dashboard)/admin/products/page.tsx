'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion'
import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import {
  Target,
  Palette,
  Handshake,
  Crown,
  Clapperboard,
  Rocket,
  Mail,
  ShoppingBag,
  MonitorPlay,
  Store,
  Lightbulb,
  LayoutGrid,
  List,
  GitBranch,
  Users,
  BookOpen,
  Boxes,
  ExternalLink,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const easeOut: [number, number, number, number] = [0.22, 1, 0.36, 1]

// =============================================================================
// Data
// =============================================================================

interface ProductDef {
  id: string
  name: string
  shortName?: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  color: string
  services: string[]
  composedOf?: string[]
  isModule?: boolean
  landingPageUrl?: string
}

const allProducts: ProductDef[] = [
  {
    id: 'ppc_basic',
    name: 'PPC Basic',
    description: 'Amazon PPC campaign management — sponsored products, brands, and display ads.',
    icon: Target,
    color: 'blue',
    services: ['PPC Management'],
    landingPageUrl: 'https://sophiesociety.com/services/ppc-basic',
  },
  {
    id: 'cc',
    name: 'Content & Creative',
    shortName: 'C&C',
    description: 'Listing optimization, A+ content, brand stores, and creative assets.',
    icon: Palette,
    color: 'pink',
    services: ['Content & Creative'],
    landingPageUrl: 'https://sophiesociety.com/services/content-creative',
  },
  {
    id: 'sophie_ppc',
    name: 'The Sophie PPC Partnership',
    shortName: 'SOFI',
    description: 'Bundled PPC and creative management through the Sophie partnership model.',
    icon: Handshake,
    color: 'teal',
    services: ['PPC Management', 'Content & Creative'],
    composedOf: ['ppc_basic', 'cc'],
    landingPageUrl: 'https://sophiesociety.com/services/sophie-ppc-partnership',
  },
  {
    id: 'fam',
    name: 'Full Account Management',
    shortName: 'FAM',
    description: 'End-to-end Amazon management — PPC, content, catalogue, inventory, and strategy.',
    icon: Crown,
    color: 'amber',
    services: ['PPC Management', 'Content & Creative', 'Catalogue Mgmt', 'Inventory Mgmt', 'Account Strategy'],
    composedOf: ['sophie_ppc', 'catalogue', 'inventory'],
    landingPageUrl: 'https://sophiesociety.com/services/full-account-management',
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    description: 'TikTok advertising and shop management for Amazon brands.',
    icon: Clapperboard,
    color: 'violet',
    services: ['TikTok Ads'],
    landingPageUrl: 'https://sophiesociety.com/services/tiktok',
  },
  {
    id: 'pli',
    name: 'Product Launch Incubator',
    shortName: 'PLI',
    description: 'Launch programme for new products — research, listing creation, launch PPC, and ranking strategy.',
    icon: Rocket,
    color: 'orange',
    services: ['Launch Strategy', 'Market Research', 'Launch PPC'],
    landingPageUrl: 'https://sophiesociety.com/services/product-launch-incubator',
  },
  {
    id: 'catalogue',
    name: 'Catalogue Management',
    description: 'Listing accuracy, ASIN coverage, suppression alerts, and catalogue health.',
    icon: BookOpen,
    color: 'emerald',
    services: ['Catalogue Mgmt'],
    isModule: true,
    landingPageUrl: 'https://sophiesociety.com/services/catalogue-management',
  },
  {
    id: 'inventory',
    name: 'Inventory Management',
    description: 'Stock levels, reorder planning, FBA inbound, and inventory health.',
    icon: Boxes,
    color: 'sky',
    services: ['Inventory Mgmt'],
    isModule: true,
    landingPageUrl: 'https://sophiesociety.com/services/inventory-management',
  },
]

const customerProducts = allProducts.filter((p) => !p.isModule)
const serviceModules = allProducts.filter((p) => p.isModule)

const ideation: Array<{ name: string; icon: React.ComponentType<{ className?: string }> }> = [
  { name: 'Email Marketing', icon: Mail },
  { name: 'Shopify', icon: ShoppingBag },
  { name: 'Meta', icon: MonitorPlay },
  { name: 'Walmart', icon: Store },
]

// =============================================================================
// Color utilities
// =============================================================================

const colors: Record<string, { bg: string; text: string; border: string; accent: string; fill: string }> = {
  blue:    { bg: 'bg-blue-500/10',    text: 'text-blue-600 dark:text-blue-400',       border: 'border-blue-500/30',    accent: 'from-blue-500',    fill: '#3b82f6' },
  pink:    { bg: 'bg-pink-500/10',    text: 'text-pink-600 dark:text-pink-400',       border: 'border-pink-500/30',    accent: 'from-pink-500',    fill: '#ec4899' },
  teal:    { bg: 'bg-teal-500/10',    text: 'text-teal-600 dark:text-teal-400',       border: 'border-teal-500/30',    accent: 'from-teal-500',    fill: '#14b8a6' },
  amber:   { bg: 'bg-amber-500/10',   text: 'text-amber-600 dark:text-amber-400',     border: 'border-amber-500/30',   accent: 'from-amber-500',   fill: '#f59e0b' },
  violet:  { bg: 'bg-violet-500/10',  text: 'text-violet-600 dark:text-violet-400',   border: 'border-violet-500/30',  accent: 'from-violet-500',  fill: '#8b5cf6' },
  orange:  { bg: 'bg-orange-500/10',  text: 'text-orange-600 dark:text-orange-400',   border: 'border-orange-500/30',  accent: 'from-orange-500',  fill: '#f97316' },
  emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500/30', accent: 'from-emerald-500', fill: '#10b981' },
  sky:     { bg: 'bg-sky-500/10',     text: 'text-sky-600 dark:text-sky-400',         border: 'border-sky-500/30',     accent: 'from-sky-500',     fill: '#0ea5e9' },
}

// =============================================================================
// Composition hierarchy
// =============================================================================

function getDescendants(id: string, cache: Map<string, Set<string>> = new Map()): Set<string> {
  if (cache.has(id)) return cache.get(id)!
  const result = new Set<string>([id])
  const product = allProducts.find((p) => p.id === id)
  if (product?.composedOf) {
    for (const childId of product.composedOf) {
      const descendants = getDescendants(childId, cache)
      Array.from(descendants).forEach((d) => result.add(d))
    }
  }
  cache.set(id, result)
  return result
}

// =============================================================================
// Views
// =============================================================================

type ViewType = 'cards' | 'rows' | 'composition'

const views: Array<{ id: ViewType; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'cards', label: 'Cards', icon: LayoutGrid },
  { id: 'rows', label: 'Rows', icon: List },
  { id: 'composition', label: 'Composition', icon: GitBranch },
]

// =============================================================================
// Cards View
// =============================================================================

function CardsView() {
  return (
    <motion.div
      key="cards"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2, ease: easeOut }}
      className="space-y-10"
    >
      {/* Product cards */}
      <div>
        <div className="flex items-center gap-2 mb-5">
          <h2 className="text-sm font-semibold text-foreground">Products</h2>
          <Badge variant="secondary" className="text-[10px]">{customerProducts.length}</Badge>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {customerProducts.map((product, i) => {
            const c = colors[product.color]
            const Icon = product.icon
            return (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, ease: easeOut, delay: i * 0.04 }}
                whileHover={{ y: -4 }}
                className={cn(
                  'group relative overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-lg',
                  c.border
                )}
              >
                {/* Gradient accent top */}
                <div className={cn('h-1 bg-gradient-to-r to-transparent', c.accent)} />

                {/* Landing page link */}
                {product.landingPageUrl && (
                  <a
                    href={product.landingPageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute top-3 right-3 p-1.5 rounded-md text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/50 transition-colors z-10"
                    title="View landing page"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}

                <div className="p-5">
                  {/* Icon + Title */}
                  <div className="flex items-start gap-4 mb-3">
                    <div className={cn('flex h-11 w-11 items-center justify-center rounded-xl shrink-0 transition-transform group-hover:scale-110', c.bg)}>
                      <Icon className={cn('h-5 w-5', c.text)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-[15px] leading-tight">{product.name}</h3>
                        {product.shortName && (
                          <span className="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            {product.shortName}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-2">
                        {product.description}
                      </p>
                    </div>
                  </div>

                  {/* Services */}
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {product.services.map((service) => (
                      <Badge key={service} variant="secondary" className="text-[10px] font-normal px-2 py-0.5">
                        {service}
                      </Badge>
                    ))}
                  </div>

                  {/* Composed of */}
                  {product.composedOf && (
                    <div className="text-[10px] text-muted-foreground mb-3">
                      <span className="font-medium">Includes:</span>{' '}
                      {product.composedOf.map((cid) => allProducts.find((p) => p.id === cid)?.name).filter(Boolean).join(', ')}
                    </div>
                  )}

                  {/* Footer */}
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-3 border-t border-border/40">
                    <Users className="h-3.5 w-3.5" />
                    <span className="tabular-nums">--</span> partners
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* Service Modules */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-sm font-medium text-muted-foreground">Service Modules</h2>
          <span className="text-[10px] text-muted-foreground">(available within FAM)</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {serviceModules.map((mod) => {
            const c = colors[mod.color]
            const Icon = mod.icon
            return (
              <div key={mod.id} className={cn('flex items-center gap-3 rounded-lg border px-4 py-3', c.border)}>
                <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg shrink-0', c.bg)}>
                  <Icon className={cn('h-4 w-4', c.text)} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{mod.name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{mod.description}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Ideation */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Lightbulb className="h-3.5 w-3.5 text-muted-foreground" />
          <h2 className="text-sm font-medium text-muted-foreground">Ideation</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {ideation.map((item) => {
            const Icon = item.icon
            return (
              <span
                key={item.name}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-border text-xs text-muted-foreground bg-muted/20"
              >
                <Icon className="h-3.5 w-3.5" />
                {item.name}
              </span>
            )
          })}
        </div>
      </div>
    </motion.div>
  )
}

// =============================================================================
// Rows View
// =============================================================================

function RowsView() {
  const all = [...customerProducts, ...serviceModules]
  return (
    <motion.div
      key="rows"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2, ease: easeOut }}
    >
      <div className="rounded-xl border bg-card divide-y divide-border/60">
        {all.map((product) => {
          const c = colors[product.color]
          const Icon = product.icon
          return (
            <div key={product.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/30 transition-colors">
              <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg shrink-0', c.bg)}>
                <Icon className={cn('h-4 w-4', c.text)} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{product.name}</span>
                  {product.shortName && (
                    <span className="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      {product.shortName}
                    </span>
                  )}
                  {product.isModule && (
                    <span className="text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">module</span>
                  )}
                </div>
              </div>
              <div className="hidden md:flex gap-1.5 flex-wrap justify-end">
                {product.services.map((s) => (
                  <Badge key={s} variant="secondary" className="text-[10px] font-normal px-2 py-0.5">{s}</Badge>
                ))}
              </div>
              <div className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                <Users className="h-3 w-3 inline mr-1" />
                --
              </div>
              {product.landingPageUrl && (
                <a
                  href={product.landingPageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-md text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/50 transition-colors"
                  title="View landing page"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          )
        })}
      </div>

      {/* Ideation */}
      <div className="mt-6">
        <div className="flex items-center gap-2 mb-3">
          <Lightbulb className="h-3.5 w-3.5 text-muted-foreground" />
          <h2 className="text-sm font-medium text-muted-foreground">Ideation</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {ideation.map((item) => {
            const Icon = item.icon
            return (
              <span key={item.name} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-border text-xs text-muted-foreground bg-muted/20">
                <Icon className="h-3.5 w-3.5" />
                {item.name}
              </span>
            )
          })}
        </div>
      </div>
    </motion.div>
  )
}

// =============================================================================
// Composition View (Mind Map)
// =============================================================================

const NODE_W = 256
const NODE_H = 58
const CANVAS_W = 920
const CANVAS_H = 430

const nodeLayout: Record<string, { x: number; y: number }> = {
  fam:        { x: 10,  y: 165 },
  sophie_ppc: { x: 326, y: 45 },
  catalogue:  { x: 326, y: 215 },
  inventory:  { x: 326, y: 315 },
  ppc_basic:  { x: 646, y: 15 },
  cc:         { x: 646, y: 105 },
  tiktok:     { x: 646, y: 250 },
  pli:        { x: 646, y: 340 },
}

const compositionEdges: Array<{ from: string; to: string }> = [
  { from: 'fam', to: 'sophie_ppc' },
  { from: 'fam', to: 'catalogue' },
  { from: 'fam', to: 'inventory' },
  { from: 'sophie_ppc', to: 'ppc_basic' },
  { from: 'sophie_ppc', to: 'cc' },
]

function bezierPath(x1: number, y1: number, x2: number, y2: number): string {
  const mx = (x1 + x2) / 2
  return `M ${x1},${y1} C ${mx},${y1} ${mx},${y2} ${x2},${y2}`
}

function CompositionView() {
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const highlighted = useMemo(() => {
    if (!hoveredId) return new Set<string>()
    return getDescendants(hoveredId)
  }, [hoveredId])

  const isActive = hoveredId !== null
  const isNodeHighlighted = (id: string) => !isActive || highlighted.has(id)
  const isEdgeHighlighted = (from: string, to: string) => !isActive || (highlighted.has(from) && highlighted.has(to))

  return (
    <motion.div
      key="composition"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2, ease: easeOut }}
    >
      {/* Desktop SVG map */}
      <div className="hidden md:block">
        <div className="rounded-xl border bg-card p-6 overflow-x-auto">
          <div className="relative" style={{ width: CANVAS_W, height: CANVAS_H }}>
            {/* SVG edges — exact pixel match with node positions */}
            <svg
              className="absolute inset-0 pointer-events-none"
              width={CANVAS_W}
              height={CANVAS_H}
              viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
              fill="none"
            >
              {compositionEdges.map((edge) => {
                const fromNode = nodeLayout[edge.from]
                const toNode = nodeLayout[edge.to]
                const fromProduct = allProducts.find((p) => p.id === edge.from)
                const fillColor = fromProduct ? colors[fromProduct.color].fill : '#9ca3af'
                const x1 = fromNode.x + NODE_W
                const y1 = fromNode.y + NODE_H / 2
                const x2 = toNode.x
                const y2 = toNode.y + NODE_H / 2
                const hl = isEdgeHighlighted(edge.from, edge.to)

                return (
                  <g key={`${edge.from}-${edge.to}`}>
                    <path
                      d={bezierPath(x1, y1, x2, y2)}
                      stroke={fillColor}
                      strokeWidth={2}
                      strokeOpacity={hl ? 0.5 : 0.1}
                      fill="none"
                      style={{ transition: 'stroke-opacity 200ms ease' }}
                    />
                    {/* Connection dots */}
                    <circle cx={x1} cy={y1} r={3} fill={fillColor} opacity={hl ? 0.5 : 0.1} style={{ transition: 'opacity 200ms ease' }} />
                    <circle cx={x2} cy={y2} r={3} fill={fillColor} opacity={hl ? 0.5 : 0.1} style={{ transition: 'opacity 200ms ease' }} />
                  </g>
                )
              })}
            </svg>

            {/* Nodes */}
            {allProducts.filter((p) => nodeLayout[p.id]).map((product) => {
              const pos = nodeLayout[product.id]
              const c = colors[product.color]
              const Icon = product.icon
              const hl = isNodeHighlighted(product.id)
              return (
                <div
                  key={product.id}
                  className={cn(
                    'absolute flex items-center gap-2.5 rounded-lg border px-3.5 py-2.5 bg-card cursor-default select-none',
                    hl ? c.border : 'border-border/40',
                    'transition-all duration-200'
                  )}
                  style={{
                    left: pos.x,
                    top: pos.y,
                    width: NODE_W,
                    height: NODE_H,
                    opacity: hl ? 1 : 0.25,
                    transform: hl && isActive ? 'scale(1.04)' : 'scale(1)',
                    zIndex: hl && isActive ? 10 : 1,
                    boxShadow: hl && isActive ? '0 4px 12px rgba(0,0,0,0.08)' : 'none',
                  }}
                  onMouseEnter={() => setHoveredId(product.id)}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg shrink-0', c.bg)}>
                    <Icon className={cn('h-4 w-4', c.text)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold leading-tight">{product.name}</p>
                    {product.shortName && (
                      <p className="text-[10px] text-muted-foreground leading-tight">{product.shortName}</p>
                    )}
                  </div>
                </div>
              )
            })}

            {/* Standalone label */}
            <div
              className="absolute text-[10px] text-muted-foreground/40 font-medium uppercase tracking-wider"
              style={{ left: 646, top: 228 }}
            >
              Standalone
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border/40 text-[11px] text-muted-foreground">
            <span>Hover a product to see what it includes</span>
            <span className="flex items-center gap-1.5">
              <span className="w-6 h-0.5 bg-amber-500/60 rounded" /> Composition link
            </span>
          </div>
        </div>
      </div>

      {/* Mobile tree */}
      <div className="md:hidden space-y-1.5">
        <MobileTreeNode productId="fam" depth={0} highlighted={highlighted} isActive={isActive} />
        <MobileTreeNode productId="tiktok" depth={0} highlighted={highlighted} isActive={isActive} />
        <MobileTreeNode productId="pli" depth={0} highlighted={highlighted} isActive={isActive} />
      </div>

      {/* Ideation */}
      <div className="mt-6">
        <div className="flex items-center gap-2 mb-3">
          <Lightbulb className="h-3.5 w-3.5 text-muted-foreground" />
          <h2 className="text-sm font-medium text-muted-foreground">Ideation</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {ideation.map((item) => {
            const Icon = item.icon
            return (
              <span key={item.name} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-border text-xs text-muted-foreground bg-muted/20">
                <Icon className="h-3.5 w-3.5" />
                {item.name}
              </span>
            )
          })}
        </div>
      </div>
    </motion.div>
  )
}

function MobileTreeNode({
  productId,
  depth,
  highlighted,
  isActive,
}: {
  productId: string
  depth: number
  highlighted: Set<string>
  isActive: boolean
}) {
  const product = allProducts.find((p) => p.id === productId)
  if (!product) return null
  const c = colors[product.color]
  const Icon = product.icon
  const hl = !isActive || highlighted.has(product.id)

  return (
    <>
      <div
        className={cn(
          'flex items-center gap-2.5 rounded-lg border px-3.5 py-2.5 transition-all duration-200',
          hl ? c.border : 'border-border/40'
        )}
        style={{
          marginLeft: depth * 24,
          opacity: hl ? 1 : 0.3,
        }}
      >
        <div className={cn('flex h-7 w-7 items-center justify-center rounded-md shrink-0', c.bg)}>
          <Icon className={cn('h-3.5 w-3.5', c.text)} />
        </div>
        <span className="text-xs font-medium">{product.name}</span>
        {product.shortName && (
          <span className="text-[10px] text-muted-foreground">{product.shortName}</span>
        )}
      </div>
      {product.composedOf?.map((childId) => (
        <MobileTreeNode key={childId} productId={childId} depth={depth + 1} highlighted={highlighted} isActive={isActive} />
      ))}
    </>
  )
}

// =============================================================================
// Page
// =============================================================================

export default function ProductsPage() {
  const [view, setView] = useState<ViewType>('cards')

  return (
    <div className="min-h-screen">
      <PageHeader
        title="Product Centre"
        description="Sophie Society service offerings and composable product packages"
      >
        {/* View switcher */}
        <LayoutGroup>
          <div className="flex items-center gap-0.5 p-1 rounded-lg bg-muted/50 border border-border/40">
            {views.map((v) => {
              const Icon = v.icon
              const active = view === v.id
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setView(v.id)}
                  className={cn(
                    'relative px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                    active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {active && (
                    <motion.div
                      layoutId="product-view-tab"
                      className="absolute inset-0 bg-background shadow-sm rounded-md"
                      transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-1.5">
                    <Icon className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{v.label}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </LayoutGroup>
      </PageHeader>

      <div className="p-6 md:p-8">
        <div className={cn(
          view === 'composition' ? 'max-w-5xl' : 'max-w-3xl',
          'mx-auto'
        )}>
          <AnimatePresence mode="wait">
            {view === 'cards' && <CardsView />}
            {view === 'rows' && <RowsView />}
            {view === 'composition' && <CompositionView />}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
