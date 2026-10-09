import React from 'react'
import { NavLink } from 'react-router-dom'
import { NAV_ITEMS } from '../navigation'
import { brandAssets } from '../visualAssets'

export const DesktopNav: React.FC = () => {
  return (
    <aside
      aria-label="Thanh điều hướng bên"
      className="hidden lg:flex flex-col w-60 shrink-0 bg-white border-r border-slate-200 min-h-screen sticky top-0 h-screen select-none z-20"
    >
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-100 flex items-center gap-3">
        <img src={brandAssets.mark} alt="" aria-hidden="true" width="40" height="40" className="w-10 h-10 shrink-0" />
        <div className="min-w-0">
          <div className="font-bold text-slate-900 text-base leading-tight tracking-tight">VƯỜN ƯƠM</div>
          <div className="text-[11px] text-slate-500 truncate">Sổ cây giống</div>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm transition-colors ${
                  isActive
                    ? 'bg-emerald-50 text-emerald-800 font-bold shadow-xs'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 active:bg-slate-100 font-medium'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={`w-5 h-5 shrink-0 ${
                      isActive ? 'text-emerald-700 stroke-[2.4]' : 'text-slate-400 stroke-[1.8]'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </>
              )}
            </NavLink>
          )
        })}
      </nav>

      {/* Footer Info */}
      <div className="p-4 border-t border-slate-100 text-[11px] text-slate-400 space-y-1">
        <div className="flex items-center justify-between">
          <span>Bản thử nghiệm PWA</span>
          <span className="font-semibold text-slate-500">AGPL-3.0</span>
        </div>
        <a
          href="https://github.com/17thedevv/VuonUomSo"
          target="_blank"
          rel="noreferrer"
          className="text-emerald-700 hover:underline block truncate font-medium"
        >
          Mã nguồn dự án (Source)
        </a>
      </div>
    </aside>
  )
}
