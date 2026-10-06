import type { VuonUomBackupV1 } from './backup.types'
import { BACKUP_FORMAT, BACKUP_FORMAT_VERSION } from './backup.types'

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

function isPositiveInteger(val: unknown): boolean {
  return typeof val === 'number' && Number.isFinite(val) && Number.isInteger(val) && val > 0
}

function isNonNegativeInteger(val: unknown): boolean {
  return typeof val === 'number' && Number.isFinite(val) && Number.isInteger(val) && val >= 0
}

/**
 * Performs deep runtime validation of a normalized VuonUomBackupV1 object.
 * Enforces:
 * 1. Envelope format and version boundaries.
 * 2. Duplicate ID rejection across all collections.
 * 3. Quantity invariants on Batches, Orders, Reservations, and Shipments.
 * 4. Referential integrity between related entities.
 * 5. Domain invariants (e.g. outstanding reservation <= readyQuantity).
 */
export function validateBackup(backup: VuonUomBackupV1): ValidationResult {
  const errors: string[] = []

  // 1. Envelope validation
  if (backup.format !== BACKUP_FORMAT) {
    errors.push(`Định dạng bản sao không hợp lệ (nhận được: ${String(backup.format)}).`)
    return { valid: false, errors }
  }

  if (backup.formatVersion > BACKUP_FORMAT_VERSION) {
    errors.push('Bản sao này được tạo bởi phiên bản Vườn Ươm mới hơn. Hãy cập nhật ứng dụng trước khi khôi phục.')
    return { valid: false, errors }
  }

  const {
    organizations = [],
    settings = [],
    contacts = [],
    batches = [],
    orders = [],
    reservations = [],
    shipments = [],
    dossiers = [],
    events = []
  } = backup.data || {}

  // 2. Duplicate ID validation
  const checkDuplicateIds = (items: { id?: string }[], tableName: string) => {
    const seen = new Set<string>()
    for (const item of items) {
      if (!item.id || typeof item.id !== 'string') {
        errors.push(`Bản ghi trong bảng ${tableName} thiếu mã định danh (id).`)
        continue
      }
      if (seen.has(item.id)) {
        errors.push(`Trùng lặp mã định danh "${item.id}" trong bảng ${tableName}.`)
      }
      seen.add(item.id)
    }
  }

  checkDuplicateIds(organizations, 'organizations')
  checkDuplicateIds(contacts, 'contacts')
  checkDuplicateIds(batches, 'batches')
  checkDuplicateIds(orders, 'orders')
  checkDuplicateIds(reservations, 'reservations')
  checkDuplicateIds(shipments, 'shipments')
  checkDuplicateIds(dossiers, 'dossiers')
  checkDuplicateIds(events, 'events')

  // Check duplicate settings keys
  const settingKeys = new Set<string>()
  for (const s of settings) {
    if (!s.key || typeof s.key !== 'string') {
      errors.push('Bản ghi cài đặt thiếu khóa (key).')
      continue
    }
    if (settingKeys.has(s.key)) {
      errors.push(`Trùng lặp khóa cài đặt "${s.key}".`)
    }
    settingKeys.add(s.key)
  }

  // Check 1:1 invariant for dossiers: one dossier per batch
  const dossierBatchIds = new Set<string>()
  for (const d of dossiers) {
    if (d.batchId) {
      if (dossierBatchIds.has(d.batchId)) {
        errors.push(`Lô cây "${d.batchId}" có nhiều hơn 1 hồ sơ lô cây trong bản sao.`)
      }
      dossierBatchIds.add(d.batchId)
    }
  }

  // Maps for fast referential lookups
  const contactMap = new Map(contacts.map((c) => [c.id, c]))
  const batchMap = new Map(batches.map((b) => [b.id, b]))
  const orderMap = new Map(orders.map((o) => [o.id, o]))
  const reservationMap = new Map(reservations.map((r) => [r.id, r]))

  // 3. Batch validations
  for (const b of batches) {
    if (!isNonNegativeInteger(b.initialQuantity)) {
      errors.push(`Lô "${b.code || b.id}": Số lượng ban đầu phải là số nguyên không âm.`)
    }
    if (!isNonNegativeInteger(b.currentQuantity)) {
      errors.push(`Lô "${b.code || b.id}": Số cây còn sống (tồn thực tế) phải là số nguyên không âm.`)
    }
    if (!isNonNegativeInteger(b.readyQuantity)) {
      errors.push(`Lô "${b.code || b.id}": Số cây đủ tiêu chuẩn xuất bán phải là số nguyên không âm.`)
    }

    if (b.currentQuantity > b.initialQuantity) {
      errors.push(`Lô "${b.code || b.id}": Tồn thực tế (${b.currentQuantity}) vượt quá số lượng ban đầu (${b.initialQuantity}).`)
    }
    if (b.readyQuantity > b.currentQuantity) {
      errors.push(`Lô "${b.code || b.id}": Cây đủ chuẩn (${b.readyQuantity}) vượt quá số cây còn sống (${b.currentQuantity}).`)
    }
  }

  // 4. Order validations
  for (const o of orders) {
    if (!isPositiveInteger(o.requestedQuantity)) {
      errors.push(`Đơn hàng "${o.id}": Số lượng đặt phải là số nguyên lớn hơn 0.`)
    }
    if (!contactMap.has(o.customerId)) {
      errors.push(`Đơn hàng "${o.id}": Khách hàng "${o.customerId}" không tồn tại trong danh bạ.`)
    }
  }

  // 5. Reservation validations
  for (const r of reservations) {
    if (!isPositiveInteger(r.quantity)) {
      errors.push(`Bản ghi giữ cây "${r.id}": Số lượng giữ phải là số nguyên lớn hơn 0.`)
    }
    const fulfilled = r.fulfilledQuantity ?? 0
    if (!isNonNegativeInteger(fulfilled)) {
      errors.push(`Bản ghi giữ cây "${r.id}": Số lượng đã giao phải là số nguyên không âm.`)
    }
    if (fulfilled > r.quantity) {
      errors.push(`Bản ghi giữ cây "${r.id}": Số lượng đã giao (${fulfilled}) vượt quá số lượng giữ (${r.quantity}).`)
    }

    if (!orderMap.has(r.orderId)) {
      errors.push(`Bản ghi giữ cây "${r.id}": Đơn hàng "${r.orderId}" không tồn tại.`)
    }

    if (r.sourceType === 'own_batch') {
      if (!r.batchId) {
        errors.push(`Bản ghi giữ cây "${r.id}": Giữ từ lô nội bộ thiếu mã lô cây.`)
      } else if (!batchMap.has(r.batchId)) {
        errors.push(`Bản ghi giữ cây "${r.id}": Lô cây "${r.batchId}" không tồn tại.`)
      }
    } else if (r.sourceType === 'external_supplier') {
      if (!r.supplierId) {
        errors.push(`Bản ghi giữ cây "${r.id}": Giữ từ vườn liên kết thiếu mã nhà cung cấp.`)
      } else {
        const sup = contactMap.get(r.supplierId)
        if (!sup) {
          errors.push(`Bản ghi giữ cây "${r.id}": Nhà cung cấp "${r.supplierId}" không tồn tại trong danh bạ.`)
        } else if (!sup.roles.includes('supplier')) {
          errors.push(`Bản ghi giữ cây "${r.id}": Liên hệ "${sup.name}" không có vai trò nhà cung cấp.`)
        }
      }
    } else {
      errors.push(`Bản ghi giữ cây "${r.id}": Loại nguồn "${r.sourceType}" không hợp lệ.`)
    }
  }

  // 6. Shipment validations
  for (const s of shipments) {
    if (!orderMap.has(s.orderId)) {
      errors.push(`Chuyến giao "${s.id}": Đơn hàng "${s.orderId}" không tồn tại.`)
    }
    if (!isNonNegativeInteger(s.plannedQuantity)) {
      errors.push(`Chuyến giao "${s.id}": Số lượng dự kiến phải là số nguyên không âm.`)
    }
    if (!isNonNegativeInteger(s.shippedQuantity)) {
      errors.push(`Chuyến giao "${s.id}": Số lượng đã xuất phải là số nguyên không âm.`)
    }

    const lines = s.lines ?? []
    if (lines.length > 0) {
      let sumLines = 0
      for (const line of lines) {
        if (!isPositiveInteger(line.quantity)) {
          errors.push(`Chuyến giao "${s.id}": Dòng phân bổ số lượng phải là số nguyên lớn hơn 0.`)
        }
        sumLines += line.quantity

        const res = reservationMap.get(line.reservationId)
        if (!res) {
          errors.push(`Chuyến giao "${s.id}": Bản ghi giữ cây "${line.reservationId}" không tồn tại.`)
        } else {
          if (res.orderId !== s.orderId) {
            errors.push(`Chuyến giao "${s.id}": Nguồn giữ cây "${line.reservationId}" không thuộc đơn hàng này.`)
          }
          if (line.sourceType !== res.sourceType) {
            errors.push(`Chuyến giao "${s.id}": Loại nguồn của dòng không khớp với bản ghi giữ cây.`)
          }
          if (res.sourceType === 'own_batch' && line.batchId !== res.batchId) {
            errors.push(`Chuyến giao "${s.id}": Mã lô cây của dòng không khớp với bản ghi giữ cây.`)
          }
          if (res.sourceType === 'external_supplier' && line.supplierId !== res.supplierId) {
            errors.push(`Chuyến giao "${s.id}": Nhà cung cấp của dòng không khớp với bản ghi giữ cây.`)
          }
        }
      }

      if (sumLines !== s.plannedQuantity) {
        errors.push(`Chuyến giao "${s.id}": Tổng số lượng các dòng (${sumLines}) không khớp với số lượng dự kiến (${s.plannedQuantity}).`)
      }
    }

    if (s.status === 'completed' && lines.length > 0 && s.shippedQuantity !== s.plannedQuantity) {
      errors.push(`Chuyến giao "${s.id}": Chuyến đã giao nhưng số xuất (${s.shippedQuantity}) không bằng số dự kiến (${s.plannedQuantity}).`)
    }
    if (s.status === 'planned' && s.shippedQuantity !== 0) {
      errors.push(`Chuyến giao "${s.id}": Chuyến đang chờ giao nhưng số xuất khác 0 (${s.shippedQuantity}).`)
    }
  }

  // 7. Dossier validations
  for (const d of dossiers) {
    if (!batchMap.has(d.batchId)) {
      errors.push(`Hồ sơ lô cây "${d.id}": Lô cây "${d.batchId}" không tồn tại.`)
    }
    if (d.supplierContactId) {
      const sup = contactMap.get(d.supplierContactId)
      if (!sup) {
        errors.push(`Hồ sơ lô cây "${d.id}": Nhà cung cấp "${d.supplierContactId}" không tồn tại trong danh bạ.`)
      } else if (!sup.roles.includes('supplier')) {
        errors.push(`Hồ sơ lô cây "${d.id}": Liên hệ "${sup.name}" không có vai trò nhà cung cấp.`)
      }
    }
  }

  // 8. Cross-entity Domain Invariant Validation
  // Invariant 1: For each batch, active outstanding reservations <= readyQuantity
  for (const b of batches) {
    const activeOutstanding = reservations
      .filter((r) => r.sourceType === 'own_batch' && r.batchId === b.id && r.status === 'active')
      .reduce((sum, r) => sum + (r.quantity - (r.fulfilledQuantity ?? 0)), 0)

    if (activeOutstanding > b.readyQuantity) {
      errors.push(
        `Lô "${b.code || b.id}": Tổng số cây đang giữ chưa xuất (${activeOutstanding}) vượt quá số cây đủ chuẩn (${b.readyQuantity}).`
      )
    }
  }

  // Invariant 2: For each order, total completed shipped <= requestedQuantity
  for (const o of orders) {
    const totalShipped = shipments
      .filter((s) => s.orderId === o.id && s.status === 'completed')
      .reduce((sum, s) => sum + s.shippedQuantity, 0)

    if (totalShipped > o.requestedQuantity) {
      errors.push(
        `Đơn hàng "${o.id}": Tổng số cây đã xuất giao (${totalShipped}) vượt quá số cây khách đặt (${o.requestedQuantity}).`
      )
    }
  }

  return {
    valid: errors.length === 0,
    errors
  }
}
