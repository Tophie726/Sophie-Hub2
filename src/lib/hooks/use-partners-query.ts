import { useQuery } from '@tanstack/react-query'

interface UsePartnersQueryParams {
  search?: string
  status?: string[]
  sort?: string
  order?: 'asc' | 'desc'
  limit?: number
  offset?: number
}

export function usePartnerDetailQuery(id: string) {
  return useQuery({
    queryKey: ['partners', 'detail', id],
    queryFn: async () => {
      const res = await fetch(`/api/partners/${id}`)
      if (!res.ok) throw new Error('Failed to fetch partner')
      const json = await res.json()
      return json.data?.partner ?? json.data ?? json
    },
    enabled: !!id,
  })
}

export function usePartnersQuery(params: UsePartnersQueryParams = {}) {
  const { search, status, sort, order, limit, offset } = params

  return useQuery({
    queryKey: ['partners', { search, status, sort, order, limit, offset }],
    queryFn: async () => {
      const sp = new URLSearchParams()
      if (search) sp.set('search', search)
      if (status?.length) sp.set('status', status.join(','))
      if (sort) sp.set('sort', sort)
      if (order) sp.set('order', order)
      if (limit !== undefined) sp.set('limit', String(limit))
      if (offset !== undefined) sp.set('offset', String(offset))

      const res = await fetch(`/api/partners?${sp}`)
      if (!res.ok) throw new Error('Failed to fetch partners')
      const json = await res.json()
      return json.data
    },
  })
}
