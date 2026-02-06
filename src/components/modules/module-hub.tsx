'use client'

import { useState, useEffect } from 'react'
import { Loader2, Blocks } from 'lucide-react'
import { ModuleCard } from './module-card'
import type { Module } from '@/types/modules'

export function ModuleHub() {
  const [modules, setModules] = useState<Module[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchModules() {
      try {
        const response = await fetch('/api/modules')
        if (!response.ok) {
          throw new Error('Failed to fetch modules')
        }
        const json = await response.json()
        setModules(json.data?.modules || json.modules || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load modules')
      } finally {
        setIsLoading(false)
      }
    }
    fetchModules()
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center px-4">
        <p className="text-sm text-destructive">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-3 text-sm text-primary hover:underline"
        >
          Try again
        </button>
      </div>
    )
  }

  if (modules.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center px-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted mb-4">
          <Blocks className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="font-semibold">No modules yet</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          Modules will appear here once they are configured. Check back soon or contact an administrator.
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
      {modules.map((mod) => (
        <ModuleCard key={mod.id} module={mod} />
      ))}
    </div>
  )
}
