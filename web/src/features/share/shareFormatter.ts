import { formatQuantity } from '../../domain/quantity'
import type { ShareGroup } from './shareSelection'

/** Presentation sanitization only; never changes A1 grouping or persisted labels. */
export function publicLabel(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Tên vườn, tên giống hoặc mã lô chưa hợp lệ.')
  const label = value.replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, ' ').replace(/\s+/gu, ' ').trim()
  if (!label) throw new Error('Tên vườn, tên giống hoặc mã lô chưa hợp lệ.')
  return label
}

export interface ShareFacts {
  organizationName: string
  generatedAt: string
  includeBatchCodes: boolean
  groups: ShareGroup[]
}

/** Same validated facts and timestamp always produce the same plain text, in Vietnam time. */
export function formatShareText(facts: ShareFacts): string {
  const date = new Date(facts.generatedAt)
  if (!Number.isFinite(date.getTime()) || !facts.groups.length) throw new Error('Chưa tạo được bảng hàng hợp lệ.')
  const time = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' }).format(date)
  const day = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
  const lines = ['BẢNG CÂY GIỐNG CÒN BÁN', `Vườn: ${publicLabel(facts.organizationName)}`, `Tạo lúc: ${time}, ${day}`, '']
  for (const group of facts.groups) {
    lines.push(publicLabel(group.variety), `Còn bán: ${formatQuantity(group.available)} cây`)
    if (facts.includeBatchCodes) {
      for (const batch of group.batches) lines.push(`- ${publicLabel(batch.code)}: ${formatQuantity(batch.available)} cây`)
    }
    lines.push('')
  }
  lines.push('---', 'Số lượng theo dữ liệu trên thiết bị tại thời điểm tạo bảng và có thể thay đổi.', 'Vui lòng liên hệ chủ vườn để xác nhận trước khi đặt.')
  return lines.join('\n')
}
