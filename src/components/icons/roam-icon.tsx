/**
 * Ro.am favicon-style icon for connector cards.
 * Uses a self-contained SVG so it renders reliably without external asset loading.
 */

interface RoamIconProps {
  className?: string
}

export function RoamIcon({ className }: RoamIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      fill="none"
    >
      <circle cx="12" cy="12" r="11" fill="#12131A" />
      <circle cx="12" cy="12" r="8.8" stroke="#8D94A8" strokeWidth="1.35" />
      <circle cx="12" cy="12" r="6.2" stroke="#B3BACD" strokeWidth="1.25" />
      <circle cx="12" cy="12" r="3.5" stroke="#D7DCEA" strokeWidth="1.15" />
      <circle cx="12" cy="12" r="1.2" fill="#F3F5FB" />
    </svg>
  )
}
