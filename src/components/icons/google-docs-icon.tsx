import Image from 'next/image'

interface GoogleDocsIconProps {
  className?: string
}

export function GoogleDocsIcon({ className }: GoogleDocsIconProps) {
  return (
    <Image
      src="/brand-icons/google-docs.png"
      alt=""
      aria-hidden="true"
      width={96}
      height={96}
      className={className}
      draggable={false}
    />
  )
}
