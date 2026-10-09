import { vuonUomIcons } from '../assetIcons'

interface AssetIconProps {
  name: keyof typeof vuonUomIcons
  className?: string
}

/** Decorative icon; the surrounding control supplies its visible label. */
export const AssetIcon = ({ name, className = '' }: AssetIconProps) => {
  const mask = `url("${vuonUomIcons[name]}")`
  return (
    <span
      aria-hidden="true"
      className={`inline-block bg-current ${className}`}
      style={{ maskImage: mask, WebkitMaskImage: mask, maskSize: 'contain',
        maskRepeat: 'no-repeat', maskPosition: 'center' }}
    />
  )
}
