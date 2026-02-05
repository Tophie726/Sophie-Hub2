'use client'

import { useState, useCallback } from 'react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { X, Check, Loader2 } from 'lucide-react'
import dynamic from 'next/dynamic'

// Dynamically import Excalidraw to avoid SSR issues
const Excalidraw = dynamic(
  async () => {
    const mod = await import('@excalidraw/excalidraw')
    return mod.Excalidraw
  },
  { ssr: false, loading: () => <div className="flex-1 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div> }
)

interface DrawingPadProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (imageDataUrl: string) => void
  /** Optional background image to draw on top of */
  backgroundImage?: string
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function DrawingPad({ open, onOpenChange, onSave, backgroundImage }: DrawingPadProps) {
  const { resolvedTheme } = useTheme()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null)
  const [exporting, setExporting] = useState(false)

  const handleSave = useCallback(async () => {
    if (!excalidrawAPI) return

    setExporting(true)
    try {
      const { exportToBlob } = await import('@excalidraw/excalidraw')

      const elements = excalidrawAPI.getSceneElements()
      const appState = excalidrawAPI.getAppState()
      const files = excalidrawAPI.getFiles()

      if (elements.length === 0) {
        // No elements drawn, just close
        onOpenChange(false)
        return
      }

      const blob = await exportToBlob({
        elements,
        appState: {
          ...appState,
          exportWithDarkMode: resolvedTheme === 'dark',
          exportBackground: true,
        },
        files,
        mimeType: 'image/png',
        quality: 1,
      })

      // Convert blob to data URL
      const reader = new FileReader()
      reader.onloadend = () => {
        const dataUrl = reader.result as string
        onSave(dataUrl)
        onOpenChange(false)
      }
      reader.readAsDataURL(blob)
    } catch (error) {
      console.error('Failed to export drawing:', error)
    } finally {
      setExporting(false)
    }
  }, [excalidrawAPI, onSave, onOpenChange, resolvedTheme])

  const handleCancel = useCallback(() => {
    onOpenChange(false)
  }, [onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] md:max-w-[900px] h-[85vh] p-0 gap-0 overflow-hidden flex flex-col">
        <DialogHeader className="px-4 py-3 border-b flex-row items-center justify-between space-y-0 shrink-0">
          <DialogTitle className="text-base">Sketch your idea</DialogTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              className="h-8"
            >
              <X className="h-4 w-4 mr-1" />
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={exporting}
              className="h-8"
            >
              {exporting ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-1" />
              )}
              Add to comment
            </Button>
          </div>
        </DialogHeader>

        {/* Excalidraw Canvas */}
        <div className="flex-1 relative">
          {open && (
            <Excalidraw
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              excalidrawAPI={(api: any) => setExcalidrawAPI(api)}
              theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
              initialData={{
                appState: {
                  viewBackgroundColor: resolvedTheme === 'dark' ? '#1e1e1e' : '#ffffff',
                  currentItemStrokeColor: resolvedTheme === 'dark' ? '#ffffff' : '#000000',
                },
              }}
              UIOptions={{
                canvasActions: {
                  saveAsImage: false,
                  loadScene: false,
                  export: false,
                  saveToActiveFile: false,
                },
              }}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
