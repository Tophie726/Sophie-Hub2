import { useQuery } from '@tanstack/react-query'

interface UseStaffQueryParams {
  search?: string
  status?: string[]
  sort?: string
  order?: 'asc' | 'desc'
  limit?: number
  offset?: number
}

export function useStaffDetailQuery(id: string) {
  return useQuery({
    queryKey: ['staff', 'detail', id],
    queryFn: async () => {
      const res = await fetch(`/api/staff/${id}`)
      if (!res.ok) throw new Error('Failed to fetch staff member')
      const json = await res.json()
      return json.data?.staff ?? json.data ?? json
    },
    enabled: !!id,
  })
}

export function useStaffQuery(params: UseStaffQueryParams = {}) {
  const { search, status, sort, order, limit, offset } = params

  return useQuery({
    queryKey: ['staff', { search, status, sort, order, limit, offset }],
    queryFn: async () => {
      const sp = new URLSearchParams()
      if (search) sp.set('search', search)
      if (status?.length) sp.set('status', status.join(','))
      if (sort) sp.set('sort', sort)
      if (order) sp.set('order', order)
      if (limit !== undefined) sp.set('limit', String(limit))
      if (offset !== undefined) sp.set('offset', String(offset))

      const res = await fetch(`/api/staff?${sp}`)
      if (!res.ok) throw new Error('Failed to fetch staff')
      const json = await res.json()
      return json.data
    },
  })
}
