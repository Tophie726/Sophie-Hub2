import { getAdminClient } from '@/lib/supabase/admin'
import { createLogger } from '@/lib/logger'
import { createTaskComment, getTaskSummary, type ClickUpTaskSummary } from '@/lib/clickup/client'
import { getChannelHistorySinceWithText, postChannelMessage } from '@/lib/slack/client'
import type { SlackMessageWithText } from '@/lib/slack/types'

const log = createLogger('slack-clickup-sync')

const STATE_TABLE = 'slack_clickup_sync_state'
const DEFAULT_LOOKBACK_HOURS = 24
const DEFAULT_MAX_MESSAGES_PER_RUN = 500

const DEFAULT_STAGING_SETUP_TASK_ID = '86ewk05ma'
const DEFAULT_STAGING_GIT_TASK_ID = '86ewk05t9'
const DEFAULT_STAGING_SUPABASE_TASK_ID = '86ewk05rx'
const DEFAULT_STAGING_VERCEL_TASK_ID = '86ewk05rm'

type SyncSignal = 'BLOCKER' | 'COMPLETED' | 'UPDATE'

interface SyncConfig {
  scanChannelId: string
  summaryChannelId: string
  lookbackHours: number
  maxMessagesPerRun: number
  stagingSetupTaskId: string
  stagingGitTaskId: string
  stagingSupabaseTaskId: string
  stagingVercelTaskId: string
}

interface TaskUpdate {
  taskId: string
  signal: SyncSignal
  message: SlackMessageWithText
}

export interface SlackClickUpSyncSummary {
  channel_id: string
  summary_channel_id: string
  oldest_ts: string
  latest_ts_processed: string | null
  messages_scanned: number
  comments_posted: number
  blockers: number
  completed: number
  updates: number
  tasks_touched: string[]
  staging_snapshot: ClickUpTaskSummary[]
  state_persisted: boolean
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} environment variable is required`)
  }
  return value
}

function optionalEnv(name: string, fallback: string): string {
  const value = process.env[name]
  return value && value.trim().length > 0 ? value.trim() : fallback
}

function parseIntEnv(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name]
  if (!raw) return fallback

  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, parsed))
}

function loadConfig(): SyncConfig {
  const scanChannelId = requireEnv('SLACK_CLICKUP_SCAN_CHANNEL_ID')
  return {
    scanChannelId,
    summaryChannelId: optionalEnv('SLACK_CLICKUP_SUMMARY_CHANNEL_ID', scanChannelId),
    lookbackHours: parseIntEnv('SLACK_CLICKUP_LOOKBACK_HOURS', DEFAULT_LOOKBACK_HOURS, 1, 168),
    maxMessagesPerRun: parseIntEnv(
      'SLACK_CLICKUP_MAX_MESSAGES_PER_RUN',
      DEFAULT_MAX_MESSAGES_PER_RUN,
      10,
      2000
    ),
    stagingSetupTaskId: optionalEnv('SLACK_CLICKUP_STAGING_SETUP_TASK_ID', DEFAULT_STAGING_SETUP_TASK_ID),
    stagingGitTaskId: optionalEnv('SLACK_CLICKUP_STAGING_GIT_TASK_ID', DEFAULT_STAGING_GIT_TASK_ID),
    stagingSupabaseTaskId: optionalEnv(
      'SLACK_CLICKUP_STAGING_SUPABASE_TASK_ID',
      DEFAULT_STAGING_SUPABASE_TASK_ID
    ),
    stagingVercelTaskId: optionalEnv('SLACK_CLICKUP_STAGING_VERCEL_TASK_ID', DEFAULT_STAGING_VERCEL_TASK_ID),
  }
}

function fallbackOldestTs(lookbackHours: number): string {
  const epochSeconds = Math.floor(Date.now() / 1000) - lookbackHours * 3600
  return `${epochSeconds}`
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function parseSignal(text: string): SyncSignal {
  const lower = text.toLowerCase()

  if (/\bblocked\b|\bblocker\b|#blocker\b/.test(lower)) {
    return 'BLOCKER'
  }

  if (/\bdone\b|\bcomplete(?:d)?\b|\bresolved\b|#done\b/.test(lower)) {
    return 'COMPLETED'
  }

  return 'UPDATE'
}

function extractExplicitTaskIds(text: string): Set<string> {
  const ids = new Set<string>()

  // ClickUp task URL
  const urlPattern = /https?:\/\/app\.clickup\.com\/t\/([A-Za-z0-9_-]+)/gi
  let match: RegExpExecArray | null
  while ((match = urlPattern.exec(text)) !== null) {
    if (match[1]) ids.add(match[1])
  }

  // Explicit task tags (task:86xxxxx, cu#86xxxxx, clickup:DEV-123)
  const taskTagPattern = /\b(?:task|cu|clickup)\s*[:#]\s*([A-Za-z0-9_-]{4,})\b/gi
  while ((match = taskTagPattern.exec(text)) !== null) {
    if (match[1]) ids.add(match[1])
  }

  // ClickUp-style short task IDs used in this workspace
  const shortTaskPattern = /\b86[a-z0-9]{7}\b/gi
  while ((match = shortTaskPattern.exec(text)) !== null) {
    if (match[0]) ids.add(match[0])
  }

  // Custom IDs like DEV-123
  const customTaskPattern = /\b[A-Z]{2,10}-\d+\b/g
  while ((match = customTaskPattern.exec(text)) !== null) {
    if (match[0]) ids.add(match[0])
  }

  return ids
}

function extractKeywordMappedTaskIds(text: string, config: SyncConfig): Set<string> {
  const ids = new Set<string>()
  const lower = text.toLowerCase()
  const hasStaging = lower.includes('staging')

  if (!hasStaging) {
    return ids
  }

  if (/\bgit\b/.test(lower)) ids.add(config.stagingGitTaskId)
  if (/\bsupa\b|\bsupabase\b/.test(lower)) ids.add(config.stagingSupabaseTaskId)
  if (/\bvercel\b/.test(lower)) ids.add(config.stagingVercelTaskId)

  if (ids.size === 0) {
    ids.add(config.stagingSetupTaskId)
  }

  return ids
}

function buildSlackDeepLink(channelId: string, ts: string): string {
  return `https://slack.com/app_redirect?channel=${encodeURIComponent(channelId)}&message_ts=${encodeURIComponent(ts)}`
}

