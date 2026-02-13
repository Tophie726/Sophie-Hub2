import Image from 'next/image'

interface ZohoIconProps {
  className?: string
}

export function ZohoIcon({ className }: ZohoIconProps) {
  return (
    <Image
      src="/brand-icons/zoho.png"
      alt=""
      aria-hidden="true"
      width={48}
      height={48}
      className={className}
      draggable={false}
    />
  )
}
