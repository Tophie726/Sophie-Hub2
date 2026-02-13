import Image from 'next/image'

/**
 * Official Close logo atom for connector card usage.
 * Uses a local static asset copied from Close brand resources.
 */

interface CloseIconProps {
  className?: string
}

export function CloseIcon({ className }: CloseIconProps) {
  return (
    <Image
      src="/brand-icons/close-logo-color-atom.svg"
      alt=""
      aria-hidden="true"
      width={32}
      height={32}
      className={className}
      draggable={false}
    />
  )
}
