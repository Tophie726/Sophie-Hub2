import Image from 'next/image'

interface GoogleWorkspaceIconProps {
  className?: string
}

export function GoogleWorkspaceIcon({ className }: GoogleWorkspaceIconProps) {
  return (
    <Image
      src="/brand-icons/google-workspace-admin.png"
      alt=""
      aria-hidden="true"
      width={96}
      height={96}
      className={className}
      draggable={false}
    />
  )
}
