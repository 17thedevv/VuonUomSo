import React from 'react'
import { AlertTriangle } from 'lucide-react'

export interface AttentionNoticeProps {
  title: string
  description?: string
  onClick?: () => void
  className?: string
}

export const AttentionNotice: React.FC<AttentionNoticeProps> = ({
  title,
  description,
  onClick,
  className = ''
}) => {
  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={`bg-amber-50/90 border border-amber-200 text-amber-950 p-3.5 rounded-xl flex items-start gap-3 transition-colors ${
        onClick ? 'cursor-pointer hover:bg-amber-100/80 active:bg-amber-100' : ''
      } ${className}`}
    >
      <div className="w-5 h-5 rounded-full bg-amber-200/80 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
        <AlertTriangle className="w-3.5 h-3.5 stroke-[2.5]" />
      </div>
      <div className="min-w-0 flex-1 text-xs">
        <div className="font-bold text-amber-950 leading-snug">{title}</div>
        {description && (
          <div className="text-amber-800/90 mt-0.5 leading-relaxed">{description}</div>
        )}
      </div>
    </div>
  )
}
