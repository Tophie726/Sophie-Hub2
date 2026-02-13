import Image from 'next/image'

interface BigQueryIconProps {
  className?: string
}

export function BigQueryIcon({ className }: BigQueryIconProps) {
  return (
    <Image
      src="/brand-icons/bigquery.svg"
      alt=""
      aria-hidden="true"
      width={24}
      height={24}
      className={className}
      draggable={false}
    />
  )
}
