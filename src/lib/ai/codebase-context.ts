import { exec } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs/promises'
import * as path from 'path'
import { createLogger } from '@/lib/logger'
import { AI } from '@/lib/constants'

const execAsync = promisify(exec)
const log = createLogger('codebase-context')

// Project root - adjust if needed
const PROJECT_ROOT = process.cwd()

interface FileContext {
  path: string
  content: string
  truncated: boolean
}

interface CodebaseContext {
  files: FileContext[]
  projectStructure: string
  totalSize: number
}

/**
 * Get the project directory structure (top 3 levels of src/)
 */
export async function getProjectStructure(): Promise<string> {
  try {
    const { stdout } = await execAsync(
      'find src -type f -name "*.ts" -o -name "*.tsx" | head -100 | sort',
      { cwd: PROJECT_ROOT, maxBuffer: 1024 * 1024 }
    )

    // Group by directory
    const files = stdout.trim().split('\n').filter(Boolean)
    const dirs = new Map<string, string[]>()

    for (const file of files) {
      const dir = path.dirname(file)
      if (!dirs.has(dir)) {
        dirs.set(dir, [])
      }
      dirs.get(dir)!.push(path.basename(file))
    }

    // Format as tree
    const lines: string[] = ['src/']
    const sortedDirs = Array.from(dirs.keys()).sort()

    for (const dir of sortedDirs.slice(0, 30)) {
      const depth = dir.split('/').length - 1
      const indent = '  '.repeat(depth)
      const dirName = dir.split('/').pop()
      lines.push(`${indent}${dirName}/`)

      const dirFiles = dirs.get(dir)!
      for (const file of dirFiles.slice(0, 5)) {
        lines.push(`${indent}  ${file}`)
      }
      if (dirFiles.length > 5) {
        lines.push(`${indent}  ... +${dirFiles.length - 5} more files`)
      }
    }

    return lines.join('\n')
  } catch (error) {
    log.error('Failed to get project structure', error)
    return 'Unable to fetch project structure'
  }
}

/**
 * Read a source file with size limits
 */
async function readSourceFile(filePath: string): Promise<FileContext | null> {
  try {
    // Normalize path and ensure it's within project
    const normalizedPath = filePath.startsWith('src/') ? filePath : `src/${filePath}`
    const fullPath = path.join(PROJECT_ROOT, normalizedPath)

    // Security: ensure path is within project
    const realPath = await fs.realpath(fullPath).catch(() => null)
    if (!realPath || !realPath.startsWith(PROJECT_ROOT)) {
      return null
    }

    // Check file exists and size
    const stats = await fs.stat(fullPath).catch(() => null)
    if (!stats || !stats.isFile()) {
      return null
    }

    let content = await fs.readFile(fullPath, 'utf-8')
    let truncated = false

    if (content.length > AI.MAX_FILE_SIZE) {
      content = content.slice(0, AI.MAX_FILE_SIZE) + '\n\n... [truncated]'
      truncated = true
    }

    return {
      path: normalizedPath,
      content,
      truncated,
    }
  } catch (error) {
    log.error(`Failed to read file ${filePath}`, error)
    return null
  }
}

/**
 * Search for files matching a pattern using grep (fallback from git grep)
 */
async function searchFiles(pattern: string, limit: number = AI.SEARCH_FILE_LIMIT): Promise<string[]> {
  try {
    // First try git grep, then fall back to grep
    const { stdout } = await execAsync(
      `(git grep -l "${pattern.replace(/"/g, '\\"')}" -- "src/**/*.ts" "src/**/*.tsx" 2>/dev/null || grep -rl "${pattern.replace(/"/g, '\\"')}" src --include="*.ts" --include="*.tsx" 2>/dev/null) | head -${limit}`,
      { cwd: PROJECT_ROOT, maxBuffer: 1024 * 1024 }
    )

    return stdout.trim().split('\n').filter(Boolean)
  } catch {
    // grep returns non-zero if no matches
    return []
  }
}

/**
 * Find files related to a page URL
 */
