/**
 * Notion connector icon (compact app-mark style).
 * Self-contained SVG to avoid external asset loading/CSP issues.
 */

interface NotionIconProps {
  className?: string
}

export function NotionIcon({ className }: NotionIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      fill="none"
    >
      <rect x="3" y="3" width="18" height="18" rx="2.4" fill="#FFFFFF" stroke="#111111" strokeWidth="1.6" />
      <path d="M7.8 7.3h2.1l6.2 8.8V7.9h2.1v8.8h-2.1L9.9 8v8.7H7.8z" fill="#111111" />
      <path d="M6 6.9 8 6.3v11.5L6 17.3z" fill="#111111" />
    </svg>
  )
}

