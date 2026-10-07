import React from 'react'
import { BottomNav } from './BottomNav'
import { DesktopNav } from './DesktopNav'
import { OfflineBadge } from './OfflineBadge'
import { UndoBanner } from './UndoBanner'

export interface AppShellProps {
  children: React.ReactNode
  hideBottomNav?: boolean
  hideMobileNavOnly?: boolean
}

export const AppShell: React.FC<AppShellProps> = ({
  children,
  hideBottomNav = false,
  hideMobileNavOnly = false
}) => {
  const shouldHideMobileNav = hideBottomNav || hideMobileNavOnly
  const shouldHideDesktopNav = hideBottomNav

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
      <OfflineBadge />
      <div className="flex-1 flex flex-col lg:flex-row min-w-0">
        {!shouldHideDesktopNav && <DesktopNav />}
        <main className={`flex-1 min-w-0 flex flex-col ${shouldHideMobileNav ? 'pb-6' : 'pb-20'} lg:pb-0`}>
          {children}
        </main>
      </div>
      <UndoBanner />
      {!shouldHideMobileNav && <BottomNav />}
    </div>
  )
}
