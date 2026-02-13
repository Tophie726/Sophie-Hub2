import Image from 'next/image'

interface TeamtailorIconProps {
  className?: string
}

export function TeamtailorIcon({ className }: TeamtailorIconProps) {
  return (
    <Image
      src="/brand-icons/teamtailor.svg"
      alt=""
      aria-hidden="true"
      width={48}
      height={48}
      className={className}
      draggable={false}
    />
  )
}