function formatMessageTimestamp(ts: string): string {
  const epochSeconds = Number.parseFloat(ts)
  if (!Number.isFinite(epochSeconds)) return ts
  return new Date(epochSeconds * 1000).toISOString()
}

function buildClickUpComment(update: TaskUpdate, channelId: string): string {
  const sender = update.message.user
    ? `<@${update.message.user}>`
    : update.message.bot_id
      ? `bot:${update.message.bot_id}`
      : 'system'

  const text = normalizeText(update.message.text || '')
  const stampedAt = formatMessageTimestamp(update.message.ts)

  return [
    'Slack update sync',
    `Signal: ${update.signal}`,
    `Channel: ${channelId}`,
    `Sender: ${sender}`,
    `Timestamp: ${stampedAt}`,
    '',
    'Message:',
    text || '(no text)',
    '',
    `Source: ${buildSlackDeepLink(channelId, update.message.ts)}`,
    `Sync marker: ${channelId}:${update.message.ts}`,
  ].join('\n')
}

async function readLastProcessedTs(channelId: string): Promise<string | null> {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from(STATE_TABLE)
    .select('last_processed_ts')
    .eq('channel_id', channelId)
    .maybeSingle()

  if (error) {
    log.warn('Failed to read sync state (continuing with lookback window)', error)
    return null
  }

  const ts = data?.last_processed_ts
  return typeof ts === 'string' && ts.length > 0 ? ts : null
}

async function writeLastProcessedTs(channelId: string, latestTs: string): Promise<boolean> {
  const supabase = getAdminClient()
  const { error } = await supabase
    .from(STATE_TABLE)
    .upsert(
      {
        channel_id: channelId,
        last_processed_ts: latestTs,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'channel_id' }
    )

  if (error) {
    log.warn('Failed to persist sync state', error)
    return false
  }

  return true
}

