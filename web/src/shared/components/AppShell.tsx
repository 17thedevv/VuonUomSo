import React from 'react'
import { BottomNav } from './BottomNav'
import { OfflineBadge } from './OfflineBadge'
import { UndoBanner } from './UndoBanner'

export interface AppShellProps {
  children: React.ReactNode
  hideBottomNav?: boolean
}

export const AppShell: React.FC<AppShellProps> = ({ children, hideBottomNav = false }) => {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
      <OfflineBadge />
      <main className={`flex-1 flex flex-col ${hideBottomNav ? 'pb-6' : 'pb-20'}`}>
        {children}
      </main>
      <UndoBanner />
      {!hideBottomNav && <BottomNav />}
    </div>
  )
}
