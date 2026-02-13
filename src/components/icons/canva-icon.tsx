import Image from 'next/image'

interface CanvaIconProps {
  className?: string
}

export function CanvaIcon({ className }: CanvaIconProps) {
  return (
    <Image
      src="/brand-icons/canva.png"
      alt=""
      aria-hidden="true"
      width={32}
      height={32}
      className={className}
      draggable={false}
    />
  )
}
