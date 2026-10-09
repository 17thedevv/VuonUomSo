import React from 'react'
import { Inbox } from 'lucide-react'
import { PrimaryButton } from './PrimaryButton'
import { emptyStateIllustrations, type EmptyStateIllustration } from '../visualAssets'

export interface EmptyStateProps {
  title: string
  description?: string
  actionText?: string
  onAction?: () => void
  icon?: React.ComponentType<{ className?: string }>
  illustration?: EmptyStateIllustration
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  actionText,
  onAction,
  icon: Icon = Inbox,
  illustration
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center bg-white rounded-2xl border border-slate-200 my-4">
      {illustration ? (
        <img src={emptyStateIllustrations[illustration]} alt="" aria-hidden="true"
          width="640" height="420" className="w-48 max-w-full h-auto mb-3" />
      ) : (
        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 mb-3">
          <Icon className="w-6 h-6" />
        </div>
      )}
      <h3 className="text-base font-semibold text-slate-800">{title}</h3>
      {description && <p className="text-sm text-slate-500 mt-1 max-w-xs">{description}</p>}
      {actionText && onAction && (
        <div className="mt-4 w-full max-w-xs">
          <PrimaryButton onClick={onAction}>{actionText}</PrimaryButton>
        </div>
      )}
    </div>
  )
}
