import { useCallback, useRef, useState } from 'react'

interface LongPressOptions {
  threshold?: number // ms to trigger long press
  onLongPress: () => void
  onPress?: () => void // normal tap/click
}

export function useLongPress({ threshold = 500, onLongPress, onPress }: LongPressOptions) {
  const [isLongPress, setIsLongPress] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const isLongPressRef = useRef(false)

  const start = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    // Prevent context menu on mobile
    e.preventDefault()

    isLongPressRef.current = false
    timerRef.current = setTimeout(() => {
      isLongPressRef.current = true
      setIsLongPress(true)
      onLongPress()
      // Haptic feedback if available
      if (navigator.vibrate) {
        navigator.vibrate(50)
      }
    }, threshold)
  }, [onLongPress, threshold])

  const cancel = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }

    // If it wasn't a long press, trigger normal press
    if (!isLongPressRef.current && onPress) {
      onPress()
    }

    setIsLongPress(false)
  }, [onPress])

  const handlers = {
    onTouchStart: start,
    onTouchEnd: cancel,
    onTouchCancel: cancel,
    onMouseDown: start,
    onMouseUp: cancel,
    onMouseLeave: cancel,
  }

  return { handlers, isLongPress }
}
