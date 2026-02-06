'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { cn } from '@/lib/utils'
import type { SectionWithWidgets } from '@/types/modules'

interface SectionNavProps {
  sections: SectionWithWidgets[]
}

export function SectionNav({ sections }: SectionNavProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const navRef = useRef<HTMLDivElement>(null)

  // IntersectionObserver to detect which section is in view
  useEffect(() => {
    const elements = sections.map((s) => document.getElementById(`section-${s.id}`)).filter(Boolean) as HTMLElement[]
    if (elements.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        // Find the topmost visible section
        let topIndex = -1
        let topY = Infinity

        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = elements.indexOf(entry.target as HTMLElement)
            if (idx >= 0 && entry.boundingClientRect.top < topY) {
              topY = entry.boundingClientRect.top
              topIndex = idx
            }
          }
        }

        if (topIndex >= 0) {
          setActiveIndex(topIndex)
        }
      },
      {
        rootMargin: '-80px 0px -60% 0px',
        threshold: 0,
      }
    )

    for (const el of elements) {
      observer.observe(el)
    }

    return () => observer.disconnect()
  }, [sections])

  const handleClick = useCallback((index: number, sectionId: string) => {
    setActiveIndex(index)
    const el = document.getElementById(`section-${sectionId}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [])

  // Don't show if fewer than 2 sections
  if (sections.length < 2) return null

  return (
    <div
      ref={navRef}
      className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide pb-1 -mb-1"
    >
      {sections.map((section, index) => (
        <button
          key={section.id}
          onClick={() => handleClick(index, section.id)}
          className={cn(
            'flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap active:scale-[0.97]',
            index === activeIndex
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          )}
        >
          {section.title}
          <span className="ml-1.5 text-[10px] opacity-60">
            {section.widgets.length}
          </span>
        </button>
      ))}
    </div>
  )
}
