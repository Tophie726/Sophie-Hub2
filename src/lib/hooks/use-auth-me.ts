import { useQuery } from '@tanstack/react-query'

export function useAuthMe() {
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const res = await fetch('/api/auth/me')
      if (!res.ok) return null
      const json = await res.json()
      return json.data
    },
    staleTime: 10 * 60 * 1000,
    gcTime: Infinity,
  })
}
