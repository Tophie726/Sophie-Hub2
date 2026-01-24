# AI Mapping Assistant

> Claude-powered intelligent column mapping within Sophie Hub's SmartMapper.

---

## Vision

An AI co-pilot that helps admins map data source columns to Sophie Hub entities. Works at multiple granularity levels:

| Level | Use Case | Example |
|-------|----------|---------|
| **Column** | "What should this column be?" | Click sparkle icon on single column |
| **Tab** | "Suggest mappings for all columns" | "AI Suggest All" button |
| **Sheet** | "Analyze this sheet's structure" | For complex nested sheets |

---

## UX Flow

### Column-Level AI Assist

```
┌─────────────────────────────────────────────────────────────┐
│ SmartMapper - Classify Phase                                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Column Name          Sample Value       Category    [AI]   │
│  ─────────────────────────────────────────────────────────  │
│  Brand Name           "Acme Corp"        Partner ▼   ✨     │
│  Contact Email        "john@acme.com"    [?]         ✨←click│
│  Weekly Status 1/6    "Green"            [?]         ✨     │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 🤖 AI Suggestion                                    │   │
│  │                                                     │   │
│  │ This looks like a **Staff** email field.            │   │
│  │                                                     │   │
│  │ Confidence: 92%                                     │   │
│  │ Reasoning: Contains @ symbol, column name has       │   │
│  │ "email", values match email format.                 │   │
│  │                                                     │   │
│  │ Suggested mapping:                                  │   │
│  │ → Category: Staff                                   │   │
│  │ → Target: staff.email                               │   │
│  │ → Authority: Reference (another source has this)    │   │
│  │                                                     │   │
│  │ [Apply Suggestion]  [Ignore]                        │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Tab-Level AI Assist

```
┌─────────────────────────────────────────────────────────────┐
│ SmartMapper - Classify Phase                    [✨ AI All] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  🤖 Analyzing 24 columns...                                 │
│  ████████████████░░░░ 80%                                   │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  AI Suggestions (Review before applying):                   │
│                                                             │
│  ✅ High Confidence (18 columns)                            │
│  │ Brand Name        → partners.brand_name    (98%)        │
│  │ Partner Email     → partners.email         (95%)        │
│  │ Manager Name      → staff.full_name        (94%)        │
│  │ ...                                                      │
│                                                             │
│  ⚠️ Medium Confidence (4 columns)                           │
│  │ Status            → partners.status?       (72%)        │
│  │ Tier              → partners.tier?         (68%)        │
│                                                             │
│  ❓ Needs Manual Review (2 columns)                         │
│  │ Notes             → ?                      (34%)        │
│  │ Custom Field 1    → ?                      (12%)        │
│                                                             │
│  [Apply High Confidence]  [Review All]  [Cancel]            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Architecture

### Context Claude Needs

For intelligent suggestions, Claude needs to understand:

```typescript
interface MappingAssistantContext {
  // Sophie Hub schema
  entities: {
    partners: FieldDefinition[]    // brand_name, email, tier, status, etc.
    staff: FieldDefinition[]       // full_name, email, role, squad, etc.
    asins: FieldDefinition[]       // asin, title, category, etc.
  }

  // Existing mappings (to learn patterns)
  existingMappings: {
    sourceColumn: string
    targetEntity: string
    targetField: string
    authority: 'source_of_truth' | 'reference'
  }[]

  // What's already mapped in this tab
  currentTabMappings: ColumnClassification[]

  // Column being analyzed
  column: {
    name: string
    sampleValues: string[]  // First 10 non-empty values
    position: number        // Column index
    siblingColumns: string[] // Adjacent column names for context
  }
}
```

### SDK Structure

