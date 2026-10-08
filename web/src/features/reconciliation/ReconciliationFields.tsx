import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { QuantityInput } from '../../shared/components/QuantityInput'
import { formatQuantity } from '../../domain/quantity'

import type { QuantityDraft } from './quantityDraft'
export function AbsoluteQuantity({ id, label, draft, onChange, disabled }: {
  id: string; label: string; draft: QuantityDraft; onChange: (draft: QuantityDraft) => void; disabled: boolean
}) {
  const unit = useRef(draft.unit)
  useEffect(() => { unit.current = draft.unit }, [draft.unit])
  return <div className="[&_input]:min-w-0 [&_select]:min-h-11 [&_label]:text-base">
    <QuantityInput id={id} label={label} value={draft.raw} unit={draft.unit} disabled={disabled} showQuickChips={false}
      onUnitChange={next => { unit.current = next; onChange({ ...draft, unit: next }) }}
      onChange={(raw, value) => onChange({ raw, value, unit: unit.current })} />
  </div>
}
export function Impact({ label, before, after }: { label: string; before?: number; after: number }) {
  return <p>{label}: <strong>{before !== undefined && `${formatQuantity(before)} → `}{formatQuantity(after)} cây</strong></p>
}
export function ReconciliationError({ error }: { error: { code: string; error: string; conflict?: {
  shipmentIds?: string[]; plannedQuantity?: number; newOutstanding?: number
} } | null }) {
  if (!error) return null
  const messages: Record<string, string> = {
    PREVIEW_CHANGED: 'Đơn, nguồn cây hoặc chuyến xuất đã thay đổi. Hãy xem lại số mới trước khi xác nhận.',
    TARGET_UNAVAILABLE: 'Lô đích không còn đủ cây để chuyển. Hãy chọn lại lô hoặc số lượng.',
    VARIETY_MISMATCH: 'Lô đích không cùng giống với đơn và lô nguồn. Hãy chọn lô cùng giống.',
    ORDER_CANCELLED: 'Đơn đã hủy. Không thể điều chỉnh nguồn giữ của đơn này.',
    ALREADY_SHIPPED: 'Đơn đã xuất cây nên thao tác này không còn được phép. Hãy quay lại xem đơn.',
    OPERATION_ID_CONFLICT: 'Thao tác này đã thay đổi. Hãy xem lại và thử lại.',
    UNVERIFIABLE_PLANNED_SHIPMENT: 'Phân bổ chuyến chờ xuất chưa xác minh được. Hãy xem hoặc hủy chuyến trước khi điều chỉnh.'
  }
  return <div role="alert" className="bg-amber-50 border border-amber-300 p-3 rounded-xl space-y-2 break-words">
    <p>{error.code === 'PLANNED_ALLOCATION_CONFLICT' && error.conflict?.plannedQuantity !== undefined
      ? `${formatQuantity(error.conflict.plannedQuantity)} cây của nguồn này đang nằm trong chuyến chờ xuất. Hãy hủy chuyến đó trước khi giảm nguồn giữ xuống ${formatQuantity(error.conflict.newOutstanding ?? 0)} cây.`
      : messages[error.code] ?? error.error}</p>
    {error.conflict?.shipmentIds?.map(id => <Link key={id} className="flex items-center min-h-12 font-bold underline" to={`/shipments/${encodeURIComponent(id)}`}>XEM CHUYẾN CHỜ XUẤT</Link>)}
  </div>
}
