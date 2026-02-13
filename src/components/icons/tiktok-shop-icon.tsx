import Image from 'next/image'

interface TikTokShopIconProps {
  className?: string
}

export function TikTokShopIcon({ className }: TikTokShopIconProps) {
  return (
    <Image
      src="/brand-icons/tiktok-shop.png"
      alt=""
      aria-hidden="true"
      width={32}
      height={32}
      className={className}
      draggable={false}
    />
  )
}
