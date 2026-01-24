'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useSession, signIn } from 'next-auth/react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Search,
  FileSpreadsheet,
  Loader2,
  Clock,
  User,
  ChevronRight,
  LogIn,
  RefreshCw,
} from 'lucide-react'

interface GoogleSheet {
  id: string
  name: string
  url: string
  modifiedTime: string
  owner?: string
}

interface SheetSearchModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectSheet: (sheet: GoogleSheet) => void
}

export function SheetSearchModal({
  open,
  onOpenChange,
  onSelectSheet,
}: SheetSearchModalProps) {
  const { data: session, status } = useSession()
  const [query, setQuery] = useState('')
  const [sheets, setSheets] = useState<GoogleSheet[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const searchSheets = useCallback(async (searchQuery: string) => {
    if (!session?.accessToken) return

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(
        `/api/sheets/search?q=${encodeURIComponent(searchQuery)}`
      )
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to search sheets')
      }

      setSheets(data.sheets)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }, [session?.accessToken])

  // Fetch recent sheets on mount when authenticated
  useEffect(() => {
    if (open && session?.accessToken && sheets.length === 0) {
      searchSheets('')
    }
  }, [open, session?.accessToken, sheets.length, searchSheets])

  // Debounced search
  useEffect(() => {
    if (!session?.accessToken) return

    const timer = setTimeout(() => {
      searchSheets(query)
    }, 300)

    return () => clearTimeout(timer)
  }, [query, session?.accessToken, searchSheets])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    return date.toLocaleDateString()
  }

  const handleConnectGoogle = () => {
    signIn('google', { callbackUrl: `${window.location.origin}/admin/data-enrichment` })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-green-600" />
            Search Google Sheets
          </DialogTitle>
          <DialogDescription>
            Find and connect a spreadsheet from your Google Drive
          </DialogDescription>
        </DialogHeader>

        {status === 'loading' ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !session ? (
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/10 mb-4">
              <LogIn className="h-7 w-7 text-blue-500" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Connect Google Account</h3>
            <p className="text-muted-foreground text-center mb-6 max-w-sm">
              Sign in with Google to access your spreadsheets from Google Drive
            </p>
            <Button onClick={handleConnectGoogle} className="gap-2">
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continue with Google
            </Button>
          </div>
        ) : (
          <>
            <div className="p-4 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search your spreadsheets..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-9"
                  autoFocus
                />
                <Loader2
                  className={`absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground transition-opacity ${
                    isLoading ? 'opacity-100' : 'opacity-0'
                  }`}
                />
              </div>
            </div>

            <ScrollArea className="flex-1 max-h-[400px]">
              {error ? (
                <div className="flex flex-col items-center justify-center py-12 px-6">
                  <p className="text-destructive text-sm mb-4">{error}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => searchSheets(query)}
                    className="gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Try Again
                  </Button>
                </div>
              ) : sheets.length === 0 && !isLoading ? (
                <div className="flex flex-col items-center justify-center py-12 px-6">
                  <FileSpreadsheet className="h-10 w-10 text-muted-foreground mb-3" />
                  <p className="text-muted-foreground text-sm">
                    {query
                      ? 'No spreadsheets found matching your search'
                      : 'No spreadsheets found in your Drive'}
                  </p>
                </div>
              ) : (
                <div className="p-2">
                  {sheets.map((sheet) => (
                    <motion.button
                      key={sheet.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.15 }}
                      onClick={() => {
                        onSelectSheet(sheet)
                        onOpenChange(false)
                      }}
                      className="w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors hover:bg-accent group"
                    >
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10 shrink-0">
                          <FileSpreadsheet className="h-5 w-5 text-green-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{sheet.name}</p>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDate(sheet.modifiedTime)}
                            </span>
                            {sheet.owner && (
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {sheet.owner}
                              </span>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </motion.button>
                    ))}
                </div>
              )}
            </ScrollArea>

            <div className="p-4 border-t bg-muted/30">
              <p className="text-xs text-muted-foreground text-center">
                Showing recent spreadsheets from your Google Drive
              </p>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
