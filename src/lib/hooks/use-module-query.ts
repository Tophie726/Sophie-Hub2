import { useQuery } from '@tanstack/react-query'

export function useModuleQuery(slug: string) {
  return useQuery({
    queryKey: ['modules', slug],
    queryFn: async () => {
      const res = await fetch(`/api/modules?slug=${slug}`)
      if (!res.ok) throw new Error('Module not found')
      const json = await res.json()
      const modules = json.data?.modules || json.modules || []
      return modules.find((m: { slug: string }) => m.slug === slug) || null
    },
    enabled: !!slug,
  })
}

export function useDashboardsQuery(moduleId: string) {
  return useQuery({
    queryKey: ['modules', 'dashboards', moduleId],
    queryFn: async () => {
      const res = await fetch(`/api/modules/dashboards?module_id=${moduleId}`)
      if (!res.ok) throw new Error('Failed to fetch dashboards')
      const json = await res.json()
      return json.data?.dashboards || json.dashboards || []
    },
    enabled: !!moduleId,
  })
}
