import type React from 'react'
import { createElement } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { AssetIcon } from './components/AssetIcon'

export interface NavItem {
  to: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/today', label: 'Hôm nay', icon: ({ className }) => createElement(AssetIcon, { name: 'calendar', className }) },
  { to: '/batches', label: 'Lô cây', icon: ({ className }) => createElement(AssetIcon, { name: 'lot', className }) },
  { to: '/orders', label: 'Đơn hàng', icon: ({ className }) => createElement(AssetIcon, { name: 'checklist', className }) },
  { to: '/more', label: 'Thêm', icon: MoreHorizontal }
]