function inferFilesFromUrl(pageUrl: string): string[] {
  const files: string[] = []

  try {
    const url = new URL(pageUrl)
    const pathname = url.pathname

    // Remove leading slash and map to app directory
    const routePath = pathname.replace(/^\//, '')

    if (routePath) {
      // Try common patterns
      files.push(`src/app/(dashboard)/${routePath}/page.tsx`)
      files.push(`src/app/${routePath}/page.tsx`)

      // If it has an ID segment like /partners/[id]
      const segments = routePath.split('/')
      if (segments.length > 1) {
        const baseRoute = segments[0]
        files.push(`src/app/(dashboard)/${baseRoute}/[id]/page.tsx`)
        files.push(`src/components/${baseRoute}/`)
      }
    }
  } catch {
    // Invalid URL, skip
  }

  return files
}

/**
 * Get codebase context for a bug report
 */
export async function getCodebaseContextForBug(options: {
  pageUrl?: string
  errorStack?: string
  description?: string
  affectedFiles?: string[]
}): Promise<CodebaseContext> {
  const { pageUrl, errorStack, description, affectedFiles = [] } = options

  const filesToRead = new Set<string>()

  log.info('Getting context for bug', {
    hasPageUrl: !!pageUrl,
    hasErrorStack: !!errorStack,
    descriptionLength: description?.length || 0,
    affectedFilesCount: affectedFiles.length,
  })

  // 1. Add explicitly mentioned files
  for (const file of affectedFiles) {
    if (file.startsWith('src/') || file.includes('.ts')) {
      filesToRead.add(file)
    }
  }

  // 2. Extract files from error stack
  if (errorStack) {
    const stackFileRegex = /(?:src\/[^\s:)]+\.tsx?)/g
    const matches = errorStack.match(stackFileRegex) || []
    for (const match of matches.slice(0, 5)) {
      filesToRead.add(match)
    }
  }

  // 3. Infer files from page URL
  if (pageUrl) {
    for (const file of inferFilesFromUrl(pageUrl)) {
      filesToRead.add(file)
    }
  }

  // 4. Search for keywords in description
  if (description) {
    // Extract potential component/function names (PascalCase or camelCase words)
    const keywords = description.match(/\b[A-Z][a-zA-Z]+(?:Modal|Button|Card|Form|List|Table|Dialog)?\b/g) || []

    for (const keyword of keywords.slice(0, 3)) {
      try {
        const searchResults = await searchFiles(keyword, 2)
        for (const file of searchResults) {
          filesToRead.add(file)
        }
      } catch (error) {
        log.error(`Search failed for ${keyword}`, error)
      }
    }
  }

  // Read the files
  const files: FileContext[] = []
  let totalSize = 0
  const filesToReadArray = Array.from(filesToRead)

  log.debug(`Files to read: ${filesToReadArray.length}`)

  for (const filePath of filesToReadArray) {
    if (totalSize >= AI.MAX_TOTAL_CONTEXT) break

    try {
      const fileContext = await readSourceFile(filePath)
      if (fileContext) {
        files.push(fileContext)
        totalSize += fileContext.content.length
      }
    } catch (error) {
      log.error(`Failed to read ${filePath}`, error)
    }
  }

  // Get project structure
  let projectStructure = ''
  try {
    projectStructure = await getProjectStructure()
  } catch (error) {
    log.error('Failed to get project structure', error)
    projectStructure = 'Unable to fetch project structure'
  }

  log.info('Context ready', { fileCount: files.length, totalSize })

  return {
    files,
    projectStructure,
    totalSize,
  }
}

/**
 * Get codebase context for a feature request
 */
export async function getCodebaseContextForFeature(options: {
  pageUrl?: string
  description?: string
  relatedFeatures?: string[]
}): Promise<CodebaseContext> {
  const { pageUrl, description, relatedFeatures = [] } = options

  const filesToRead = new Set<string>()

  // 1. Infer from page URL
  if (pageUrl) {
    for (const file of inferFilesFromUrl(pageUrl)) {
      filesToRead.add(file)
    }
  }

  // 2. Search for related feature implementations
  for (const feature of relatedFeatures) {
    const searchResults = await searchFiles(feature, 2)
    for (const file of searchResults) {
      filesToRead.add(file)
    }
  }

  // 3. Search for keywords in description
  if (description) {
    // Extract feature-related keywords
    const keywords = description.match(/\b(?:add|create|implement|build)\s+(\w+)/gi) || []

    for (const match of keywords.slice(0, 3)) {
      const keyword = match.split(/\s+/).pop()
      if (keyword && keyword.length > 3) {
        const searchResults = await searchFiles(keyword, 2)
        for (const file of searchResults) {
          filesToRead.add(file)
        }
      }
    }

    // Look for existing similar components
    const componentKeywords = description.match(/\b[A-Z][a-zA-Z]+(?:Modal|Button|Card|Form|List|Table|Dialog|Page)?\b/g) || []
    for (const keyword of componentKeywords.slice(0, 3)) {
      const searchResults = await searchFiles(keyword, 2)
      for (const file of searchResults) {
        filesToRead.add(file)
      }
    }
  }

  // Always include some key reference files
  const referenceFiles = [
    'src/lib/entity-fields/index.ts',
    'src/types/entities.ts',
  ]
  for (const file of referenceFiles) {
    filesToRead.add(file)
  }

  // Read the files
  const files: FileContext[] = []
  let totalSize = 0
  const filesToReadArray = Array.from(filesToRead)

  for (const filePath of filesToReadArray) {
    if (totalSize >= AI.MAX_TOTAL_CONTEXT) break

    const fileContext = await readSourceFile(filePath)
    if (fileContext) {
      files.push(fileContext)
      totalSize += fileContext.content.length
    }
  }

  // Get project structure
  const projectStructure = await getProjectStructure()

  return {
    files,
    projectStructure,
    totalSize,
  }
}

/**
 * Format codebase context for inclusion in AI prompt
 */
export function formatContextForPrompt(context: CodebaseContext): string {
  const parts: string[] = []

  parts.push(`## Project Structure\n\`\`\`\n${context.projectStructure}\n\`\`\``)

  if (context.files.length > 0) {
    parts.push(`\n## Relevant Source Files (${context.files.length} files, ${Math.round(context.totalSize / 1024)}KB)`)

    for (const file of context.files) {
      parts.push(`\n### ${file.path}${file.truncated ? ' (truncated)' : ''}\n\`\`\`typescript\n${file.content}\n\`\`\``)
    }
  }

  return parts.join('\n')
}