async function fetchStagingSnapshot(config: SyncConfig): Promise<ClickUpTaskSummary[]> {
  const taskIds = [
    config.stagingSetupTaskId,
    config.stagingGitTaskId,
    config.stagingSupabaseTaskId,
    config.stagingVercelTaskId,
  ]

  const uniqueTaskIds = Array.from(new Set(taskIds))
  const rows = await Promise.all(uniqueTaskIds.map(taskId => getTaskSummary(taskId)))
  return rows.filter((row): row is ClickUpTaskSummary => row !== null)
}

function buildSlackSummaryMessage(
  summary: Omit<SlackClickUpSyncSummary, 'summary_channel_id' | 'channel_id'>
): string {
  const lines: string[] = [
    '*Daily Slack to ClickUp sync*',
    `Messages scanned: ${summary.messages_scanned}`,
    `Comments posted: ${summary.comments_posted}`,
    `Signals: blockers=${summary.blockers}, completed=${summary.completed}, updates=${summary.updates}`,
    `Tasks touched: ${summary.tasks_touched.length}`,
    '',
    '*Staging snapshot*',
  ]

  if (summary.staging_snapshot.length === 0) {
    lines.push('- No staging task snapshots available')
  } else {
    for (const task of summary.staging_snapshot) {
      const line = task.url
        ? `- ${task.name}: ${task.status} (${task.url})`
        : `- ${task.name}: ${task.status}`
      lines.push(line)
    }
  }

  if (summary.latest_ts_processed) {
    lines.push('', `Latest processed Slack ts: ${summary.latest_ts_processed}`)
  }

  return lines.join('\n')
}

export async function runSlackClickUpDailySync(): Promise<SlackClickUpSyncSummary> {
  const config = loadConfig()

  const lastProcessedTs = await readLastProcessedTs(config.scanChannelId)
  const oldestTs = lastProcessedTs || fallbackOldestTs(config.lookbackHours)

  const messages = await getChannelHistorySinceWithText(
    config.scanChannelId,
    oldestTs,
    config.maxMessagesPerRun
  )

  const updates: TaskUpdate[] = []

  for (const message of messages) {
    const rawText = message.text || ''
    if (!rawText.trim()) continue

    const explicitTaskIds = extractExplicitTaskIds(rawText)
    const keywordTaskIds = extractKeywordMappedTaskIds(rawText, config)
    const taskIds = new Set<string>()
    explicitTaskIds.forEach((taskId) => taskIds.add(taskId))
    keywordTaskIds.forEach((taskId) => taskIds.add(taskId))
    if (taskIds.size === 0) continue

    const signal = parseSignal(rawText)
    Array.from(taskIds).forEach((taskId) => {
      updates.push({ taskId, signal, message })
    })
  }

  let commentsPosted = 0
  let blockers = 0
  let completed = 0
  let statusUpdates = 0
  const tasksTouched = new Set<string>()

  for (const update of updates) {
    try {
      const comment = buildClickUpComment(update, config.scanChannelId)
      await createTaskComment(update.taskId, comment)

      commentsPosted++
      tasksTouched.add(update.taskId)

      if (update.signal === 'BLOCKER') blockers++
      else if (update.signal === 'COMPLETED') completed++
      else statusUpdates++
    } catch (error) {
      log.warn(`Failed to post ClickUp comment for task ${update.taskId}`, error)
    }
  }

  const latestTsProcessed = messages.length > 0 ? messages[messages.length - 1].ts : null
  const statePersisted = latestTsProcessed
    ? await writeLastProcessedTs(config.scanChannelId, latestTsProcessed)
    : true

  const stagingSnapshot = await fetchStagingSnapshot(config)

  const summaryBody = {
    oldest_ts: oldestTs,
    latest_ts_processed: latestTsProcessed,
    messages_scanned: messages.length,
    comments_posted: commentsPosted,
    blockers,
    completed,
    updates: statusUpdates,
    tasks_touched: Array.from(tasksTouched),
    staging_snapshot: stagingSnapshot,
    state_persisted: statePersisted,
  }

  await postChannelMessage(config.summaryChannelId, buildSlackSummaryMessage(summaryBody))

  return {
    channel_id: config.scanChannelId,
    summary_channel_id: config.summaryChannelId,
    ...summaryBody,
  }
}