```typescript
// src/lib/ai/mapping-sdk.ts

import Anthropic from '@anthropic-ai/sdk'
import { getEntitySchema } from '@/lib/db/schema'
import { getExistingMappings } from '@/lib/db/mappings'

export class MappingAssistantSDK {
  private anthropic: Anthropic
  private context: MappingAssistantContext | null = null

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    })
  }

  /**
   * Initialize context for a mapping session
   * Call once when SmartMapper loads
   */
  async initializeContext(dataSourceId: string): Promise<void> {
    const [entities, existingMappings] = await Promise.all([
      getEntitySchema(),
      getExistingMappings()
    ])

    this.context = {
      entities,
      existingMappings,
      currentTabMappings: []
    }
  }

  /**
   * Get AI suggestion for a single column
   */
  async suggestColumnMapping(
    columnName: string,
    sampleValues: string[],
    siblingColumns: string[]
  ): Promise<ColumnSuggestion> {
    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: this.buildSystemPrompt(),
      tools: [this.columnMappingTool],
      messages: [{
        role: 'user',
        content: this.buildColumnPrompt(columnName, sampleValues, siblingColumns)
      }]
    })

    return this.parseColumnSuggestion(response)
  }

  /**
   * Get AI suggestions for all columns in a tab
   */
  async suggestAllMappings(
    columns: { name: string; sampleValues: string[] }[]
  ): Promise<TabSuggestion[]> {
    // Use streaming for progress updates
    const suggestions: TabSuggestion[] = []

    for (const column of columns) {
      const suggestion = await this.suggestColumnMapping(
        column.name,
        column.sampleValues,
        columns.map(c => c.name)
      )
      suggestions.push(suggestion)

      // Emit progress event
      this.onProgress?.(suggestions.length / columns.length)
    }

    return suggestions
  }

  /**
   * Analyze sheet structure (for nested sheets)
   */
  async analyzeSheetStructure(
    sheetData: string[][],
    sheetName: string
  ): Promise<SheetAnalysis> {
    // For complex sheets, analyze overall structure
    // Identify: header rows, data sections, linked sheets, etc.
  }

  // Tool definitions
  private columnMappingTool = {
    name: 'suggest_column_mapping',
    description: 'Suggest how a source column maps to Sophie Hub entities',
    input_schema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          enum: ['partner', 'staff', 'asin', 'weekly', 'computed', 'skip'],
          description: 'The entity category this column belongs to'
        },
        target_field: {
          type: 'string',
          description: 'The specific field in the target entity (e.g., "brand_name")'
        },
        confidence: {
          type: 'number',
          minimum: 0,
          maximum: 1,
          description: 'Confidence score for this suggestion'
        },
        reasoning: {
          type: 'string',
          description: 'Brief explanation of why this mapping was suggested'
        },
        is_key: {
          type: 'boolean',
          description: 'Whether this column is likely a key/identifier field'
        },
        authority: {
          type: 'string',
          enum: ['source_of_truth', 'reference'],
          description: 'Suggested authority level based on existing mappings'
        }
      },
      required: ['category', 'confidence', 'reasoning']
    }
  }

  private buildSystemPrompt(): string {
    return `You are a data mapping assistant for Sophie Hub, an internal operations platform for Sophie Society (an Amazon brand management agency).

## Your Role
Help admins map columns from external data sources (Google Sheets, CRMs, etc.) to Sophie Hub's core entities.

## Core Entities

### partners (Client brands)
Fields: brand_name, email, phone, tier, status, manager_id, timezone, created_at, etc.
Key identifier: brand_name or partner_id

### staff (Team members)
Fields: full_name, email, role, squad_id, timezone, hire_date, etc.
Key identifier: email or staff_id

### asins (Amazon products per partner)
Fields: asin, title, category, partner_id, status, etc.
Key identifier: asin

## Column Categories
- partner: Maps to partners entity
- staff: Maps to staff entity
- asin: Maps to asins entity
- weekly: Time-series status columns (dates like "1/6", "Week 1")
- computed: Derived fields that need calculation
- skip: Columns to ignore (notes, internal tracking, etc.)

## Existing Patterns
${JSON.stringify(this.context?.existingMappings.slice(0, 20), null, 2)}

## Guidelines
1. Be conservative - if unsure, lower your confidence score
2. Look at sample values, not just column names
3. Consider context from sibling columns
4. Weekly columns often have date patterns in names
5. Key fields are usually unique identifiers (IDs, emails, ASINs)`
  }
}
```

