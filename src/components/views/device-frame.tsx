'use client'

import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PreviewMode = 'desktop' | 'tablet' | 'mobile'
export type TabletOrientation = 'portrait' | 'landscape'

interface DeviceFrameProps {
  mode: PreviewMode
  tabletOrientation?: TabletOrientation
  isFullscreen: boolean
  children: React.ReactNode
}

// ---------------------------------------------------------------------------
// Device Frame Component
//
// Wraps content (typically an iframe) in a device-shaped chrome with
// appropriate dimensions, rounded corners, and status bar notch.
// Pattern reused from dashboard-builder.tsx device preview.
// ---------------------------------------------------------------------------

export function DeviceFrame({
  mode,
  tabletOrientation = 'portrait',
  isFullscreen,
  children,
}: DeviceFrameProps) {
  const isDevicePreview = mode !== 'desktop'
  const isTabletLandscape = mode === 'tablet' && tabletOrientation === 'landscape'

  if (!isDevicePreview) {
    // Desktop: full-width, no frame
    return (
      <div className="w-full h-full">
        {children}
      </div>
    )
  }

  const maxHeight = isFullscreen ? 'calc(100vh - 3.5rem)' : 'calc(100vh - 8rem)'

  return (
    <div className="flex justify-center py-4 h-full">
      <div
        className={cn(
          'w-full bg-background overflow-hidden flex flex-col transition-all duration-200',
        )}
        style={{
          width: mode === 'mobile' ? 375 : isTabletLandscape ? 1024 : 768,
          maxWidth: '100%',
          maxHeight,
          borderRadius: mode === 'mobile' ? '2rem' : '1.25rem',
          boxShadow: '0 0 0 8px rgba(0,0,0,0.06), 0 25px 60px rgba(0,0,0,0.10)',
        }}
      >
        {/* Status bar notch */}
        <div className="flex-none flex justify-center bg-background pb-1 pt-2">
          <div
            className="rounded-full bg-muted-foreground/20"
            style={{ width: mode === 'mobile' ? 80 : isTabletLandscape ? 56 : 40, height: 4 }}
          />
        </div>

        {/* Content area fills remaining space */}
        <div className="flex-1 overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  )
}
