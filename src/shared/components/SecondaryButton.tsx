import React from 'react'

export interface SecondaryButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  fullWidth?: boolean
  children: React.ReactNode
}

export const SecondaryButton: React.FC<SecondaryButtonProps> = ({
  fullWidth = false,
  children,
  className = '',
  disabled,
  ...props
}) => {
  return (
    <button
      {...props}
      disabled={disabled}
      className={`min-h-[48px] px-5 py-3 rounded-xl bg-white border border-slate-300 text-slate-700 font-medium text-base transition-colors duration-150 flex items-center justify-center gap-2 hover:bg-slate-50 active:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed ${
        fullWidth ? 'w-full' : ''
      } ${className}`}
    >
      {children}
    </button>
  )
}
