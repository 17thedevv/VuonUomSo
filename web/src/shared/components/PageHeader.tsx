import React from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export interface PageHeaderProps {
  title: string
  subtitle?: string
  backTo?: string
  showBack?: boolean
  rightAction?: React.ReactNode
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  backTo,
  showBack = false,
  rightAction
}) => {
  const navigate = useNavigate()

  return (
    <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-xs border-b border-slate-200 px-4 sm:px-6 py-3">
      <div className="max-w-6xl mx-auto w-full flex items-center justify-between min-h-[44px]">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {showBack && (
            <button
              type="button"
              onClick={() => (backTo ? navigate(backTo) : navigate(-1))}
              className="w-10 h-10 flex items-center justify-center -ml-2 rounded-lg text-slate-600 hover:bg-slate-100 active:bg-slate-200"
              aria-label="Quay lại"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold text-slate-900 truncate leading-tight">{title}</h1>
            {subtitle && <p className="text-xs text-slate-500 truncate mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {rightAction && <div className="shrink-0 ml-2">{rightAction}</div>}
      </div>
    </header>
  )
}
