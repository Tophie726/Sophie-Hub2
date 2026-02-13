import Image from 'next/image'

interface DocuSignIconProps {
  className?: string
}

export function DocuSignIcon({ className }: DocuSignIconProps) {
  return (
    <Image
      src="/brand-icons/docusign.png"
      alt=""
      aria-hidden="true"
      width={96}
      height={96}
      className={className}
      draggable={false}
    />
  )
}
