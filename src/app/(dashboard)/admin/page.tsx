'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/page-header'
import { Database, GraduationCap, Settings, Shield, Package, Blocks } from 'lucide-react'
import { cn } from '@/lib/utils'

const easeOut: [number, number, number, number] = [0.22, 1, 0.36, 1]

interface AdminCardProps {
  title: string
  description: string
  href: string
  icon: React.ReactNode
  iconBg: string
  badge?: string
}

function AdminCard({ title, description, href, icon, iconBg, badge }: AdminCardProps) {
  return (
    <Link href={href}>
      <motion.div
        whileHover={{ y: -4, scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        transition={{ duration: 0.2, ease: easeOut }}
        className="group relative bg-card border rounded-xl p-4 md:p-6 hover:border-primary/30 hover:shadow-lg transition-all cursor-pointer"
      >
        <div className="flex items-start gap-3 md:gap-4">
          <div className={cn(
            'flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-xl transition-transform group-hover:scale-110 shrink-0',
            iconBg
          )}>
            {icon}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">{title}</h3>
              {badge && (
                <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-orange-500/10 text-orange-600">
                  {badge}
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          </div>
        </div>
      </motion.div>
    </Link>
  )
}

export default function AdminPage() {
  return (
    <div className="min-h-screen">
      <PageHeader
        title="Admin"
        description="System configuration and data management"
      />

      <div className="p-4 md:p-8">
        <div className="max-w-3xl mx-auto space-y-3 md:space-y-4">
          <AdminCard
            title="Data Enrichment"
            description="Connect external data sources, map fields to your database, and manage data flow"
            href="/admin/data-enrichment"
            icon={<Database className="h-6 w-6 text-orange-600" />}
            iconBg="bg-orange-500/10"
            badge="Active"
          />

          <AdminCard
            title="Modules"
            description="Reporting dashboards, widgets, and building blocks for partner views"
            href="/admin/modules"
            icon={<Blocks className="h-6 w-6 text-orange-600" />}
            iconBg="bg-orange-500/10"
            badge="New"
          />

          <AdminCard
            title="Product Centre"
            description="Service offerings, composable product packages, and ideation pipeline"
            href="/admin/products"
            icon={<Package className="h-6 w-6 text-purple-600" />}
            iconBg="bg-purple-500/10"
          />

          <AdminCard
            title="Education"
            description="Manage training modules, certifications, and learning paths for staff"
            href="/admin/education"
            icon={<GraduationCap className="h-6 w-6 text-blue-600" />}
            iconBg="bg-blue-500/10"
          />

          <AdminCard
            title="System Settings"
            description="Configure global settings, integrations, and system preferences"
            href="/admin/settings"
            icon={<Settings className="h-6 w-6 text-gray-600" />}
            iconBg="bg-gray-500/10"
          />

          <AdminCard
            title="Access Control"
            description="Manage user roles, permissions, and security settings"
            href="/admin/access"
            icon={<Shield className="h-6 w-6 text-green-600" />}
            iconBg="bg-green-500/10"
          />
        </div>
      </div>
    </div>
  )
}
