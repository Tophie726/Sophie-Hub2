import Image from 'next/image'

interface GoogleSheetsIconProps {
  className?: string
}

export function GoogleSheetsIcon({ className }: GoogleSheetsIconProps) {
  return (
    <Image
      src="/brand-icons/google-sheets.png"
      alt=""
      aria-hidden="true"
      width={96}
      height={96}
      className={className}
      draggable={false}
    />
  )
}
