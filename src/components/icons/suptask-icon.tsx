/**
 * SupTask-style icon for placeholder connector card.
 * Self-contained SVG for reliable local rendering.
 */

interface SupTaskIconProps {
  className?: string
}

export function SupTaskIcon({ className }: SupTaskIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      fill="none"
    >
      <rect x="1.5" y="1.5" width="21" height="21" rx="6" fill="#1E293B" />
      <path
        d="M7.2 12.2 10.1 15 16.8 8.5"
        stroke="#22D3EE"
        strokeWidth="2.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="1.5" y="1.5" width="21" height="21" rx="6" stroke="#334155" strokeWidth="1.2" />
    </svg>
  )
}

