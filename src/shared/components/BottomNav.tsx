import React from 'react'
import { NavLink } from 'react-router-dom'
import { CalendarDays, Trees, ClipboardList, MoreHorizontal } from 'lucide-react'

interface NavItem {
  to: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const navItems: NavItem[] = [
  { to: '/today', label: 'Hôm nay', icon: CalendarDays },
  { to: '/batches', label: 'Lô cây', icon: Trees },
  { to: '/orders', label: 'Đơn hàng', icon: ClipboardList },
  { to: '/more', label: 'Thêm', icon: MoreHorizontal }
]

export const BottomNav: React.FC = () => {
  return (
    <nav
      aria-label="Điều hướng chính"
      className="fixed bottom-0 left-0 right-0 z-30 mx-auto max-w-[440px] bg-white border-t border-slate-200 px-2 py-1 shadow-lg"
    >
      <div className="flex items-center justify-around h-[58px]">
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center flex-1 h-full min-w-[64px] min-h-[44px] rounded-lg transition-colors text-xs font-medium ${
                  isActive
                    ? 'text-emerald-700 font-bold'
                    : 'text-slate-500 hover:text-slate-700 active:text-emerald-600'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={`w-5 h-5 mb-1 shrink-0 ${
                      isActive ? 'text-emerald-700 stroke-[2.4]' : 'text-slate-400 stroke-[1.8]'
                    }`}
                  />
                  <span className="leading-none text-[11px]">{item.label}</span>
                </>
              )}
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
