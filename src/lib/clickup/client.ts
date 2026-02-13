/**
 * ClickUp API Client
 *
 * Lightweight server-side client for task comments and task status snapshots.
 * Uses personal/workspace API token via CLICKUP_API_TOKEN.
 */

import { createLogger } from '@/lib/logger'

const log = createLogger('clickup-client')

const CLICKUP_API_BASE = 'https://api.clickup.com/api/v2'

export interface ClickUpTaskSummary {
  id: string
  name: string
  status: string
  url: string | null
}

interface ClickUpTaskResponse {
  id: string
  name: string
  url?: string
  status?: {
    status?: string
  }
}

function getClickUpToken(): string {
  const token = process.env.CLICKUP_API_TOKEN
  if (!token) {
    throw new Error('CLICKUP_API_TOKEN environment variable is required')
  }
  return token
}

function sanitizeError(raw: string): string {
  let cleaned = raw
  const token = process.env.CLICKUP_API_TOKEN
  if (token && cleaned.includes(token)) {
    cleaned = cleaned.replaceAll(token, '[REDACTED]')
  }
  return cleaned.length > 240 ? `${cleaned.slice(0, 240)}...[truncated]` : cleaned
}

async function clickupFetch<T>(
  path: string,
  options: {
    method?: 'GET' | 'POST'
    body?: unknown
    timeoutMs?: number
  } = {}
): Promise<T> {
  const token = getClickUpToken()
  const url = `${CLICKUP_API_BASE}${path.startsWith('/') ? path : `/${path}`}`
  const { method = 'GET', body, timeoutMs = 15_000 } = options

  const controller = new AbortController()
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: token,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })

    if (!response.ok) {
      const raw = await response.text().catch(() => response.statusText)
      throw new Error(`ClickUp API ${response.status}: ${sanitizeError(raw)}`)
    }

    return (await response.json()) as T
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('ClickUp API request timed out')
    }
    throw error
  } finally {
    clearTimeout(timeoutHandle)
  }
}

export async function createTaskComment(taskId: string, commentText: string): Promise<void> {
  await clickupFetch(`/task/${taskId}/comment`, {
    method: 'POST',
    body: {
      comment_text: commentText,
      notify_all: false,
    },
  })
}

export async function getTaskSummary(taskId: string): Promise<ClickUpTaskSummary | null> {
  try {
    const task = await clickupFetch<ClickUpTaskResponse>(`/task/${taskId}`)
    return {
      id: task.id,
      name: task.name,
      status: task.status?.status || 'unknown',
      url: task.url || null,
    }
  } catch (error) {
    log.warn(`Failed to fetch ClickUp task ${taskId}`, error)
    return null
  }
}