---

## API Endpoints

### POST /api/ai/suggest-mapping

Single column suggestion.

```typescript
// Request
{
  column_name: string
  sample_values: string[]
  sibling_columns: string[]
  data_source_id: string
}

// Response
{
  suggestion: {
    category: 'partner' | 'staff' | 'asin' | 'weekly' | 'computed' | 'skip'
    target_field: string | null
    confidence: number  // 0-1
    reasoning: string
    is_key: boolean
    authority: 'source_of_truth' | 'reference'
  }
}
```

### POST /api/ai/suggest-all-mappings

Tab-level bulk suggestions with streaming.

```typescript
// Request
{
  columns: { name: string; sample_values: string[] }[]
  data_source_id: string
  tab_name: string
}

// Response (streamed)
{
  progress: number  // 0-1
  suggestions: ColumnSuggestion[]
  completed: boolean
}
```

---

## SmartMapper Integration

### Component Changes

```typescript
// smart-mapper.tsx additions

interface SmartMapperProps {
  // ... existing props
  enableAI?: boolean  // Feature flag
}

// New state
const [aiSuggestions, setAiSuggestions] = useState<Map<number, ColumnSuggestion>>()
const [aiLoading, setAiLoading] = useState<'idle' | 'column' | 'all'>('idle')

// AI button per column
<Button
  variant="ghost"
  size="icon"
  onClick={() => handleAISuggest(column.sourceIndex)}
  disabled={aiLoading !== 'idle'}
>
  <Sparkles className="h-4 w-4" />
</Button>

// Bulk AI button in header
<Button
  variant="outline"
  onClick={handleAISuggestAll}
  disabled={aiLoading !== 'idle'}
>
  <Sparkles className="h-4 w-4 mr-2" />
  AI Suggest All
</Button>
```

### Suggestion Display

```typescript
// Inline suggestion badge
{aiSuggestions.has(column.sourceIndex) && (
  <AIsuggestionBadge
    suggestion={aiSuggestions.get(column.sourceIndex)!}
    onApply={() => applyAISuggestion(column.sourceIndex)}
    onDismiss={() => dismissAISuggestion(column.sourceIndex)}
  />
)}
```

---

## Cost Management

### Token Estimation

| Operation | Est. Tokens | Cost (Sonnet) |
|-----------|-------------|---------------|
| Single column | ~500 | ~$0.002 |
| Tab (20 cols) | ~10,000 | ~$0.04 |
| Sheet analysis | ~5,000 | ~$0.02 |

### Rate Limiting

```typescript
// Per-user limits
const AI_LIMITS = {
  columns_per_minute: 20,
  tabs_per_hour: 10,
  daily_budget_usd: 5.00
}
```

### Model Selection

- **Haiku**: Quick single-column suggestions (fast, cheap)
- **Sonnet**: Bulk tab analysis, complex sheets (accurate)

---

## Implementation Phases

### Phase 6.1: Foundation
- [ ] MappingAssistantSDK class
- [ ] API route: /api/ai/suggest-mapping
- [ ] Environment: ANTHROPIC_API_KEY
- [ ] Rate limiting middleware

### Phase 6.2: Column-Level UI
- [ ] Sparkle button per column
- [ ] Suggestion popover component
- [ ] Apply/dismiss actions
- [ ] Loading states

### Phase 6.3: Tab-Level UI
- [ ] "AI Suggest All" button
- [ ] Progress indicator
- [ ] Bulk review modal
- [ ] Confidence filtering

### Phase 6.4: Learning & Patterns
- [ ] Store accepted suggestions
- [ ] Use patterns in future suggestions
- [ ] "Why did you suggest this?" explainer

---

## Security Considerations

1. **API Key Storage**: Environment variable, never client-side
2. **Input Sanitization**: Don't send PII to Claude unnecessarily
3. **Audit Trail**: Log all AI suggestions and actions
4. **Human Override**: AI suggests, human always approves
5. **Cost Controls**: Per-user rate limits, budget caps

---

*Design-led by Emil Kowalski principles: Progressive disclosure, instant feedback, purposeful motion.*
