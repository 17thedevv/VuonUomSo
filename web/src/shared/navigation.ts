import type React from 'react'
import { CalendarDays, Trees, ClipboardList, MoreHorizontal } from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/today', label: 'Hôm nay', icon: CalendarDays },
  { to: '/garden', label: 'Vườn', icon: Trees },
  { to: '/orders', label: 'Đơn', icon: ClipboardList },
  { to: '/more', label: 'Thêm', icon: MoreHorizontal }
]
