'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import Image from 'next/image'
import {
  Building2, ShieldCheck, LineChart, Calculator, Smartphone, Laptop,
  ArrowLeft, ChevronRight, DollarSign, TrendingUp, Activity, Clock3,
  Handshake, Search, Users, Eye, Package, Heart,
  Dumbbell, Home, PawPrint, Globe, Lock, ArrowRight, Zap,
  CheckCircle2, BarChart3, FileText,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ═══════════════════════════════════════════════════════════════════════════════
// Data
// ═══════════════════════════════════════════════════════════════════════════════

type MarketplaceTab = 'concept' | 'calculator' | 'value'
type PreviewMode = 'web' | 'mobile'

interface Listing {
  id: string
  category: string
  icon: React.ComponentType<{ className?: string }>
  askPrice: number
  ttmRevenue: number
  monthlyProfit: number
  netMargin: number
  monthsActive: number
  asinCount: number
  marketplaces: string[]
  sophieManaged: boolean
  trend: 'up' | 'stable' | 'down'
  tagline: string
  chartData: number[]
}

const listings: Listing[] = [
  {
    id: 'home-kitchen',
    category: 'Home & Kitchen',
    icon: Home,
    askPrice: 1_850_000,
    ttmRevenue: 3_180_000,
    monthlyProfit: 61_000,
    netMargin: 23,
    monthsActive: 46,
    asinCount: 28,
    marketplaces: ['Amazon US', 'Shopify', 'Walmart'],
    sophieManaged: true,
    trend: 'up',
    tagline: 'Established brand with strong repeat purchase rate and growing DTC channel.',
    chartData: [24, 38, 32, 40, 45, 42, 48, 52, 58, 55, 61, 67],
  },
  {
    id: 'pet-supplies',
    category: 'Pet Supplies',
    icon: PawPrint,
    askPrice: 940_000,
    ttmRevenue: 1_790_000,
    monthlyProfit: 33_000,
    netMargin: 19,
    monthsActive: 30,
    asinCount: 14,
    marketplaces: ['Amazon US', 'Chewy'],
    sophieManaged: false,
    trend: 'stable',
    tagline: 'Niche pet wellness brand with loyal subscription base and clean supply chain.',
    chartData: [30, 32, 35, 33, 36, 34, 38, 35, 37, 36, 38, 40],
  },
  {
    id: 'health-wellness',
    category: 'Health & Wellness',
    icon: Heart,
    askPrice: 2_400_000,
    ttmRevenue: 4_250_000,
    monthlyProfit: 82_000,
    netMargin: 26,
    monthsActive: 58,
    asinCount: 42,
    marketplaces: ['Amazon US', 'Amazon UK', 'Amazon DE'],
    sophieManaged: true,
    trend: 'up',
    tagline: 'Multi-marketplace supplements brand with clinical positioning and strong margins.',
    chartData: [45, 48, 52, 50, 56, 58, 62, 65, 70, 68, 75, 82],
  },
  {
    id: 'sports-outdoors',
    category: 'Sports & Outdoors',
    icon: Dumbbell,
    askPrice: 680_000,
    ttmRevenue: 1_320_000,
    monthlyProfit: 24_000,
    netMargin: 17,
    monthsActive: 22,
    asinCount: 9,
    marketplaces: ['Amazon US'],
    sophieManaged: false,
    trend: 'up',
    tagline: 'Fast-growing fitness accessories line with viral social proof and lean operations.',
    chartData: [15, 18, 22, 28, 32, 35, 30, 38, 42, 45, 50, 55],
  },
]

const managedTeam = [
  { name: 'Matthias', role: 'PPC Lead', initials: 'MA', color: 'bg-blue-500/15 text-blue-600 dark:text-blue-400' },
  { name: 'Owen', role: 'Creative Director', initials: 'OW', color: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
  { name: 'Kirol', role: 'Graphic Designer', initials: 'KI', color: 'bg-orange-500/15 text-orange-600 dark:text-orange-400' },
  { name: 'Asif', role: 'Catalogue Manager', initials: 'AS', color: 'bg-purple-500/15 text-purple-600 dark:text-purple-400' },
]

const MIN_MULTIPLE = 20
const MAX_MULTIPLE = 45
const DEFAULT_MULTIPLE = 32

const easeOut: [number, number, number, number] = [0.22, 1, 0.36, 1]

const fullUsd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const compactUsd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 })

function fmt(v: number) { return fullUsd.format(v) }
function fmtC(v: number) { return compactUsd.format(v) }

