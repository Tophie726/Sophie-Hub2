import Image from 'next/image'

interface GoogleFormsIconProps {
  className?: string
}

export function GoogleFormsIcon({ className }: GoogleFormsIconProps) {
  return (
    <Image
      src="/brand-icons/google-forms.png"
      alt=""
      aria-hidden="true"
      width={96}
      height={96}
      className={className}
      draggable={false}
    />
  )
}
