import React from 'react'
import { CheckCircle2, Clock, Sprout, Archive, Truck, CheckCheck, XCircle } from 'lucide-react'
import type { BatchStatus } from '../../domain/batch'
import type { OrderStatus } from '../../domain/order'
import type { ShipmentStatus } from '../../domain/shipment'
import type { ReservationStatus } from '../../domain/reservation'

export type BadgeKind = BatchStatus | OrderStatus | ShipmentStatus | ReservationStatus

interface StatusConfig {
  label: string
  icon: React.ComponentType<{ className?: string }>
  classes: string
}

const statusMap: Record<BadgeKind, StatusConfig> = {
  // Batch statuses
  ready: {
    label: 'Đang bán',
    icon: CheckCircle2,
    classes: 'bg-emerald-50 text-emerald-800 border-emerald-300'
  },
  nearly_ready: {
    label: 'Sắp bán được',
    icon: Clock,
    classes: 'bg-amber-50 text-amber-800 border-amber-300'
  },
  propagating: {
    label: 'Đang ươm',
    icon: Sprout,
    classes: 'bg-sky-50 text-sky-800 border-sky-300'
  },
  depleted: {
    label: 'Đã hết',
    icon: Archive,
    classes: 'bg-slate-100 text-slate-700 border-slate-300'
  },

  // Order statuses
  open: {
    label: 'Chưa giữ',
    icon: Clock,
    classes: 'bg-sky-50 text-sky-800 border-sky-300'
  },
  partially_reserved: {
    label: 'Giữ 1 phần',
    icon: Clock,
    classes: 'bg-amber-50 text-amber-800 border-amber-300'
  },
  reserved: {
    label: 'Đã giữ đủ',
    icon: CheckCircle2,
    classes: 'bg-emerald-50 text-emerald-800 border-emerald-300'
  },
  partially_shipped: {
    label: 'Đang giao',
    icon: Truck,
    classes: 'bg-purple-50 text-purple-800 border-purple-300'
  },
  shipped: {
    label: 'Đã giao xong',
    icon: CheckCheck,
    classes: 'bg-slate-100 text-slate-800 border-slate-300'
  },
  closed_remaining: {
    label: 'Đã dừng phần còn lại', icon: XCircle, classes: 'bg-slate-100 text-slate-700 border-slate-300'
  },
  cancelled: {
    label: 'Đã hủy',
    icon: XCircle,
    classes: 'bg-rose-50 text-rose-800 border-rose-300'
  },

  // Shipment statuses
  planned: {
    label: 'Chờ giao',
    icon: Clock,
    classes: 'bg-sky-50 text-sky-800 border-sky-300'
  },
  completed: {
    label: 'Đã giao xong',
    icon: CheckCheck,
    classes: 'bg-emerald-50 text-emerald-800 border-emerald-300'
  },

  // Reservation statuses
  active: {
    label: 'Đang giữ',
    icon: CheckCircle2,
    classes: 'bg-emerald-50 text-emerald-800 border-emerald-300'
  },
  fulfilled: {
    label: 'Đã xuất cây',
    icon: CheckCheck,
    classes: 'bg-slate-100 text-slate-800 border-slate-300'
  },
  released: {
    label: 'Đã nhả giữ',
    icon: XCircle,
    classes: 'bg-slate-100 text-slate-600 border-slate-300'
  }
}

export interface StatusBadgeProps {
  status: BadgeKind
  className?: string
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = '' }) => {
  const config = statusMap[status] ?? {
    label: status,
    icon: CheckCircle2,
    classes: 'bg-slate-100 text-slate-700 border-slate-200'
  }

  const Icon = config.icon

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border ${config.classes} ${className}`}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span>{config.label}</span>
    </span>
  )
}
