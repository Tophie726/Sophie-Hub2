import Image from 'next/image'

/**
 * Official Ro.am symbol icon for connector card usage.
 * Uses a local static asset copied from Ro.am website assets.
 */

interface RoamIconProps {
  className?: string
}

export function RoamIcon({ className }: RoamIconProps) {
  return (
    <Image
      src="/brand-icons/roam.svg"
      alt=""
      aria-hidden="true"
      width={60}
      height={60}
      className={className}
      draggable={false}
    />
  )
}
