import Image from 'next/image'

interface XeroIconProps {
  className?: string
}

export function XeroIcon({ className }: XeroIconProps) {
  return (
    <Image
      src="/brand-icons/xero.png"
      alt=""
      aria-hidden="true"
      width={48}
      height={48}
      className={className}
      draggable={false}
    />
  )
}
