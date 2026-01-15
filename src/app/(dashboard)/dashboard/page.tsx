'use client'

import { motion } from 'framer-motion'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Building2,
  Users,
  Database,
  TrendingUp,
  ArrowRight,
  Sparkles,
  Clock,
  CheckCircle2,
} from 'lucide-react'
import Link from 'next/link'

const stats = [
  {
    title: 'Partners',
    value: '0',
    description: 'Active clients',
    icon: Building2,
    href: '/partners',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
  },
  {
    title: 'Staff',
    value: '0',
    description: 'Team members',
    icon: Users,
    href: '/staff',
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
  },
  {
    title: 'Data Sources',
    value: '0',
    description: 'Connected',
    icon: Database,
    href: '/admin/data-enrichment',
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
  },
  {
    title: 'Sync Status',
    value: 'Ready',
    description: 'All systems operational',
    icon: TrendingUp,
    href: '/admin/data-enrichment',
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
  },
]

const quickActions = [
  {
    title: 'Start Data Enrichment',
    description: 'Connect your first data source and begin mapping fields',
    icon: Database,
    href: '/admin/data-enrichment',
    primary: true,
  },
  {
    title: 'Add Partners',
    description: 'Manually add partner information or import from sheets',
    icon: Building2,
    href: '/partners',
  },
  {
    title: 'Add Staff',
    description: 'Set up team members and their roles',
    icon: Users,
    href: '/staff',
  },
]

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  },
}

export default function DashboardPage() {
  return (
    <div className="min-h-screen">
      <PageHeader
        title="Dashboard"
        description="Welcome to Sophie Hub v2"
      />

      <div className="p-8">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-8"
        >
          {/* Welcome Banner */}
          <motion.div variants={itemVariants}>
            <Card className="border-none bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 shadow-none">
              <CardContent className="flex items-center gap-6 p-6">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                  <Sparkles className="h-7 w-7" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-semibold">Welcome to Sophie Hub v2</h2>
                  <p className="text-muted-foreground mt-1">
                    Your fresh start with clean data architecture. Let&apos;s begin by connecting your data sources.
                  </p>
                </div>
                <Link href="/admin/data-enrichment">
                  <Button className="gap-2">
                    Get Started
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </motion.div>

          {/* Stats Grid */}
          <motion.div variants={itemVariants}>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {stats.map((stat) => {
                const Icon = stat.icon
                return (
                  <Link key={stat.title} href={stat.href}>
                    <Card className="group relative overflow-hidden transition-all duration-200 hover:shadow-md hover:border-border">
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${stat.bgColor}`}>
                            <Icon className={`h-5 w-5 ${stat.color}`} />
                          </div>
                          <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-1" />
                        </div>
                        <div className="mt-4">
                          <p className="text-2xl font-bold">{stat.value}</p>
                          <p className="text-sm text-muted-foreground">{stat.description}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                )
              })}
            </div>
          </motion.div>

          {/* Quick Actions */}
          <motion.div variants={itemVariants}>
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Quick Actions</h3>
              <div className="grid gap-4 md:grid-cols-3">
                {quickActions.map((action) => {
                  const Icon = action.icon
                  return (
                    <Link key={action.title} href={action.href}>
                      <Card className={`group h-full transition-all duration-200 hover:shadow-md ${action.primary ? 'border-orange-500/50 bg-orange-500/5' : 'hover:border-border'}`}>
                        <CardHeader className="pb-2">
                          <div className="flex items-center gap-3">
                            <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${action.primary ? 'bg-orange-500/10' : 'bg-muted'}`}>
                              <Icon className={`h-4 w-4 ${action.primary ? 'text-orange-500' : 'text-muted-foreground'}`} />
                            </div>
                            {action.primary && (
                              <Badge variant="secondary" className="bg-orange-500/10 text-orange-500 hover:bg-orange-500/20">
                                Recommended
                              </Badge>
                            )}
                          </div>
                          <CardTitle className="text-base mt-3">{action.title}</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <CardDescription>{action.description}</CardDescription>
                        </CardContent>
                      </Card>
                    </Link>
                  )
                })}
              </div>
            </div>
          </motion.div>

          {/* Setup Checklist */}
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  Setup Progress
                </CardTitle>
                <CardDescription>Complete these steps to get started</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { label: 'Database schema created', done: true },
                    { label: 'Connect first data source', done: false },
                    { label: 'Map fields to Partner table', done: false },
                    { label: 'Import partner data', done: false },
                    { label: 'Set up staff records', done: false },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className={`flex h-6 w-6 items-center justify-center rounded-full ${item.done ? 'bg-green-500/10' : 'bg-muted'}`}>
                        {item.done ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <span className="text-xs text-muted-foreground">{i + 1}</span>
                        )}
                      </div>
                      <span className={item.done ? 'text-muted-foreground line-through' : ''}>
                        {item.label}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}
