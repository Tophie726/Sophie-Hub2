/**
 * Structured Logger
 *
 * Simple, zero-dependency logger for Sophie Hub.
 * - Dev: colorized console output with timestamps
 * - Production: JSON structured output for log aggregation
 */

// =============================================================================
// Types
// =============================================================================

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
  level: LogLevel
  message: string
  name: string
  timestamp: string
  data?: unknown
}

// =============================================================================
// Level Config
// =============================================================================

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: '\x1b[90m',   // gray
  info: '\x1b[36m',    // cyan
  warn: '\x1b[33m',    // yellow
  error: '\x1b[31m',   // red
}

const RESET = '\x1b[0m'
const BOLD = '\x1b[1m'
const DIM = '\x1b[2m'

// =============================================================================
// Environment Detection
// =============================================================================

const isDev = process.env.NODE_ENV !== 'production'
const minLevel: LogLevel = isDev ? 'debug' : 'info'

// =============================================================================
// Logger Class
// =============================================================================

class Logger {
  private name: string

  constructor(name: string) {
    this.name = name
  }

  child(childName: string): Logger {
    return new Logger(`${this.name}:${childName}`)
  }

  debug(message: string, data?: unknown): void {
    this.log('debug', message, data)
  }

  info(message: string, data?: unknown): void {
    this.log('info', message, data)
  }

  warn(message: string, data?: unknown): void {
    this.log('warn', message, data)
  }

  error(message: string, data?: unknown): void {
    this.log('error', message, data)
  }

  private log(level: LogLevel, message: string, data?: unknown): void {
    if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[minLevel]) return

    const entry: LogEntry = {
      level,
      message,
      name: this.name,
      timestamp: new Date().toISOString(),
      ...(data !== undefined ? { data } : {}),
    }

    if (isDev) {
      this.devOutput(entry)
    } else {
      this.jsonOutput(entry)
    }
  }

  private devOutput(entry: LogEntry): void {
    const color = LEVEL_COLORS[entry.level]
    const time = entry.timestamp.split('T')[1].replace('Z', '')
    const prefix = `${DIM}${time}${RESET} ${color}${entry.level.toUpperCase().padEnd(5)}${RESET} ${BOLD}[${entry.name}]${RESET}`

    const consoleFn = entry.level === 'error' ? console.error
      : entry.level === 'warn' ? console.warn
      : console.log

    if (entry.data !== undefined) {
      consoleFn(`${prefix} ${entry.message}`, entry.data)
    } else {
      consoleFn(`${prefix} ${entry.message}`)
    }
  }

  private jsonOutput(entry: LogEntry): void {
    const consoleFn = entry.level === 'error' ? console.error
      : entry.level === 'warn' ? console.warn
      : console.log

    consoleFn(JSON.stringify(entry))
  }
}

// =============================================================================
// Factory & Exports
// =============================================================================

export function createLogger(name: string): Logger {
  return new Logger(name)
}

export const logger = createLogger('sophie-hub')
