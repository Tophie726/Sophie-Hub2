/**
 * Close.io-style icon for placeholder connector card.
 * Self-contained SVG for reliable local rendering.
 */

interface CloseIconProps {
  className?: string
}

export function CloseIcon({ className }: CloseIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      fill="none"
    >
      <rect x="1.5" y="1.5" width="21" height="21" rx="6" fill="#0B1020" />
      <path
        d="M15.8 8.2a5 5 0 1 0 0 7.6"
        stroke="#60A5FA"
        strokeWidth="2.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="16.7" cy="12" r="1.35" fill="#93C5FD" />
      <rect x="1.5" y="1.5" width="21" height="21" rx="6" stroke="#1F2937" strokeWidth="1.2" />
    </svg>
  )
}

