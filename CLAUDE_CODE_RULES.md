# CLAUDE_CODE_RULES.md

# 🚨 ENFORCEMENT DOCUMENT FOR AI CODE GENERATION

This document defines NON-NEGOTIABLE engineering rules.

Claude MUST follow these rules when generating, modifying, or refactoring code.

If a rule conflicts with convenience, the rule WINS.

---

# 0. PROJECT CONTEXT

Tech Stack:

- Framework: Next.js 14 (App Router)
- Language: TypeScript (`strict: true`)
- Styling: Tailwind CSS + shadcn/ui
- Database: Supabase (PostgreSQL)
- Auth: NextAuth.js + Google OAuth
- External APIs:
  - Google Sheets API
  - Anthropic API

---

# 1. GLOBAL ENFORCEMENT RULES

Claude MUST:

- NEVER use `any`
- NEVER leave dead code
- NEVER leave unused imports
- NEVER leave console.logs in final output
- ALWAYS include error handling
- ALWAYS use explicit return types
- ALWAYS follow separation of concerns
- ALWAYS create or use proper types
- ALWAYS assume strict TypeScript mode
- ALWAYS generate testable code
- ALWAYS maintain consistent naming
- ALWAYS validate external input
- ALWAYS validate API responses
- ALWAYS assume production environment

If uncertain, choose the safest, most maintainable solution.

## 1.1 Git Branch Policy (MANDATORY)

- Default collaboration branch is `staging`.
- Claude MUST open PRs and push work targeting `staging` unless explicitly told otherwise.
- Claude MUST NOT push directly to `main` unless the prompt explicitly says this is a production release.
- Before requesting merge, Claude MUST run `npm run build` locally.

---

# 2. TYPESCRIPT RULES (STRICT MODE)

## 2.1 Absolute Requirements

- `strict: true` is assumed.
- No `any`.
- Use `unknown` if needed.
- All exported functions MUST define return types.
- All function parameters MUST be typed.
- No implicit return types.

Correct:

```ts
export const fetchUser = async (id: string): Promise<User | null> => {
```

Incorrect:

```ts
export const fetchUser = async (id) => {
```

---

## 2.2 Type Organization (MANDATORY)

ALL interfaces and types MUST be in separate files.

Structure:

```
/types
  user.types.ts
  auth.types.ts
  api.types.ts
  database.types.ts
```

Rules:

- No shared interfaces inside components.
- No shared interfaces inside services.
- No type duplication.
- Database types must reflect Supabase schema.
- Reuse existing types before creating new ones.

---

# 3. ARCHITECTURE ENFORCEMENT

STRICT LAYER SEPARATION REQUIRED.

## 3.1 Folder Responsibilities

### /components
- UI ONLY.
- No database queries.
- No Supabase imports.
- No external API logic.
- No business logic.
- Must receive typed props.

### /hooks
- Client-side logic only.
- May call services.
- No direct SQL queries.

### /repositories
- ALL Supabase queries go here.
- No UI logic.
- No business logic.
- Must return typed results.

### /services
- Business logic layer.
- May call repositories.
- May call external APIs.
- Must NOT contain raw SQL.

### /app (API routes / server actions)
- Thin controllers only.
- Validate input.
- Call service.
- Return structured response.

Violation of separation is NOT allowed.

---

# 4. ERROR HANDLING (MANDATORY IN ALL ASYNC LOGIC)

All async logic MUST:

- Use try/catch
- Handle `unknown` error type
- Never swallow errors
- Never use empty catch blocks

Pattern:

```ts
try {
  const result = await operation();
  return result;
} catch (error: unknown) {
  if (error instanceof Error) {
    throw new Error(`Operation failed: ${error.message}`);
  }
  throw new Error("Unexpected error occurred");
}
```

---

# 5. API RESPONSE STANDARD

All API routes MUST return:

```ts
{
  success: boolean;
  data?: T;
  error?: string;
}
```

Rules:

- No inconsistent shapes.
- No throwing raw errors to client.
- No leaking internal details.
- Always handle failure cases.

---

# 6. NO DEAD CODE POLICY

Claude MUST remove:

- Unused imports
- Unused variables
- Commented-out legacy code
- Debug logs
- Unused functions
- Duplicate logic

If code is obsolete → DELETE IT.

Do NOT comment it out.

---

# 7. NAMING ENFORCEMENT

## 7.1 Variables

- camelCase → variables & functions
- PascalCase → components & types
- UPPER_CASE → constants

Correct:

```ts
const userProfile = ...
interface UserProfile {}
const MAX_RETRY_COUNT = 3;
```

Incorrect:

```ts
const user_profile = ...
const maxretrycount = ...
```

---

## 7.2 File Naming

- kebab-case for files
- `.types.ts`
- `.service.ts`
- `.repository.ts`
- `.hook.ts`

Examples:

```
user.service.ts
user.repository.ts
use-auth.hook.ts
auth.types.ts
```

---

# 8. DATABASE RULES (SUPABASE)

- All queries MUST live in repositories.
- All responses MUST be typed.
- Null MUST be handled explicitly.
- Inputs MUST be validated before query.
- Never trust client input.

Pattern:

```ts
const { data, error } = await supabase
  .from("users")
  .select("*")
  .eq("id", userId)
  .single();

if (error) {
  throw new Error(error.message);
}

if (!data) {
  return null;
}
```

---

# 9. AUTH RULES (NextAuth + Google OAuth)

- Never expose secrets to client.
- Always validate session before protected logic.
- Sensitive logic must run server-side.
- Do not trust client session blindly.

---

# 10. EXTERNAL API RULES

## 10.1 Google Sheets API

- Wrap inside service layer.
- Implement retry logic for transient failures.
- Validate inputs before sending.
- Sanitize response before returning.

## 10.2 Anthropic API

- Encapsulate in service.
- Handle rate limits.
- Validate prompt input.
- Never pass raw user input directly.
- Sanitize output before returning.

---

# 11. VALIDATION (REQUIRED)

- Validate all external inputs.
- Validate API body payloads.
- Validate environment variables.
- Prefer zod for schema validation.
- Never trust request.body.

---

# 12. TESTING REQUIREMENTS (MANDATORY)

Tests MUST exist for:

- Services
- Repositories
- Utilities
- Critical business logic

Each test suite MUST include:

- Success case
- Failure case
- Edge case

External APIs MUST be mocked.
Supabase MUST be mocked.

No critical logic without tests.

---

# 13. PERFORMANCE RULES

- Prefer Server Components when possible.
- Avoid unnecessary Client Components.
- Avoid unnecessary re-renders.
- Memoize expensive computations.
- Avoid excessive API calls.

---

# 14. SECURITY RULES

- Never expose secrets.
- Never log tokens.
- Never commit environment variables.
- Sanitize external API responses.
- Escape dangerous output if rendering user content.

---

# 15. PRE-COMPLETION CHECKLIST (MANDATORY SELF-VALIDATION)

Before finalizing code, Claude MUST verify:

- [ ] No `any` types
- [ ] All types in separate files
- [ ] Clear separation of concerns
- [ ] Error handling exists
- [ ] No dead code
- [ ] Explicit return types
- [ ] Proper input validation
- [ ] Tests included or updated
- [ ] No console logs
- [ ] Naming consistent
- [ ] Strict mode compliant
- [ ] No secrets exposed

If any item fails → Refactor before completion.

---

# 16. PRIORITY ORDER

When making decisions, prioritize:

1. Type Safety
2. Security
3. Maintainability
4. Scalability
5. Readability
6. Performance

Never sacrifice type safety for convenience.

---

# FINAL DIRECTIVE

Claude must behave as a senior TypeScript architect.

Code must be:

- Production-ready
- Strictly typed
- Secure
- Cleanly layered
- Fully maintainable
- Testable

If code does not meet these standards, it is considered invalid and must be corrected before delivery.
