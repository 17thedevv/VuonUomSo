import React from 'react'

export interface SectionHeaderProps {
  title: string
  action?: React.ReactNode
  className?: string
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  action,
  className = ''
}) => {
  return (
    <div className={`flex items-center justify-between mb-2.5 ${className}`}>
      <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
        {title}
      </h2>
      {action && <div>{action}</div>}
    </div>
  )
}
