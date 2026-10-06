import type React from 'react'
import { CalendarDays, Trees, ClipboardList, MoreHorizontal } from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/today', label: 'Hôm nay', icon: CalendarDays },
  { to: '/batches', label: 'Lô cây', icon: Trees },
  { to: '/orders', label: 'Đơn hàng', icon: ClipboardList },
  { to: '/more', label: 'Thêm', icon: MoreHorizontal }
]
