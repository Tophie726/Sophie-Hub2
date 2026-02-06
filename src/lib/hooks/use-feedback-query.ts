import { useQuery } from '@tanstack/react-query'

interface UseIdeasQueryParams {
  type?: 'bug' | 'feature' | 'question'
  sort?: 'recent' | 'votes'
  mine?: boolean
}

export function useIdeasQuery(params: UseIdeasQueryParams = {}) {
  const { type, sort, mine } = params

  return useQuery({
    queryKey: ['feedback', 'ideas', { type, sort, mine }],
    queryFn: async () => {
      const sp = new URLSearchParams()
      if (type) sp.set('type', type)
      if (sort) sp.set('sort', sort)
      if (mine) sp.set('mine', 'true')

      const res = await fetch(`/api/feedback?${sp}`)
      if (!res.ok) throw new Error('Failed to fetch ideas')
      const json = await res.json()
      return json.data?.feedback || []
    },
  })
}

export function useRoadmapQuery() {
  return useQuery({
    queryKey: ['feedback', 'roadmap'],
    queryFn: async () => {
      const res = await fetch('/api/feedback?roadmap=true&sort=votes')
      if (!res.ok) throw new Error('Failed to fetch roadmap')
      const json = await res.json()
      return json.data?.feedback || []
    },
  })
}

interface UseFeedbackAdminQueryParams {
  type?: 'bug' | 'feature' | 'question' | 'all'
  status?: string
}

export function useFeedbackAdminQuery(params: UseFeedbackAdminQueryParams = {}) {
  const { type, status } = params

  return useQuery({
    queryKey: ['feedback', 'admin', { type, status }],
    queryFn: async () => {
      const sp = new URLSearchParams()
      if (type && type !== 'all') sp.set('type', type)
      if (status && status !== 'all') sp.set('status', status)

      const res = await fetch(`/api/feedback?${sp}`)
      if (!res.ok) throw new Error('Failed to fetch feedback')
      const json = await res.json()
      return json.data?.feedback || []
    },
  })
}
