import Image from 'next/image'

/**
 * Official Notion logo for connector card usage.
 * Uses a local static asset copied from the canonical brand icon set.
 */

interface NotionIconProps {
  className?: string
}

export function NotionIcon({ className }: NotionIconProps) {
  return (
    <Image
      src="/brand-icons/notion.svg"
      alt=""
      aria-hidden="true"
      width={24}
      height={24}
      className={className}
      draggable={false}
    />
  )
}