function calcCommission(val: number): number {
  if (val <= 66666.66) return 10000
  if (val <= 700000) return val * 0.15
  const first = 700000 * 0.15
  if (val <= 5000000) return first + (val - 700000) * 0.08
  return first + (5000000 - 700000) * 0.08 + (val - 5000000) * 0.025
}

const marketplaceFlags: Record<string, string> = {
  'Amazon US': '\u{1F1FA}\u{1F1F8}',
  'Amazon UK': '\u{1F1EC}\u{1F1E7}',
  'Amazon DE': '\u{1F1E9}\u{1F1EA}',
  'Amazon FR': '\u{1F1EB}\u{1F1F7}',
  'Amazon IT': '\u{1F1EE}\u{1F1F9}',
  'Amazon ES': '\u{1F1EA}\u{1F1F8}',
  'Amazon CA': '\u{1F1E8}\u{1F1E6}',
  'Amazon JP': '\u{1F1EF}\u{1F1F5}',
  'Amazon AU': '\u{1F1E6}\u{1F1FA}',
  'Amazon MX': '\u{1F1F2}\u{1F1FD}',
  'Amazon IN': '\u{1F1EE}\u{1F1F3}',
}

// ═══════════════════════════════════════════════════════════════════════════════
// Web Preview — the hero experience
// ═══════════════════════════════════════════════════════════════════════════════

