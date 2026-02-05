/**
 * Navigation configuration with role-based visibility
 *
 * Each section and item can have a requiredRole field.
 * If set, the section/item only shows for users with that role or higher.
 *
 * Role hierarchy: admin > pod_leader > staff > partner
 */

import {
  LayoutDashboard,
  Users,
  Database,
  Building2,
  Package,
  GitPullRequest,
  type LucideIcon,
} from 'lucide-react'
import { type Role, ROLES, isRoleAtLeast } from '@/lib/auth/roles'

export interface NavItem {
  name: string
  href: string
  icon: LucideIcon
  highlight?: boolean
  requiredRole?: Role
}

export interface NavSection {
  title: string
  items: NavItem[]
  requiredRole?: Role
}

/**
 * Main navigation configuration
 * Add requiredRole to sections or items to restrict visibility
 */
export const navigation: NavSection[] = [
  {
    title: 'Overview',
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    ],
  },
  {
    title: 'Core',
    items: [
      { name: 'Partners', href: '/partners', icon: Building2 },
      { name: 'Staff', href: '/staff', icon: Users },
    ],
  },
  {
    title: 'Admin',
    requiredRole: ROLES.ADMIN,
    items: [
      { name: 'Data Enrichment', href: '/admin/data-enrichment', icon: Database, highlight: true },
      { name: 'Change Approval', href: '/admin/change-approval', icon: GitPullRequest },
      { name: 'Products', href: '/admin/products', icon: Package },
    ],
  },
]

/**
 * Filter navigation based on user role
 * Returns only sections and items the user has access to
 */
export function getNavigationForRole(userRole: Role | undefined): NavSection[] {
  return navigation
    .filter(section => {
      // If section has no role requirement, show it
      if (!section.requiredRole) return true
      // Otherwise check if user role is at least the required level
      return isRoleAtLeast(userRole, section.requiredRole)
    })
    .map(section => ({
      ...section,
      // Also filter items within sections
      items: section.items.filter(item => {
        if (!item.requiredRole) return true
        return isRoleAtLeast(userRole, item.requiredRole)
      }),
    }))
    // Remove sections that have no visible items after filtering
    .filter(section => section.items.length > 0)
}
