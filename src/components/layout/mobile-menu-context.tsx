'use client'

import { createContext, useContext, useState, useCallback } from 'react'

interface MobileMenuContextValue {
  isOpen: boolean
  toggle: () => void
  open: () => void
  close: () => void
}

const MobileMenuContext = createContext<MobileMenuContextValue | null>(null)

export function MobileMenuProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)

  const toggle = useCallback(() => setIsOpen((prev) => !prev), [])
  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])

  return (
    <MobileMenuContext.Provider value={{ isOpen, toggle, open, close }}>
      {children}
    </MobileMenuContext.Provider>
  )
}

export function useMobileMenu() {
  const context = useContext(MobileMenuContext)
  if (!context) {
    throw new Error('useMobileMenu must be used within a MobileMenuProvider')
  }
  return context
}
