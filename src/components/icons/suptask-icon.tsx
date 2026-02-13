import Image from 'next/image'

/**
 * Official SupTask app icon for connector card usage.
 * Uses a local static asset copied from SupTask website assets.
 */

interface SupTaskIconProps {
  className?: string
}

export function SupTaskIcon({ className }: SupTaskIconProps) {
  return (
    <Image
      src="/brand-icons/suptask-icon.png"
      alt=""
      aria-hidden="true"
      width={256}
      height={256}
      className={className}
      draggable={false}
    />
  )
}