function WebPreview() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = listings.find(l => l.id === selectedId) ?? null
  const path = selected ? `/listings/${selected.id}` : '/listings'

  return (
    <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
      {/* Browser chrome */}
      <div className="h-9 border-b border-border/50 bg-muted/20 px-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
        </div>
        <div className="flex-1 mx-4">
          <div className="mx-auto max-w-sm h-5 rounded-md bg-muted/40 flex items-center justify-center px-2">
            <Lock className="h-2.5 w-2.5 text-emerald-500 mr-1 shrink-0" />
            <span className="text-[10px] text-muted-foreground truncate">sophiemarketplace.com{path}</span>
          </div>
        </div>
        <div className="w-[52px]" />
      </div>

      {/* Site content */}
      <div className="h-[580px] overflow-y-auto">
        {/* Sticky site nav */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/50">
          <div className="px-4 md:px-5 py-2.5 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              <Image
                src="/brand-icons/sophie-society-logo.svg"
                alt="Sophie Society"
                width={120}
                height={28}
                className="h-6 w-auto dark:brightness-0 dark:invert"
                draggable={false}
              />
            </button>
            <div className="flex items-center gap-2">
              <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-muted/30 border border-border/40">
                <Search className="h-3 w-3 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground w-20">Search&hellip;</span>
              </div>
              <Button size="sm" className="h-7 text-[10px] px-3 bg-primary hover:bg-primary/90 text-primary-foreground">
                List Your Business
              </Button>
            </div>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {!selected ? (
            <motion.div
              key="homepage"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2, ease: easeOut }}
            >
              {/* Hero */}
              <div className="relative overflow-hidden bg-gradient-to-br from-orange-500/10 via-orange-500/5 to-transparent border-b border-border/40">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-orange-400/10 via-transparent to-transparent" />
                <div className="relative px-5 py-8 md:py-10">
                  <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 border-0 text-[10px] mb-3">
                    Amazon-First Brokerage
                  </Badge>
                  <h2 className="text-xl md:text-2xl font-bold tracking-tight text-balance leading-tight">
                    Buy and sell Amazon brands<br className="hidden md:block" /> with operator-grade diligence
                  </h2>
                  <p className="text-xs text-muted-foreground mt-2.5 max-w-md leading-relaxed">
                    Every listing includes verified financials, operational assessment, and transition planning from the team that manages the brands.
                  </p>
                </div>
              </div>

              {/* Stats ribbon */}
              <div className="flex items-center justify-center gap-6 py-3 border-b border-border/40 bg-muted/10">
                <div className="flex items-center gap-1.5 text-[10px]">
                  <Package className="h-3 w-3 text-orange-500" />
                  <span className="font-semibold tabular-nums">{listings.length}</span>
                  <span className="text-muted-foreground">Active</span>
                </div>
                <div className="h-3 w-px bg-border/60" />
                <div className="flex items-center gap-1.5 text-[10px]">
                  <DollarSign className="h-3 w-3 text-emerald-500" />
                  <span className="font-semibold tabular-nums">{fmtC(listings.reduce((s, l) => s + l.askPrice, 0))}</span>
                  <span className="text-muted-foreground">Total Value</span>
                </div>
                <div className="h-3 w-px bg-border/60" />
                <div className="flex items-center gap-1.5 text-[10px]">
                  <ShieldCheck className="h-3 w-3 text-blue-500" />
                  <span className="font-semibold">Verified</span>
                  <span className="text-muted-foreground">Diligence</span>
                </div>
              </div>

              {/* Listings */}
              <div className="p-4 md:p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Featured Opportunities</h3>
                  <span className="text-[10px] text-muted-foreground">Brand identity gated until NDA</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {listings.map((listing) => {
                    const Icon = listing.icon
                    return (
                      <button
                        key={listing.id}
                        type="button"
                        onClick={() => setSelectedId(listing.id)}
                        className="group text-left rounded-xl border border-border/60 bg-background p-4 hover:border-orange-500/40 hover:shadow-md transition-all duration-200"
                      >
                        <div className="flex items-start justify-between gap-2 mb-2.5">
                          <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0">
                              <Icon className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold">{listing.category}</p>
                              <p className="text-[10px] text-muted-foreground">{listing.asinCount} ASINs · {listing.monthsActive}mo track record</p>
                            </div>
                          </div>
                          <Badge variant={listing.sophieManaged ? 'default' : 'secondary'} className="text-[9px] shrink-0">
                            {listing.sophieManaged ? 'Sophie Managed' : 'External'}
                          </Badge>
                        </div>

                        <p className="text-[11px] text-muted-foreground line-clamp-2 mb-3">{listing.tagline}</p>

                        <div className="flex items-center gap-2 mb-3">
                          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400">
                            <ShieldCheck className="h-3 w-3" />
                            Diligence Verified
                          </span>
                          {listing.sophieManaged && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400">
                              <Users className="h-3 w-3" />
                              Team Continuity
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between pt-2.5 border-t border-border/40">
                          <div className="flex items-center gap-3">
                            <div>
                              <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Asking</p>
                              <p className="text-sm font-bold tabular-nums">{fmtC(listing.askPrice)}</p>
                            </div>
                            <div className="h-6 w-px bg-border/60" />
                            <div>
                              <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Profit/mo</p>
                              <p className="text-xs font-medium tabular-nums">{fmtC(listing.monthlyProfit)}</p>
                            </div>
                          </div>
                          <span className="text-[10px] text-orange-600 dark:text-orange-400 font-medium flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            View <ArrowRight className="h-3 w-3" />
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>

                {/* Trust footer */}
                <div className="flex items-center justify-center gap-4 py-3 text-[10px] text-muted-foreground/60">
                  <span className="flex items-center gap-1"><Lock className="h-3 w-3" /> NDA Protected</span>
                  <span className="text-border">·</span>
                  <span className="flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> Verified Financials</span>
                  <span className="text-border">·</span>
                  <span className="flex items-center gap-1"><Users className="h-3 w-3" /> Sophie Society</span>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key={selected.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, ease: easeOut }}
              className="p-4 md:p-5 space-y-4"
            >
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to listings
              </button>

              {/* Listing header */}
              <div className="rounded-xl border border-border/60 bg-gradient-to-r from-orange-500/10 to-transparent p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-orange-500/15 flex items-center justify-center">
                      {(() => { const Icon = selected.icon; return <Icon className="h-5 w-5 text-orange-600 dark:text-orange-400" /> })()}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold">{selected.category}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">{selected.tagline}</p>
                    </div>
                  </div>
                  <Badge variant={selected.sophieManaged ? 'default' : 'secondary'} className="text-[10px] shrink-0">
                    {selected.sophieManaged ? 'Managed by Sophie' : 'External Seller'}
                  </Badge>
                </div>
                <div className="flex items-baseline gap-1.5 mt-4">
                  <span className="text-2xl font-bold tabular-nums">{fmt(selected.askPrice)}</span>
                  <span className="text-xs text-muted-foreground">asking price</span>
                </div>
              </div>

              {/* KPI Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
                {[
                  { label: 'TTM Revenue', value: fmtC(selected.ttmRevenue), icon: BarChart3, color: 'text-blue-500' },
                  { label: 'Monthly Profit', value: fmtC(selected.monthlyProfit), icon: TrendingUp, color: 'text-emerald-500' },
                  { label: 'Net Margin', value: `${selected.netMargin}%`, icon: Activity, color: 'text-orange-500' },
                  { label: 'Active', value: `${selected.monthsActive} months`, icon: Clock3, color: 'text-amber-500' },
                  { label: 'Product Lines', value: `${selected.asinCount} ASINs`, icon: Package, color: 'text-pink-500' },
                  { label: 'Trend', value: selected.trend === 'up' ? 'Growing' : selected.trend === 'stable' ? 'Stable' : 'Declining', icon: TrendingUp, color: selected.trend === 'up' ? 'text-emerald-500' : 'text-amber-500' },
                ].map((kpi) => (
                  <div key={kpi.label} className="rounded-lg border border-border/50 bg-background p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <kpi.icon className={cn('h-3 w-3', kpi.color)} />
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{kpi.label}</span>
                    </div>
                    <p className="text-sm font-semibold tabular-nums">{kpi.value}</p>
                  </div>
                ))}
              </div>

              {/* Revenue chart */}
              <div className="rounded-xl border border-border/60 bg-background p-4">
                <div className="flex items-center gap-2 mb-3">
                  <LineChart className="h-4 w-4 text-muted-foreground" />
                  <p className="text-xs font-semibold">Revenue Trend (12 months)</p>
                </div>
                <div className="flex items-end gap-1.5 h-16">
                  {selected.chartData.map((val, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-sm bg-orange-500/60 hover:bg-orange-500/80 transition-colors"
                      style={{ height: `${(val / Math.max(...selected.chartData)) * 100}%` }}
                    />
                  ))}
                </div>
                <div className="flex justify-between mt-1.5">
                  <span className="text-[9px] text-muted-foreground">12mo ago</span>
                  <span className="text-[9px] text-muted-foreground">Current</span>
                </div>
              </div>

              {/* Marketplace presence */}
              <div className="rounded-xl border border-border/60 bg-background p-4">
                <p className="text-xs font-semibold mb-2.5">Marketplace Presence</p>
                <div className="flex flex-wrap gap-2">
                  {selected.marketplaces.map((m) => (
                    <span key={m} className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-muted/20 px-3 py-1.5 text-[11px]">
                      {marketplaceFlags[m] ? (
                        <span className="text-sm leading-none">{marketplaceFlags[m]}</span>
                      ) : (
                        <Globe className="h-3 w-3 text-muted-foreground" />
                      )}
                      {m}
                    </span>
                  ))}
                </div>
              </div>

              {/* Team section */}
              {selected.sophieManaged && (
                <div className="rounded-xl border border-border/60 bg-background p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <ShieldCheck className="h-4 w-4 text-emerald-500" />
                    <p className="text-xs font-semibold">Sophie Managed Team</p>
                    <Badge variant="outline" className="text-[9px] ml-auto">Continuity Available</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {managedTeam.map((m) => (
                      <div key={m.name} className="flex items-center gap-2.5 rounded-lg border border-border/50 p-2.5">
                        <Avatar className="h-7 w-7">
                          <AvatarFallback className={cn('text-[10px] font-bold', m.color)}>{m.initials}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-[11px] font-medium">{m.name}</p>
                          <p className="text-[10px] text-muted-foreground">{m.role}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Due diligence */}
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">Diligence Report Available</p>
                </div>
                <div className="grid grid-cols-3 gap-2 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1"><Zap className="h-3 w-3" /> Growth opportunities</span>
                  <span className="flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> Risk assessment</span>
                  <span className="flex items-center gap-1"><ArrowRight className="h-3 w-3" /> 90-day transition</span>
                </div>
              </div>

              {/* CTA */}
              <div className="flex items-center gap-3">
                <Button className="flex-1 h-9 bg-primary hover:bg-primary/90 text-primary-foreground text-xs">
                  <Lock className="h-3 w-3 mr-1.5" />
                  Request NDA & Full Profile
                </Button>
                <Button variant="outline" size="sm" className="h-9 text-xs">
                  <Calculator className="h-3 w-3 mr-1.5" />
                  Estimate Value
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Mobile Preview
// ═══════════════════════════════════════════════════════════════════════════════

function MobilePreview() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = listings.find(l => l.id === selectedId) ?? null

  return (
    <div className="flex justify-center py-4">
      <div className="w-[320px] rounded-[32px] border-2 border-border/70 bg-background p-2 shadow-xl">
        <div className="rounded-[24px] border border-border/50 bg-card overflow-hidden">
          {/* Notch */}
          <div className="h-6 flex items-center justify-center bg-muted/20 border-b border-border/40">
            <span className="h-1 w-14 rounded-full bg-muted-foreground/30" />
          </div>

          {/* Phone nav */}
          <div className="px-3 py-2 flex items-center justify-between border-b border-border/40 bg-background/95">
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="flex items-center gap-1.5"
            >
              <Image
                src="/brand-icons/sophie-society-logo.svg"
                alt="Sophie Society"
                width={80}
                height={20}
                className="h-4 w-auto dark:brightness-0 dark:invert"
                draggable={false}
              />
            </button>
            <Button size="sm" className="h-5 text-[8px] px-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md">
              List Business
            </Button>
          </div>

          {/* Content */}
          <div className="h-[480px] overflow-y-auto">
            <AnimatePresence mode="wait">
              {!selected ? (
                <motion.div
                  key="mobile-home"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.15, ease: easeOut }}
                  className="p-3 space-y-2.5"
                >
                  {/* Hero */}
                  <div className="rounded-lg bg-gradient-to-br from-orange-500/15 via-orange-500/5 to-transparent p-3">
                    <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 border-0 text-[8px] mb-1.5">
                      Amazon-First Brokerage
                    </Badge>
                    <h3 className="text-sm font-bold leading-tight">Buy and sell Amazon brands with confidence</h3>
                    <p className="text-[10px] text-muted-foreground mt-1">Verified financials and transition support included.</p>
                  </div>

                  {/* Listings */}
                  {listings.map((listing) => {
                    const Icon = listing.icon
                    return (
                      <button
                        key={listing.id}
                        type="button"
                        onClick={() => setSelectedId(listing.id)}
                        className="w-full text-left rounded-lg border border-border/60 p-3 hover:bg-muted/20 transition-colors active:scale-[0.98]"
                      >
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded-md bg-orange-500/10 flex items-center justify-center shrink-0">
                              <Icon className="h-3 w-3 text-orange-600 dark:text-orange-400" />
                            </div>
                            <p className="text-[11px] font-semibold">{listing.category}</p>
                          </div>
                          <Badge variant={listing.sophieManaged ? 'default' : 'secondary'} className="text-[8px]">
                            {listing.sophieManaged ? 'Managed' : 'External'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1.5 mb-1.5">
                          <span className="inline-flex items-center gap-0.5 text-[9px] text-emerald-600 dark:text-emerald-400">
                            <ShieldCheck className="h-2.5 w-2.5" />
                            Verified
                          </span>
                          {listing.sophieManaged && (
                            <span className="inline-flex items-center gap-0.5 text-[9px] text-blue-600 dark:text-blue-400">
                              <Users className="h-2.5 w-2.5" />
                              Team
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <p className="text-[10px] text-muted-foreground">
                            Asking <span className="font-semibold text-foreground tabular-nums">{fmtC(listing.askPrice)}</span>
                          </p>
                          <span className="text-[9px] text-orange-600 dark:text-orange-400 font-medium flex items-center gap-0.5">
                            View <ArrowRight className="h-2.5 w-2.5" />
                          </span>
                        </div>
                      </button>
                    )
                  })}

                </motion.div>
              ) : (
                <motion.div
                  key={`mobile-${selected.id}`}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15, ease: easeOut }}
                  className="p-3 space-y-2.5"
                >
                  <button
                    type="button"
                    onClick={() => setSelectedId(null)}
                    className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ArrowLeft className="h-3 w-3" /> Back
                  </button>

                  <div className="rounded-lg bg-gradient-to-r from-orange-500/10 to-transparent p-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold">{selected.category}</h4>
                      <Badge variant={selected.sophieManaged ? 'default' : 'secondary'} className="text-[8px]">
                        {selected.sophieManaged ? 'Managed' : 'External'}
                      </Badge>
                    </div>
                    <p className="text-lg font-bold tabular-nums mt-1">{fmt(selected.askPrice)}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { l: 'TTM Revenue', v: fmtC(selected.ttmRevenue) },
                      { l: 'Profit/mo', v: fmtC(selected.monthlyProfit) },
                      { l: 'Margin', v: `${selected.netMargin}%` },
                      { l: 'Active', v: `${selected.monthsActive}mo` },
                    ].map((k) => (
                      <div key={k.l} className="rounded-md border border-border/50 px-2.5 py-1.5">
                        <p className="text-[9px] text-muted-foreground">{k.l}</p>
                        <p className="text-[11px] font-semibold tabular-nums">{k.v}</p>
                      </div>
                    ))}
                  </div>

                  {/* Chart */}
                  <div className="rounded-lg border border-border/50 p-2.5">
                    <p className="text-[10px] font-medium mb-1.5">Revenue (12mo)</p>
                    <div className="flex items-end gap-1 h-10">
                      {selected.chartData.map((v, i) => (
                        <div key={i} className="flex-1 rounded-sm bg-orange-500/50" style={{ height: `${(v / Math.max(...selected.chartData)) * 100}%` }} />
                      ))}
                    </div>
                  </div>

                  {/* Marketplaces */}
                  <div className="flex flex-wrap gap-1.5">
                    {selected.marketplaces.map((m) => (
                      <span key={m} className="inline-flex items-center gap-1 rounded-md border border-border/50 bg-muted/20 px-2 py-1 text-[9px]">
                        {marketplaceFlags[m] ? (
                          <span className="text-xs leading-none">{marketplaceFlags[m]}</span>
                        ) : (
                          <Globe className="h-2.5 w-2.5" />
                        )}
                        {m}
                      </span>
                    ))}
                  </div>

                  {selected.sophieManaged && (
                    <div className="rounded-lg border border-border/50 p-2.5">
                      <p className="text-[10px] font-medium mb-1.5">Managed Team</p>
                      <div className="space-y-1">
                        {managedTeam.map((m) => (
                          <div key={m.name} className="flex items-center justify-between text-[10px]">
                            <span className="font-medium">{m.name}</span>
                            <span className="text-muted-foreground">{m.role}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-2.5">
                    <p className="text-[10px] font-medium text-emerald-700 dark:text-emerald-300">Diligence report included</p>
                    <p className="text-[9px] text-muted-foreground mt-0.5">Growth analysis, risk flags, and transition plan.</p>
                  </div>

                  <Button className="w-full h-8 text-[10px] bg-primary hover:bg-primary/90 text-primary-foreground">
                    <Lock className="h-3 w-3 mr-1" /> Request Full Profile
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Home indicator */}
          <div className="h-5 flex items-center justify-center">
            <span className="h-1 w-24 rounded-full bg-muted-foreground/20" />
          </div>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Calculator Tab
// ═══════════════════════════════════════════════════════════════════════════════

function EditableAmount({
  value,
  onChange,
  prefix = '$',
}: {
  value: number
  onChange: (v: number) => void
  prefix?: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  function commit() {
    const raw = draft.replace(/[^0-9.]/g, '')
    const parsed = parseFloat(raw)
    if (!isNaN(parsed) && parsed >= 0) onChange(Math.round(parsed))
    setEditing(false)
  }

  if (editing) {
    return (
      <form
        onSubmit={(e) => { e.preventDefault(); commit() }}
        className="inline-flex"
      >
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          className="w-36 bg-muted/30 border border-orange-500/40 rounded-md px-2 py-0.5 text-lg font-bold tabular-nums text-right outline-none focus:ring-2 focus:ring-orange-500/30"
          style={{ fontSize: '1.125rem' }}
        />
      </form>
    )
  }

  return (
    <button
      type="button"
      onClick={() => { setDraft(value.toString()); setEditing(true) }}
      className="font-bold tabular-nums text-lg hover:text-orange-600 dark:hover:text-orange-400 transition-colors cursor-text border-b border-dashed border-muted-foreground/30 hover:border-orange-500/50"
      title="Click to type a custom value"
    >
      {prefix}{value.toLocaleString('en-US')}
    </button>
  )
}

function CalculatorTab() {
  const [monthlyProfit, setMonthlyProfit] = useState(25000)
  const [multiple, setMultiple] = useState(DEFAULT_MULTIPLE)

  const sliderMax = 200000
  const sliderProfit = Math.min(monthlyProfit, sliderMax)
  const isAboveSlider = monthlyProfit > sliderMax

  const low = monthlyProfit * MIN_MULTIPLE
  const high = monthlyProfit * MAX_MULTIPLE
  const valuation = monthlyProfit * multiple
  const commission = calcCommission(valuation)
  const proceeds = Math.max(valuation - commission, 0)
  const effectiveRate = valuation > 0 ? (commission / valuation) * 100 : 0

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/60 bg-card p-5">
        <div className="flex items-center gap-2 mb-5">
          <Calculator className="h-4 w-4 text-amber-500" />
          <h4 className="text-base font-semibold">Valuation Calculator</h4>
        </div>

        <div className="space-y-5">
          <div>
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-muted-foreground">Monthly Net Profit</span>
              <EditableAmount value={monthlyProfit} onChange={(v) => setMonthlyProfit(Math.max(v, 0))} />
            </div>
            <input
              type="range"
              min={1000}
              max={sliderMax}
              step={500}
              value={sliderProfit}
              onChange={(e) => setMonthlyProfit(Number(e.target.value))}
              className="w-full accent-orange-500 h-2"
              aria-label="Monthly net profit"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
              <span>$1K</span>
              <div className="flex items-center gap-1.5">
                {isAboveSlider && (
                  <span className="text-orange-600 dark:text-orange-400 font-medium">Custom: {fmtC(monthlyProfit)}</span>
                )}
                <span>${(sliderMax / 1000).toFixed(0)}K</span>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-muted-foreground">Multiple</span>
              <span className="font-bold tabular-nums text-lg">{multiple}x</span>
            </div>
            <input
              type="range"
              min={MIN_MULTIPLE}
              max={MAX_MULTIPLE}
              step={1}
              value={multiple}
              onChange={(e) => setMultiple(Number(e.target.value))}
              className="w-full accent-orange-500 h-2"
              aria-label="Valuation multiple"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
              <span>{MIN_MULTIPLE}x</span>
              <span>{MAX_MULTIPLE}x</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border/60 bg-card p-4">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Valuation Range</p>
          <p className="text-sm font-semibold tabular-nums">{fmtC(low)} &ndash; {fmtC(high)}</p>
        </div>
        <div className="rounded-xl border border-orange-500/30 bg-orange-500/5 p-4">
          <p className="text-[10px] text-orange-600 dark:text-orange-400 uppercase tracking-wider mb-1">Selected Valuation</p>
          <p className="text-lg font-bold tabular-nums">{fmt(valuation)}</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-4">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Est. Commission</p>
          <p className="text-sm font-semibold tabular-nums">{fmt(commission)}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Effective rate: {effectiveRate.toFixed(1)}%</p>
        </div>
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
          <p className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1">Seller Proceeds</p>
          <p className="text-lg font-bold tabular-nums text-emerald-700 dark:text-emerald-300">{fmt(proceeds)}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Before legal & tax</p>
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-muted/10 p-4">
        <p className="text-xs font-semibold mb-2.5">Commission Schedule</p>
        <div className="space-y-2">
          {[
            { range: '$0 \u2013 $66,667', rate: 'Fixed $10,000 minimum' },
            { range: '$66,667 \u2013 $700K', rate: '15% on total sale value' },
            { range: '$700K \u2013 $5M', rate: '15% on first $700K, then 8%' },
            { range: 'Above $5M', rate: '2.5% on amount above $5M' },
          ].map((tier) => (
            <div key={tier.range} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{tier.range}</span>
              <span className="font-medium">{tier.rate}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Value Proposition Tab
// ═══════════════════════════════════════════════════════════════════════════════

function ValuePropositionTab() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border/60 bg-card p-5">
          <h4 className="text-sm font-semibold mb-4">Core Differentiators</h4>
          <div className="space-y-3">
            {[
              { icon: ShieldCheck, color: 'text-emerald-500', title: 'Operator-grade diligence', desc: 'Sophie-reviewed opportunity and risk report before buyer introductions.' },
              { icon: Eye, color: 'text-orange-500', title: 'Managed-account insight', desc: 'See if the brand is actively managed with team continuity options.' },
              { icon: Clock3, color: 'text-amber-500', title: 'Post-close transition', desc: 'Structured 90-day handoff and optional ongoing growth management.' },
              { icon: Handshake, color: 'text-blue-500', title: 'Agency partner channel', desc: 'Approved agencies can list through the same platform standards.' },
            ].map((d) => (
              <div key={d.title} className="flex gap-3">
                <d.icon className={cn('h-4 w-4 mt-0.5 shrink-0', d.color)} />
                <div>
                  <p className="text-xs font-medium">{d.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{d.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border/60 bg-card p-5">
          <h4 className="text-sm font-semibold mb-4">Buyer Experience</h4>
          <div className="space-y-2.5">
            {[
              { icon: Lock, text: 'Category-first listings with brand identity gated until NDA' },
              { icon: BarChart3, text: '12\u201324 month sales history and margin trends at a glance' },
              { icon: LineChart, text: 'KPI blocks focused on acquisition signals, not vanity metrics' },
              { icon: Building2, text: 'Built for independent buyers and enterprise aggregators' },
              { icon: Globe, text: 'Multi-marketplace visibility across Amazon, Shopify, and DTC' },
            ].map((item) => (
              <p key={item.text} className="flex items-start gap-2.5 text-xs text-muted-foreground">
                <item.icon className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                {item.text}
              </p>
            ))}
          </div>
        </div>
      </div>

      {/* Agency Partner Section */}
      <div className="rounded-xl border border-orange-500/20 bg-gradient-to-r from-orange-500/5 to-transparent p-5">
        <div className="flex items-center gap-2 mb-3">
          <Handshake className="h-5 w-5 text-orange-500" />
          <h4 className="text-sm font-semibold">Featuring: Agency Partner Listings</h4>
          <Badge variant="outline" className="text-[10px] border-orange-500/30 text-orange-600 dark:text-orange-400 ml-auto">Roadmap</Badge>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Registered agency partners will be able to list businesses through Sophie Marketplace while meeting platform review standards.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { icon: DollarSign, color: 'text-emerald-500', title: 'Partner Economics', desc: 'Agency partner keeps the majority share (50%+) of applicable brokerage economics.' },
            { icon: FileText, color: 'text-blue-500', title: 'Platform Standards', desc: 'Listings must include a structured data pack aligned with Sophie disclosure requirements.' },
            { icon: ShieldCheck, color: 'text-orange-500', title: 'Diligence Options', desc: 'Partner can submit own diligence evidence or purchase Sophie due diligence services.' },
          ].map((item) => (
            <div key={item.title} className="rounded-lg bg-background/80 border border-border/40 p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <item.icon className={cn('h-3.5 w-3.5', item.color)} />
                <p className="text-xs font-medium">{item.title}</p>
              </div>
              <p className="text-[11px] text-muted-foreground">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-card p-5">
        <h4 className="text-sm font-semibold mb-2">Concept Summary</h4>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Sophie Marketplace positions Sophie Society as both broker and operator partner. Buyers get better underwriting context,
          sellers get valuation guidance and a smoother transition path, and Sophie can continue supporting growth after close.
        </p>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Export — Trigger Card + Dialog Shell
// ═══════════════════════════════════════════════════════════════════════════════

export function SophieMarketplaceConceptCard() {
  const [tab, setTab] = useState<MarketplaceTab>('concept')
  const [preview, setPreview] = useState<PreviewMode>('web')

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="group text-left rounded-xl border border-border/60 bg-card hover:shadow-lg transition-all duration-200 overflow-hidden"
        >
          <div className="h-1 bg-gradient-to-r from-orange-500 to-transparent" />
          <div className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-500/10">
                  <Building2 className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-[15px] font-semibold leading-tight">Sophie Marketplace</h3>
                    <Badge variant="secondary" className="text-[10px]">Concept</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    Amazon-focused brokerage concept with operator-grade diligence and transition support.
                  </p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground/60 group-hover:text-muted-foreground transition-colors" />
            </div>

            <div className="flex flex-wrap gap-1.5 mt-4 mb-4">
              <Badge variant="outline" className="text-[10px]">Consumer marketplace</Badge>
              <Badge variant="outline" className="text-[10px]">Due diligence</Badge>
              <Badge variant="outline" className="text-[10px]">Seller valuation</Badge>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground pt-3 border-t border-border/40">
              <Laptop className="h-3.5 w-3.5" />
              <Smartphone className="h-3.5 w-3.5" />
              Click to open concept preview
            </div>
          </div>
        </button>
      </DialogTrigger>

      <DialogContent className="max-w-[95vw] md:max-w-[980px] max-h-[90vh] overflow-y-auto p-0 gap-0">
        <DialogHeader className="px-5 md:px-6 py-4 md:py-5 border-b border-border/60 bg-muted/10">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="secondary" className="text-[10px]">Placeholder</Badge>
            <Badge variant="outline" className="text-[10px]">UI/UX Exploration</Badge>
          </div>
          <DialogTitle className="text-xl">Sophie Marketplace</DialogTitle>
          <DialogDescription className="text-sm max-w-2xl">
            Non-functional concept preview for an Amazon-focused brokerage where buyers review business opportunities with
            managed-account context, diligence signals, and transition support.
          </DialogDescription>
        </DialogHeader>

        <div className="px-5 md:px-6 py-5 md:py-6 space-y-4">
          {/* Tabs */}
          <div className="flex items-center gap-1 p-1 rounded-lg border border-border/50 bg-muted/30 w-fit">
            {([
              { id: 'concept' as const, label: 'Concept' },
              { id: 'calculator' as const, label: 'Calculator' },
              { id: 'value' as const, label: 'Value Proposition' },
            ]).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-md transition-colors active:scale-[0.97]',
                  tab === t.id ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'concept' ? (
            <div className="space-y-4">
              <div className="flex items-center gap-1 p-1 rounded-lg border border-border/50 bg-muted/20 w-fit">
                {([
                  { id: 'web' as const, label: 'Web', icon: Laptop },
                  { id: 'mobile' as const, label: 'Mobile', icon: Smartphone },
                ]).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPreview(p.id)}
                    className={cn(
                      'px-2.5 py-1.5 text-[11px] font-medium rounded-md transition-colors active:scale-[0.97] inline-flex items-center gap-1.5',
                      preview === p.id ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <p.icon className="h-3.5 w-3.5" />
                    {p.label}
                  </button>
                ))}
              </div>

              {preview === 'web' ? <WebPreview /> : <MobilePreview />}
            </div>
          ) : tab === 'calculator' ? (
            <CalculatorTab />
          ) : (
            <ValuePropositionTab />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
