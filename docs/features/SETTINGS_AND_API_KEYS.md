# Settings Page & API Key Management

> User settings and admin API key configuration for Sophie Hub.

---

## Overview

Sophie Hub needs a user-friendly settings system that:
1. Shows user profile with Google avatar
2. Allows theme preferences
3. **Admin-only**: Stores API keys (Claude, etc.) in the database, not env files

---

## Design Principles (Emil Kowalski)

Following [animations.dev](https://animations.dev/) and [emilkowal.ski](https://emilkowal.ski/):

1. **Progressive Disclosure** - Simple profile first, admin settings behind role check
2. **No Unnecessary Animation** - Settings are used frequently, keep it fast
3. **Instant Feedback** - Save states, success confirmations
4. **Data Feels Solid** - Clear hierarchy, secure fields properly masked

### Animation Guidelines for Settings

| Element | Animation | Duration |
|---------|-----------|----------|
| Page load | None (instant) | 0ms |
| Tab switch | Content fade | 150ms ease-out |
| Save button | Loading spinner | N/A |
| Success toast | Slide in | 200ms ease-out |
| Password reveal | None (security) | 0ms |

---

## Architecture

### Database Schema

```sql
-- System settings table for API keys and configuration
CREATE TABLE system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,           -- 'anthropic_api_key', 'openai_api_key', etc.
  value TEXT NOT NULL,                -- Encrypted value
  encrypted BOOLEAN DEFAULT true,
  description TEXT,
  updated_by UUID REFERENCES staff(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: Only admins can read/write
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY settings_admin_all ON system_settings
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM staff
    WHERE staff.id = auth.uid()
    AND staff.role IN ('admin', 'operations_admin')
  ));
```

### Encryption Strategy

API keys are encrypted at rest using AES-256-GCM:

```typescript
// src/lib/encryption/index.ts
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY! // 32-byte key

export function encrypt(plaintext: string): string {
  const iv = randomBytes(16)
  const cipher = createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`
}

export function decrypt(ciphertext: string): string {
  const [ivHex, tagHex, encryptedHex] = ciphertext.split(':')
  const iv = Buffer.from(ivHex, 'hex')
  const tag = Buffer.from(tagHex, 'hex')
  const encrypted = Buffer.from(encryptedHex, 'hex')
  const decipher = createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv)
  decipher.setAuthTag(tag)
  return decipher.update(encrypted) + decipher.final('utf8')
}
```

**Environment Setup:**
```bash
# Generate a 32-byte encryption key (run once)
openssl rand -hex 32

# Add to .env.local
ENCRYPTION_KEY=your_64_character_hex_key
```

---

## Page Structure

### User Settings `/settings`

```
┌─────────────────────────────────────────────────────────┐
│  Settings                                               │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  👤 Profile                                     │   │
│  │                                                  │   │
│  │  [Google Avatar]  Tomas Norton                  │   │
│  │                   tomas@sophiesociety.com       │   │
│  │                   Admin                         │   │
│  │                                                  │   │
│  │  Signed in with Google                          │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  🎨 Appearance                                  │   │
│  │                                                  │   │
│  │  Theme:  [Light] [Dark] [System]                │   │
│  │                                                  │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  [Admin only: Link to Admin Settings →]                 │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Admin Settings `/admin/settings`

```
┌─────────────────────────────────────────────────────────┐
│  Admin Settings                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  🔑 API Keys                                    │   │
│  │                                                  │   │
│  │  Anthropic (Claude)                             │   │
│  │  [sk-ant-••••••••••••••••••••]  [👁] [Save]    │   │
│  │  Powers AI mapping suggestions                  │   │
│  │  ✓ Connected · Last used: 2 hours ago          │   │
│  │                                                  │   │
│  │  ─────────────────────────────────────────────  │   │
│  │                                                  │   │
│  │  OpenAI (Future)                                │   │
│  │  [Not configured]                    [Add Key]  │   │
│  │                                                  │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  🔒 Security                                    │   │
│  │                                                  │   │
│  │  Audit Log  [View →]                            │   │
│  │  Rate Limits  [Configure →]                     │   │
│  │                                                  │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### GET /api/settings
User settings (theme, preferences).

### GET /api/admin/settings
Admin-only. Returns settings with masked API keys.

```typescript
// Response
{
  settings: [
    {
      key: 'anthropic_api_key',
      masked_value: 'sk-ant-••••••••hX9k',  // Last 4 chars visible
      description: 'Anthropic API key for AI features',
      is_set: true,
      updated_at: '2026-01-25T10:30:00Z'
    }
  ]
}
```

### PUT /api/admin/settings/[key]
Admin-only. Update a setting.

```typescript
// Request
{ value: 'sk-ant-api03-...' }

