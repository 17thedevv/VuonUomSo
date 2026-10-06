import React from 'react'

export interface PrimaryButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  fullWidth?: boolean
  children: React.ReactNode
}

export const PrimaryButton: React.FC<PrimaryButtonProps> = ({
  fullWidth = true,
  children,
  className = '',
  disabled,
  ...props
}) => {
  return (
    <button
      {...props}
      disabled={disabled}
      className={`min-h-[48px] px-5 py-3 rounded-xl bg-emerald-700 text-white font-semibold text-base transition-colors duration-150 flex items-center justify-center gap-2 active:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed ${
        fullWidth ? 'w-full' : ''
      } ${className}`}
    >
      {children}
    </button>
  )
}
