import Image from 'next/image'

interface SignWellIconProps {
  className?: string
}

export function SignWellIcon({ className }: SignWellIconProps) {
  return (
    <Image
      src="/brand-icons/signwell.png"
      alt=""
      aria-hidden="true"
      width={48}
      height={48}
      className={className}
      draggable={false}
    />
  )
}
