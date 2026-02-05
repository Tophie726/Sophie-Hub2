import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { requireRole } from '@/lib/auth/api-auth'
import { ROLES } from '@/lib/auth/roles'
import { apiSuccess, apiError, apiValidationError } from '@/lib/api/response'
import { getAnthropicApiKey } from '@/lib/settings'
import { getAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

const RequestSchema = z.object({
  feedbackId: z.string().uuid('Invalid feedback ID'),
})

interface ImplementationSuggestion {
  summary: string
  approach: string
  steps: Array<{
    step: number
    description: string
    files: string[]
  }>
  filesToCreate: string[]
  filesToModify: string[]
  databaseChanges?: string
  complexity: 'low' | 'medium' | 'high'
  estimatedScope: string
  risks?: string
  alternatives?: string
}

/**
 * POST /api/ai/suggest-implementation
 * Generate implementation suggestions for a feature request
 */
export async function POST(request: NextRequest) {
  // Auth check - admin only
  const auth = await requireRole(ROLES.ADMIN)
  if (!auth.authenticated) {
    return auth.response
  }

  // Parse and validate request
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError('INVALID_JSON', 'Invalid JSON in request body', 400)
  }

  const validation = RequestSchema.safeParse(body)
  if (!validation.success) {
    return apiValidationError(validation.error)
  }

  const { feedbackId } = validation.data

  // Check for Anthropic API key
  let anthropicKey: string
  try {
    anthropicKey = await getAnthropicApiKey()
  } catch {
    return apiError(
      'SERVICE_UNAVAILABLE',
      'AI analysis is not configured. Add your Anthropic API key in Settings → API Keys.',
      503
    )
  }

  // Get the feedback item
  const supabase = getAdminClient()
  const { data: feedback, error: feedbackError } = await supabase
    .from('feedback')
    .select('*')
    .eq('id', feedbackId)
    .single()

  if (feedbackError || !feedback) {
    return apiError('NOT_FOUND', 'Feedback item not found', 404)
  }

  // Build context for Claude
  const contextParts: string[] = []

  contextParts.push(`## Feature Request Details
- **Title**: ${feedback.title || 'No title'}
- **Description**: ${feedback.description}
- **Requested by**: ${feedback.submitted_by_email}
- **Votes**: ${feedback.vote_count || 0}
- **Status**: ${feedback.status}
- **Requested at**: ${feedback.created_at}`)

  if (feedback.page_url) {
    contextParts.push(`- **Context Page**: ${feedback.page_url}`)
  }

  // Call Claude for implementation suggestion
  const anthropic = new Anthropic({ apiKey: anthropicKey })

  const systemPrompt = `You are a senior software architect helping plan feature implementations for Sophie Hub v2, a Next.js 14 application with:

## Tech Stack
- Next.js 14 with App Router (Server Components by default)
- TypeScript (strict mode)
- Supabase (PostgreSQL) for database
- shadcn/ui component library with Tailwind CSS
- Framer Motion for animations
- NextAuth.js for authentication
- React Hook Form + Zod for forms

## Project Structure
\`\`\`
src/
├── app/
│   ├── (dashboard)/     # Authenticated routes
│   │   ├── admin/       # Admin-only pages
│   │   ├── partners/    # Partner management
│   │   ├── staff/       # Staff management
│   │   └── feedback/    # Feedback center
│   └── api/             # API routes
├── components/
│   ├── ui/              # shadcn/ui base components
│   └── [feature]/       # Feature-specific components
├── lib/
│   ├── db/              # Database queries
│   ├── api/             # API utilities
│   └── [feature]/       # Feature-specific logic
└── types/               # TypeScript types
\`\`\`

## Design Principles
- Entity-first approach (Partners and Staff are core entities)
- Progressive disclosure (simple first, complexity on demand)
- Mobile-responsive with desktop-first design
- Data comes from database, never hardcoded
- Reuse existing components (check ui/ first)

Your job is to analyze the feature request and provide:
1. A clear approach to implementation
2. Step-by-step implementation plan
3. Files to create and modify
4. Database changes if needed
5. Complexity assessment

Be specific and practical. Reference actual file paths following the project structure.

Respond with a JSON object matching this structure:
{
  "summary": "One-sentence summary of the implementation",
  "approach": "High-level approach explanation",
  "steps": [
    {
      "step": 1,
      "description": "What to do in this step",
      "files": ["file/paths/to/touch.ts"]
    }
  ],
  "filesToCreate": ["new/file/paths.tsx"],
  "filesToModify": ["existing/file/paths.ts"],
  "databaseChanges": "SQL or migration description if needed",
  "complexity": "low" | "medium" | "high",
  "estimatedScope": "e.g., '2-4 hours', 'half day', '1-2 days'",
  "risks": "Potential issues or considerations",
  "alternatives": "Other approaches considered"
}`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3000,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Please suggest an implementation approach for this feature request:\n\n${contextParts.join('\n')}`,
        },
      ],
    })

    // Extract the response text
    const responseText = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map(block => block.text)
      .join('')

    // Try to parse as JSON
    let suggestion: ImplementationSuggestion
    try {
      // Extract JSON from response (might be wrapped in markdown code block)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('No JSON found in response')
      }
      suggestion = JSON.parse(jsonMatch[0])
    } catch {
      // Fallback: return raw text
      suggestion = {
        summary: 'Unable to parse structured suggestion',
        approach: responseText,
        steps: [],
        filesToCreate: [],
        filesToModify: [],
        complexity: 'medium',
        estimatedScope: 'Unknown',
      }
    }

    return apiSuccess({
      suggestion,
    })
  } catch (error) {
    console.error('Claude API error:', error)
    return apiError('AI_ERROR', 'Failed to generate implementation suggestion. Please try again.', 500)
  }
}