// Response
{ success: true, masked_value: 'sk-ant-••••••••newK' }
```

### DELETE /api/admin/settings/[key]
Admin-only. Remove a setting.

---

## Component Structure

```
src/
├── app/
│   ├── (dashboard)/
│   │   ├── settings/
│   │   │   └── page.tsx              # User settings
│   │   └── admin/
│   │       └── settings/
│   │           └── page.tsx          # Admin settings
│   └── api/
│       ├── settings/
│       │   └── route.ts              # User settings API
│       └── admin/
│           └── settings/
│               ├── route.ts          # List settings
│               └── [key]/
│                   └── route.ts      # Update/delete setting
├── components/
│   └── settings/
│       ├── profile-card.tsx          # User profile display
│       ├── theme-selector.tsx        # Theme toggle
│       └── api-key-input.tsx         # Secure API key input
└── lib/
    └── encryption/
        └── index.ts                  # Encrypt/decrypt utilities
```

---

## Sidebar Integration

Update sidebar to:
1. Use `useSession()` to get user data
2. Show Google profile image via `AvatarImage`
3. Make user section clickable → navigate to `/settings`

```tsx
// In sidebar.tsx
import { useSession } from 'next-auth/react'
import { AvatarImage } from '@/components/ui/avatar'
import Link from 'next/link'

const { data: session } = useSession()

<Link href="/settings">
  <div className="flex items-center gap-3 rounded-lg p-2 hover:bg-accent cursor-pointer">
    <Avatar className="h-9 w-9">
      <AvatarImage src={session?.user?.image || undefined} />
      <AvatarFallback>{getInitials(session?.user?.name)}</AvatarFallback>
    </Avatar>
    <div className="flex flex-1 flex-col">
      <span className="text-sm font-medium">{session?.user?.name}</span>
      <span className="text-xs text-muted-foreground">
        {userRole}
      </span>
    </div>
  </div>
</Link>
```

---

## AI SDK Integration

Update `MappingAssistantSDK` to load API key from database:

```typescript
// src/lib/ai/mapping-sdk.ts
import { getSystemSetting } from '@/lib/settings'

export class MappingAssistantSDK {
  private async getApiKey(): Promise<string> {
    // First check database
    const dbKey = await getSystemSetting('anthropic_api_key')
    if (dbKey) return dbKey

    // Fallback to env (for development/migration)
    const envKey = process.env.ANTHROPIC_API_KEY
    if (envKey) return envKey

    throw new Error('Anthropic API key not configured. Add it in Admin Settings.')
  }

  async suggestColumnMapping(...) {
    const apiKey = await this.getApiKey()
    this.anthropic = new Anthropic({ apiKey })
    // ...
  }
}
```

---

## Security Considerations

1. **Encryption at Rest** - All API keys encrypted with AES-256-GCM
2. **Masked Display** - Only show last 4 characters in UI
3. **Audit Logging** - Log all settings changes
4. **RLS Enforcement** - Database-level admin-only access
5. **No Client Exposure** - API keys never sent to browser (only masked versions)

---

## Implementation Phases

### Phase 1: Foundation ✅
- [x] Create encryption utilities (`src/lib/encryption/index.ts`)
- [x] Database migration for system_settings (applied 2026-01-25)
- [x] Basic settings API routes (`/api/admin/settings`)

### Phase 2: User Settings ✅
- [x] Update sidebar with session data + Google avatar
- [x] Create user settings page (`/settings`)
- [x] Theme selector component

### Phase 3: Admin Settings ✅
- [x] Create admin settings page (`/admin/settings`)
- [x] API key input component with masking
- [x] Update AI SDK to use database keys

### Phase 4: Polish
- [ ] Audit logging for settings changes
- [ ] Connection test for API keys
- [x] Success/error toasts

---

## Related Documentation

- `docs/features/AI_MAPPING_ASSISTANT.md` - AI features using the API keys
- `src/components/data-enrichment/ROADMAP.md` - Overall roadmap
- `CLAUDE.md` - Project auth documentation

---

*Last updated: 2026-01-25*
