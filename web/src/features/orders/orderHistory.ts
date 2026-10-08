import type { DomainEvent } from '../../analytics/events'
import { formatQuantity } from '../../domain/quantity'

export function orderHistoryMessage(event: DomainEvent): string {
  const payload = event.payload && typeof event.payload === 'object' ? event.payload as Record<string, unknown> : {}
  if (event.type === 'order_updated' && Array.isArray(payload.changedFields)) {
    const before = payload.before as Record<string, unknown> | undefined
    const after = payload.after as Record<string, unknown> | undefined
    const labels: Record<string, string> = { requestedDate: 'Đã sửa ngày hẹn lấy', unitPrice: 'Đã sửa giá mỗi cây', note: 'Đã sửa ghi chú', variety: 'Đã sửa giống cây' }
    const messages = payload.changedFields.flatMap((field) => {
      if (field === 'requestedQuantity' && typeof before?.requestedQuantity === 'number' && typeof after?.requestedQuantity === 'number') {
        return [`Số đặt: ${formatQuantity(before.requestedQuantity)} → ${formatQuantity(after.requestedQuantity)} cây`]
      }
      return typeof field === 'string' && labels[field] ? [labels[field]] : []
    })
    if (messages.length > 0) return messages.join(' · ')
  }
  return typeof payload.message === 'string' ? payload.message : event.type
}
