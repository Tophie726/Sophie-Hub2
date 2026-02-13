# Slack -> ClickUp Daily Sync

## What It Does

Daily cron endpoint: `POST /api/cron/slack-clickup-sync`

1. Reads recent messages from one Slack channel.
2. Maps message updates to ClickUp tasks.
3. Posts comments to matching ClickUp tasks.
4. Posts a daily summary back to Slack.
5. Includes staging task snapshot (Staging Setup, Git staging, Supabase, Vercel).

## Schedule

Configured in `vercel.json`:

- `0 14 * * *` (daily at 14:00 UTC)

## Required Env Vars

- `CRON_SECRET`
- `SLACK_BOT_TOKEN`
- `CLICKUP_API_TOKEN`
- `SLACK_CLICKUP_SCAN_CHANNEL_ID`

## Optional Env Vars

- `SLACK_CLICKUP_SUMMARY_CHANNEL_ID` (default: scan channel)
- `SLACK_CLICKUP_LOOKBACK_HOURS` (default: `24`)
- `SLACK_CLICKUP_MAX_MESSAGES_PER_RUN` (default: `500`)
- `SLACK_CLICKUP_STAGING_SETUP_TASK_ID` (default: `86ewk05ma`)
- `SLACK_CLICKUP_STAGING_GIT_TASK_ID` (default: `86ewk05t9`)
- `SLACK_CLICKUP_STAGING_SUPABASE_TASK_ID` (default: `86ewk05rx`)
- `SLACK_CLICKUP_STAGING_VERCEL_TASK_ID` (default: `86ewk05rm`)

## Message-To-Task Matching

Explicit matching:

- ClickUp URL: `https://app.clickup.com/t/<task_id>`
- Tagged IDs: `task:<id>`, `cu#<id>`, `clickup:<id>`
- Workspace-style short IDs: `86xxxxxxx`
- Custom IDs: `DEV-123`

Keyword staging mapping (when message contains `staging`):

- `git` -> staging Git task
- `supa` or `supabase` -> staging Supabase task
- `vercel` -> staging Vercel task
- If none matched -> staging setup task

Signal detection:

- `BLOCKER`: contains `blocked`, `blocker`, `#blocker`
- `COMPLETED`: contains `done`, `completed`, `resolved`, `#done`
- Otherwise: `UPDATE`

## Notes

- Sync watermark is stored in `slack_clickup_sync_state` (migration: `20260221_slack_clickup_sync_state.sql`).
- Comments are additive only; task status is not auto-changed.
