import type { VuonUomBackupV1 } from './backup.types'
import { BACKUP_FORMAT, BACKUP_FORMAT_VERSION } from './backup.types'
import { safeSum } from '../../domain/reconciliation'
import { coveredQuantityForReservation, remainingReservationQuantity } from '../../domain/reservation'
import { availableQuantityForBatch, commitmentShortageForBatch } from '../../domain/quantity'

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

function isRecord(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val)
}

function isNonEmptyString(val: unknown): val is string {
  return typeof val === 'string' && val.trim().length > 0
}

function isPositiveInteger(val: unknown): boolean {
  return typeof val === 'number' && Number.isSafeInteger(val) && val > 0
}

function isNonNegativeInteger(val: unknown): boolean {
  return typeof val === 'number' && Number.isSafeInteger(val) && val >= 0
}

// Whitelisted enum values according to domain models
const KNOWN_BATCH_STATUSES = new Set(['propagating', 'nearly_ready', 'ready', 'depleted'])
const KNOWN_ORDER_STATUSES = new Set([
  'open',
  'partially_reserved',
  'reserved',
  'partially_shipped',
  'shipped',
  'cancelled'
])
const KNOWN_RESERVATION_STATUSES = new Set(['active', 'fulfilled', 'released'])
const KNOWN_RESERVATION_SOURCE_TYPES = new Set(['own_batch', 'external_supplier'])
const KNOWN_SHIPMENT_STATUSES = new Set(['planned', 'completed', 'cancelled'])
const KNOWN_MATERIAL_TYPES = new Set([
  'seed',
  'cutting',
  'tissue_culture',
  'seedling',
  'other',
  'unknown'
])
const KNOWN_CONTACT_ROLES = new Set(['customer', 'supplier'])
const KNOWN_ORG_CAPABILITIES = new Set([
  'produce',
  'sell',
  'buy',
  'aggregate',
  'transport'
])

/**
 * Performs deep runtime validation of a normalized VuonUomBackupV1 object.
 * Enforces:
 * 1. Envelope format and version boundaries.
 * 2. Duplicate ID rejection across all collections.
 * 3. Type guards and enum validation on all entities.
 * 4. Structural mandatory field verification on all entities.
 * 5. Quantity invariants on Batches, Orders, Reservations, and Shipments.
 * 6. Referential integrity between related entities.
 * 7. Cross-entity domain invariants (commitment shortage is valid,
 *    order reservation coverage <= requestedQuantity, one planned shipment per order,
 *    planned line allocation <= reservation remaining, shipment fulfillment reconciliation).
 */
export function validateBackup(input: unknown): ValidationResult {
  // The public API also receives runtime values outside JSON (e.g. Symbols or
  // objects without toString). Conversion/comparison must still fail closed.
  try {
    return validateBackupFacts(input)
  } catch {
    return { valid: false, errors: ['Cấu trúc bản sao lưu không hợp lệ.'] }
  }
}

function validateBackupFacts(input: unknown): ValidationResult {
  const errors: string[] = []
  if (!isRecord(input)) return { valid: false, errors: ['Bản sao lưu phải là một đối tượng.'] }

  // 1. Envelope validation
  if (input.format !== BACKUP_FORMAT) {
    errors.push('Định dạng bản sao không hợp lệ.')
    return { valid: false, errors }
  }

  if (typeof input.formatVersion === 'number' && input.formatVersion > BACKUP_FORMAT_VERSION) {
    errors.push('Bản sao này được tạo bởi phiên bản Vườn Ươm mới hơn. Hãy cập nhật ứng dụng trước khi khôi phục.')
    return { valid: false, errors }
  }

  if (input.formatVersion !== BACKUP_FORMAT_VERSION || !isNonEmptyString(input.exportedAt) ||
    !isPositiveInteger(input.dbSchemaVersion)) {
    return { valid: false, errors: ['Phiên bản hoặc thời điểm xuất bản sao lưu không hợp lệ.'] }
  }
  if (!isRecord(input.data)) {
    errors.push('Mục dữ liệu "data" trong bản sao không hợp lệ.')
    return { valid: false, errors }
  }

  const tableNames = ['organizations', 'settings', 'contacts', 'batches', 'orders',
    'reservations', 'shipments', 'dossiers', 'events'] as const
  for (const table of tableNames) {
    if (!Array.isArray(input.data[table])) errors.push(`Bảng "${table}" phải là một danh sách (mảng).`)
  }
  if (errors.length) return { valid: false, errors }
  if (!isRecord(input.recordCounts)) {
    return { valid: false, errors: ['Số lượng bản ghi (recordCounts) phải là một đối tượng.'] }
  }
  // The following entity guards validate the records before cross-entity reads.
  const backup = input as unknown as VuonUomBackupV1

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
  } = backup.data

  // 2. Duplicate ID & Record Object Shape validation
  const checkDuplicateIdsAndRecords = (items: unknown[], tableName: string) => {
    const seen = new Set<string>()
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (!isRecord(item)) {
        errors.push(`Bản ghi thứ ${i + 1} trong bảng ${tableName} không hợp lệ (không phải đối tượng).`)
        continue
      }
      if (!isNonEmptyString(item.id)) {
        errors.push(`Bản ghi thứ ${i + 1} trong bảng ${tableName} thiếu mã định danh (id).`)
        continue
      }
      if (seen.has(item.id)) {
        errors.push(`Trùng lặp mã định danh "${item.id}" trong bảng ${tableName}.`)
      }
      seen.add(item.id)
    }
  }

  checkDuplicateIdsAndRecords(organizations, 'organizations')
  checkDuplicateIdsAndRecords(contacts, 'contacts')
  checkDuplicateIdsAndRecords(batches, 'batches')
  checkDuplicateIdsAndRecords(orders, 'orders')
  checkDuplicateIdsAndRecords(reservations, 'reservations')
  checkDuplicateIdsAndRecords(shipments, 'shipments')
  checkDuplicateIdsAndRecords(dossiers, 'dossiers')
  checkDuplicateIdsAndRecords(events, 'events')

  // Check duplicate settings keys
  const settingKeys = new Set<string>()
  for (let i = 0; i < settings.length; i++) {
    const s = settings[i] as unknown
    if (!isRecord(s)) {
      errors.push(`Bản ghi thứ ${i + 1} trong bảng settings không hợp lệ.`)
      continue
    }
    if (!isNonEmptyString(s.key)) {
      errors.push(`Bản ghi thứ ${i + 1} trong bảng cài đặt thiếu khóa (key).`)
      continue
    }
    if (settingKeys.has(s.key)) {
      errors.push(`Trùng lặp khóa cài đặt "${s.key}".`)
    }
    if (typeof s.value !== 'string') errors.push(`Cài đặt "${s.key}": Giá trị phải là chuỗi ký tự.`)
    settingKeys.add(s.key)
  }

  // Reject malformed containers/entries before any filter, arithmetic or nested
  // dereference. Missing historical lines/documents are still allowed.
  for (const s of shipments) {
    if (!isRecord(s)) continue
    for (const field of ['createdAt', 'shippedAt', 'plannedDate'] as const) {
      if (s[field] !== undefined && !isNonEmptyString(s[field])) {
        errors.push(`Chuyến giao "${s.id}": ${field} phải là chuỗi ký tự không trống.`)
      }
    }
    if (s.lines !== undefined && !Array.isArray(s.lines)) {
      errors.push(`Chuyến giao "${s.id}": Dòng phân bổ (lines) phải là mảng.`)
    } else if (s.lines?.some(line => !isRecord(line))) {
      errors.push(`Chuyến giao "${s.id}": Dòng phân bổ không phải đối tượng hợp lệ.`)
    }
  }
  if (errors.length) return { valid: false, errors }

  for (const table of tableNames) {
    if (!isNonNegativeInteger(input.recordCounts[table]) ||
      input.recordCounts[table] !== (input.data[table] as unknown[]).length) {
      errors.push(`Số lượng bản ghi "${table}" không hợp lệ hoặc không khớp dữ liệu.`)
    }
  }
  if (errors.length) return { valid: false, errors }

  const checkedSum = (values: number[], context: string): number | undefined => {
    const total = safeSum(values)
    if (total === undefined) errors.push(`${context}: Tổng số lượng vượt giới hạn số nguyên an toàn hoặc chứa số lượng không hợp lệ.`)
    return total
  }

  // Check currentOrganizationId in settings
  const orgMap = new Map(
    organizations
      .filter(isRecord)
      .filter((o) => isNonEmptyString(o.id))
      .map((o) => [o.id as string, o])
  )
  const currentOrgSetting = settings.find((s) => isRecord(s) && s.key === 'currentOrganizationId')
  if (currentOrgSetting && isRecord(currentOrgSetting)) {
    const orgIdVal = currentOrgSetting.value as string
    if (!orgMap.has(orgIdVal)) {
      errors.push(`Cài đặt cơ sở hiện tại (currentOrganizationId: "${orgIdVal}") trỏ đến cơ sở không tồn tại trong danh sách.`)
    }
  } else if (organizations.length > 1) {
    errors.push('Bản sao lưu có nhiều hơn một cơ sở nhưng thiếu cài đặt cơ sở hiện tại (currentOrganizationId).')
  }

  // Check 1:1 invariant for dossiers: one dossier per batch
  const dossierBatchIds = new Set<string>()
  for (const d of dossiers) {
    if (isRecord(d) && isNonEmptyString(d.batchId)) {
      if (dossierBatchIds.has(d.batchId)) {
        errors.push(`Lô cây "${d.batchId}" có nhiều hơn 1 hồ sơ lô cây trong bản sao.`)
      }
      dossierBatchIds.add(d.batchId)
    }
  }

  // Maps for fast referential lookups
  const contactMap = new Map(
    contacts
      .filter(isRecord)
      .filter((c) => isNonEmptyString(c.id))
      .map((c) => [c.id as string, c])
  )
  const batchMap = new Map(
    batches
      .filter(isRecord)
      .filter((b) => isNonEmptyString(b.id))
      .map((b) => [b.id as string, b])
  )
  const orderMap = new Map(
    orders
      .filter(isRecord)
      .filter((o) => isNonEmptyString(o.id))
      .map((o) => [o.id as string, o])
  )
  const reservationMap = new Map(
    reservations
      .filter(isRecord)
      .filter((r) => isNonEmptyString(r.id))
      .map((r) => [r.id as string, r])
  )

  // 3. Organization entity validation
  for (const o of organizations) {
    if (!isRecord(o)) continue
    if (!isNonEmptyString(o.name)) {
      errors.push(`Cơ sở "${o.id}": Tên cơ sở không được để trống.`)
    }
    if (!Array.isArray(o.capabilities) || o.capabilities.length === 0) {
      errors.push(`Cơ sở "${o.id}": Phải có ít nhất một vai trò/năng lực (capabilities).`)
    } else {
      for (const cap of o.capabilities) {
        if (!isNonEmptyString(cap) || !KNOWN_ORG_CAPABILITIES.has(cap)) {
          errors.push(`Cơ sở "${o.id}": Vai trò/năng lực "${String(cap)}" không hợp lệ.`)
        }
      }
    }
  }

  // 4. Contact entity validation
  for (const c of contacts) {
    if (!isRecord(c)) continue
    if (!isNonEmptyString(c.name)) {
      errors.push(`Liên hệ "${c.id}": Tên liên hệ không được để trống.`)
    }
    if (c.phone !== undefined && typeof c.phone !== 'string') {
      errors.push(`Liên hệ "${c.id}": Số điện thoại phải là chuỗi ký tự.`)
    }
    if (!Array.isArray(c.roles) || c.roles.length === 0) {
      errors.push(`Liên hệ "${c.id}": Phải có ít nhất một vai trò (roles).`)
    } else {
      for (const role of c.roles) {
        if (!isNonEmptyString(role) || !KNOWN_CONTACT_ROLES.has(role)) {
          errors.push(`Liên hệ "${c.id}": Vai trò "${String(role)}" không hợp lệ.`)
        }
      }
    }
  }

  // 5. Batch validations
  for (const b of batches) {
    if (!isRecord(b)) continue
    if (!isNonEmptyString(b.code)) {
      errors.push(`Lô "${b.id}": Mã lô cây (code) không được để trống.`)
    }
    if (!isNonEmptyString(b.variety)) {
      errors.push(`Lô "${b.code || b.id}": Giống cây (variety) không được để trống.`)
    }
    if (!isNonEmptyString(b.createdAt)) {
      errors.push(`Lô "${b.code || b.id}": Thời điểm tạo (createdAt) không được để trống.`)
    }
    if (!isNonEmptyString(b.status) || !KNOWN_BATCH_STATUSES.has(b.status)) {
      errors.push(`Lô "${b.code || b.id}": Trạng thái "${String(b.status)}" không hợp lệ.`)
    }
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

  // 6. Order validations
  for (const o of orders) {
    if (!isRecord(o)) continue
    if (!isNonEmptyString(o.customerId)) {
      errors.push(`Đơn hàng "${o.id}": Thiếu mã khách hàng (customerId).`)
    }
    if (!isNonEmptyString(o.variety)) {
      errors.push(`Đơn hàng "${o.id}": Giống cây (variety) không được để trống.`)
    }
    if (!isNonEmptyString(o.status) || !KNOWN_ORDER_STATUSES.has(o.status)) {
      errors.push(`Đơn hàng "${o.id}": Trạng thái "${String(o.status)}" không hợp lệ.`)
    }
    if (!isPositiveInteger(o.requestedQuantity)) {
      errors.push(`Đơn hàng "${o.id}": Số lượng đặt phải là số nguyên lớn hơn 0.`)
    }
    if (!contactMap.has(o.customerId as string)) {
      errors.push(`Đơn hàng "${o.id}": Khách hàng "${o.customerId}" không tồn tại trong danh bạ.`)
    }
  }

  // 7. Reservation validations
  for (const r of reservations) {
    if (!isRecord(r)) continue
    if (!isNonEmptyString(r.orderId)) {
      errors.push(`Bản ghi giữ cây "${r.id}": Thiếu mã đơn hàng (orderId).`)
    }
    if (!isNonEmptyString(r.status) || !KNOWN_RESERVATION_STATUSES.has(r.status)) {
      errors.push(`Bản ghi giữ cây "${r.id}": Trạng thái "${String(r.status)}" không hợp lệ.`)
    }
    if (!isNonEmptyString(r.sourceType) || !KNOWN_RESERVATION_SOURCE_TYPES.has(r.sourceType)) {
      errors.push(`Bản ghi giữ cây "${r.id}": Loại nguồn "${String(r.sourceType)}" không hợp lệ.`)
    }
    if (!isPositiveInteger(r.quantity)) {
      errors.push(`Bản ghi giữ cây "${r.id}": Số lượng giữ phải là số nguyên lớn hơn 0.`)
    }
    const fulfilled = r.fulfilledQuantity === undefined ? 0 : r.fulfilledQuantity
    if (!isNonNegativeInteger(fulfilled)) {
      errors.push(`Bản ghi giữ cây "${r.id}": Số lượng đã giao phải là số nguyên không âm.`)
    }
    if (fulfilled > r.quantity) {
      errors.push(`Bản ghi giữ cây "${r.id}": Số lượng đã giao (${fulfilled}) vượt quá số lượng giữ (${r.quantity}).`)
    }

    // Reservation status semantics
    if (r.status === 'fulfilled' && fulfilled !== r.quantity) {
      errors.push(
        `Bản ghi giữ cây "${r.id}": Trạng thái đã hoàn thành (fulfilled) nhưng số lượng đã giao (${fulfilled}) không bằng số lượng giữ (${r.quantity}).`
      )
    }
    if (r.status === 'active' && fulfilled >= r.quantity) {
      errors.push(
        `Bản ghi giữ cây "${r.id}": Trạng thái đang giữ (active) nhưng số lượng đã giao (${fulfilled}) đã đạt hoặc vượt quá số lượng giữ (${r.quantity}).`
      )
    }

    if (!orderMap.has(r.orderId as string)) {
      errors.push(`Bản ghi giữ cây "${r.id}": Đơn hàng "${r.orderId}" không tồn tại.`)
    }

    if (r.sourceType === 'own_batch') {
      if (r.supplierId !== undefined) {
        errors.push(`Bản ghi giữ cây "${r.id}": Nguồn lô nội bộ không được có supplierId.`)
      }
      if (!isNonEmptyString(r.batchId)) {
        errors.push(`Bản ghi giữ cây "${r.id}": Giữ từ lô nội bộ thiếu mã lô cây.`)
      } else if (!batchMap.has(r.batchId as string)) {
        errors.push(`Bản ghi giữ cây "${r.id}": Lô cây "${r.batchId}" không tồn tại.`)
      }
    } else if (r.sourceType === 'external_supplier') {
      if (r.batchId !== undefined) {
        errors.push(`Bản ghi giữ cây "${r.id}": Nguồn liên kết không được có batchId.`)
      }
      if (!isNonEmptyString(r.supplierId)) {
        errors.push(`Bản ghi giữ cây "${r.id}": Giữ từ vườn liên kết thiếu mã nhà cung cấp.`)
      } else {
        const sup = contactMap.get(r.supplierId as string)
        if (!sup) {
          errors.push(`Bản ghi giữ cây "${r.id}": Nhà cung cấp "${r.supplierId}" không tồn tại trong danh bạ.`)
        } else if (isRecord(sup) && Array.isArray(sup.roles) && !sup.roles.includes('supplier')) {
          errors.push(`Bản ghi giữ cây "${r.id}": Liên hệ "${sup.name}" không có vai trò nhà cung cấp.`)
        }
      }
    }
  }

  // Safe operands and canonical statuses are established before coverage or
  // Garden arithmetic. No coercion or repair of an explicit malformed F.
  if (errors.length) return { valid: false, errors }

  // 8. Order reservation coverage check (P3 over-reservation prevention)
  for (const o of orders) {
    if (!isRecord(o)) continue
    const orderReservations = reservations.filter((r) => r.orderId === o.id)
    const coveredQuantity = checkedSum(orderReservations.map(coveredQuantityForReservation), `Đơn hàng "${o.id}": Coverage`)

    if (coveredQuantity !== undefined && coveredQuantity > o.requestedQuantity) {
      errors.push(
        `Đơn hàng "${o.id}": Tổng số lượng giữ (${coveredQuantity}) vượt quá số lượng khách đặt (${o.requestedQuantity}).`
      )
    }
  }

  // 9. Shipment validations
  const plannedOrderIds = new Set<string>()

  for (const s of shipments) {
    if (!isRecord(s)) continue
    if (!isNonEmptyString(s.orderId)) {
      errors.push(`Chuyến giao "${s.id}": Thiếu mã đơn hàng (orderId).`)
    }
    if (!isNonEmptyString(s.status) || !KNOWN_SHIPMENT_STATUSES.has(s.status)) {
      errors.push(`Chuyến giao "${s.id}": Trạng thái "${String(s.status)}" không hợp lệ.`)
    }
    if (!orderMap.has(s.orderId as string)) {
      errors.push(`Chuyến giao "${s.id}": Đơn hàng "${s.orderId}" không tồn tại.`)
    }
    if (!isNonNegativeInteger(s.plannedQuantity)) {
      errors.push(`Chuyến giao "${s.id}": Số lượng dự kiến phải là số nguyên không âm.`)
    }
    if (!isNonNegativeInteger(s.shippedQuantity)) {
      errors.push(`Chuyến giao "${s.id}": Số lượng đã xuất phải là số nguyên không âm.`)
    }

    const lines = Array.isArray(s.lines) ? s.lines : []
    const seenReservationInShipment = new Set<string>()

    for (const line of lines) {
      if (!isRecord(line)) {
        errors.push(`Chuyến giao "${s.id}": Dòng phân bổ không phải đối tượng hợp lệ.`)
        continue
      }
      if (!isPositiveInteger(line.quantity)) {
        errors.push(`Chuyến giao "${s.id}": Dòng phân bổ số lượng phải là số nguyên lớn hơn 0.`)
      }

      if (!isNonEmptyString(line.reservationId)) {
        errors.push(`Chuyến giao "${s.id}": Dòng phân bổ thiếu mã giữ cây (reservationId).`)
        continue
      }

      // Duplicate reservationId inside shipment
      if (seenReservationInShipment.has(line.reservationId)) {
        errors.push(`Chuyến giao "${s.id}": Dòng giữ cây "${line.reservationId}" bị trùng lặp trong chuyến giao.`)
      }
      seenReservationInShipment.add(line.reservationId)

      const res = reservationMap.get(line.reservationId)
      if (!res) {
        errors.push(`Chuyến giao "${s.id}": Bản ghi giữ cây "${line.reservationId}" không tồn tại.`)
        continue
      }

      if (res.orderId !== s.orderId) {
        errors.push(`Chuyến giao "${s.id}": Nguồn giữ cây "${line.reservationId}" không thuộc đơn hàng này.`)
      }
      if (line.sourceType !== res.sourceType) {
        errors.push(`Chuyến giao "${s.id}": Loại nguồn của dòng không khớp với bản ghi giữ cây.`)
      }
      if (res.sourceType === 'own_batch' && line.batchId !== res.batchId) {
        errors.push(`Chuyến giao "${s.id}": Mã lô cây của dòng không khớp với bản ghi giữ cây.`)
      }
      if ((line.sourceType === 'own_batch' && line.supplierId !== undefined) ||
        (line.sourceType === 'external_supplier' && line.batchId !== undefined)) {
        errors.push(`Chuyến giao "${s.id}": Dòng phân bổ không được chứa identity của nguồn khác.`)
      }
      if (res.sourceType === 'external_supplier' && line.supplierId !== res.supplierId) {
        errors.push(`Chuyến giao "${s.id}": Nhà cung cấp của dòng không khớp với bản ghi giữ cây.`)
      }

      // Invariant for planned shipments
      if (s.status === 'planned') {
        if (res.status !== 'active') {
          errors.push(
            `Chuyến giao "${s.id}": Không thể lên chuyến dự kiến từ khoản giữ cây đã kết thúc hoặc đã hủy (trạng thái: "${res.status}").`
          )
        }
        const remaining = res.quantity - (res.fulfilledQuantity ?? 0)
        if (line.quantity > remaining) {
          errors.push(
            `Chuyến giao "${s.id}": Số lượng dòng giao (${line.quantity}) vượt quá số lượng giữ còn lại (${remaining}).`
          )
        }
      }
    }

    if (lines.length > 0) {
      const sumLines = checkedSum(lines.map(l => l.quantity), `Chuyến giao "${s.id}": Dòng phân bổ`)
      if (sumLines !== undefined && sumLines !== s.plannedQuantity) {
        errors.push(
          `Chuyến giao "${s.id}": Tổng số lượng các dòng (${sumLines}) không khớp với số lượng dự kiến (${s.plannedQuantity}).`
        )
      }
    }

    // Status constraints
    if (s.status === 'planned') {
      if (s.shippedQuantity !== 0) {
        errors.push(`Chuyến giao "${s.id}": Chuyến đang chờ giao nhưng số xuất khác 0 (${s.shippedQuantity}).`)
      }
      // One planned shipment per order invariant
      if (plannedOrderIds.has(s.orderId as string)) {
        errors.push(`Đơn hàng "${s.orderId}" có nhiều hơn 1 chuyến giao đang chờ (planned).`)
      }
      plannedOrderIds.add(s.orderId as string)
    } else if (s.status === 'completed') {
      if (s.shippedQuantity !== s.plannedQuantity) {
        errors.push(`Chuyến giao "${s.id}": Chuyến đã giao nhưng số xuất (${s.shippedQuantity}) không bằng số dự kiến (${s.plannedQuantity}).`)
      }
    } else if (s.status === 'cancelled') {
      if (s.shippedQuantity !== 0) {
        errors.push(`Chuyến giao "${s.id}": Chuyến đã hủy nhưng số lượng xuất khác 0 (${s.shippedQuantity}).`)
      }
    }

    // Planned shipment total cannot exceed remaining unfulfilled order quantity
    if (s.status === 'planned') {
      const targetOrder = orderMap.get(s.orderId as string)
      if (targetOrder) {
        const completedShippedForOrder = checkedSum(shipments
          .filter((other) => other.orderId === s.orderId && other.status === 'completed')
          .map(other => other.shippedQuantity), `Đơn hàng "${s.orderId}": Đã xuất`)
        if (completedShippedForOrder === undefined) continue
        const remainingOrder = targetOrder.requestedQuantity - completedShippedForOrder
        if (s.plannedQuantity > remainingOrder) {
          errors.push(
            `Chuyến giao "${s.id}": Số lượng dự kiến (${s.plannedQuantity}) vượt quá số cây còn lại của đơn hàng (${remainingOrder}).`
          )
        }
      }
    }
  }

  // 10. Cross-entity: Completed Shipment Lines vs Reservation Fulfillment Reconciliation
  for (const r of reservations) {
    if (!isRecord(r)) continue
    const completedQuantities: number[] = []
    let hasCompletedLines = false

    for (const s of shipments) {
      if (s.status === 'completed' && Array.isArray(s.lines)) {
        for (const line of s.lines) {
          if (line.reservationId === r.id) {
            hasCompletedLines = true
            completedQuantities.push(line.quantity)
          }
        }
      }
    }

    const completedAllocatedToRes = checkedSum(completedQuantities, `Bản ghi giữ cây "${r.id}": Đã xuất`)
    if (completedAllocatedToRes === undefined) continue
    const resFulfilled = r.fulfilledQuantity ?? 0
    if (completedAllocatedToRes > resFulfilled) {
      errors.push(
        `Bản ghi giữ cây "${r.id}": Tổng số lượng đã xuất trong các chuyến giao (${completedAllocatedToRes}) vượt quá số lượng đã giao ghi nhận (${resFulfilled}).`
      )
    } else if (hasCompletedLines && completedAllocatedToRes !== resFulfilled) {
      errors.push(
        `Bản ghi giữ cây "${r.id}": Số lượng đã giao ghi nhận (${resFulfilled}) không khớp với tổng số lượng đã xuất trong các chuyến giao (${completedAllocatedToRes}).`
      )
    }
  }

  // 11. Dossier validations
  for (const d of dossiers) {
    if (!isRecord(d)) continue
    if (!isNonEmptyString(d.batchId)) {
      errors.push(`Hồ sơ lô cây "${d.id}": Thiếu mã lô cây (batchId).`)
    }
    if (!isNonEmptyString(d.materialType) || !KNOWN_MATERIAL_TYPES.has(d.materialType)) {
      errors.push(`Hồ sơ lô cây "${d.id}": Loại vật liệu giống "${String(d.materialType)}" không hợp lệ.`)
    }
    if (!batchMap.has(d.batchId as string)) {
      errors.push(`Hồ sơ lô cây "${d.id}": Lô cây "${d.batchId}" không tồn tại.`)
    }
    if (d.supplierContactId) {
      const sup = contactMap.get(d.supplierContactId as string)
      if (!sup) {
        errors.push(`Hồ sơ lô cây "${d.id}": Nhà cung cấp "${d.supplierContactId}" không tồn tại trong danh bạ.`)
      } else if (isRecord(sup) && Array.isArray(sup.roles) && !sup.roles.includes('supplier')) {
        errors.push(`Hồ sơ lô cây "${d.id}": Liên hệ "${sup.name}" không có vai trò nhà cung cấp.`)
      }
    }

    if (d.documents !== undefined && !Array.isArray(d.documents)) {
      errors.push(`Hồ sơ lô cây "${d.id}": Danh mục chứng từ (documents) phải là mảng.`)
    } else if (Array.isArray(d.documents)) {
      const seenDocIds = new Set<string>()
      for (let i = 0; i < d.documents.length; i++) {
        const doc = d.documents[i]
        if (!isRecord(doc)) {
          errors.push(`Hồ sơ lô cây "${d.id}": Chứng từ thứ ${i + 1} không hợp lệ (không phải đối tượng).`)
          continue
        }
        if (!isNonEmptyString(doc.id)) {
          errors.push(`Hồ sơ lô cây "${d.id}": Chứng từ thứ ${i + 1} thiếu mã định danh (id).`)
          continue
        }
        if (seenDocIds.has(doc.id)) {
          errors.push(`Hồ sơ lô cây "${d.id}": Trùng lặp mã chứng từ "${doc.id}" trong cùng hồ sơ.`)
        }
        seenDocIds.add(doc.id)

        if (doc.title !== undefined && typeof doc.title !== 'string') {
          errors.push(`Hồ sơ lô cây "${d.id}": Tiêu đề chứng từ "${doc.id}" phải là chuỗi ký tự.`)
        }
        if (doc.number !== undefined && typeof doc.number !== 'string') {
          errors.push(`Hồ sơ lô cây "${d.id}": Số hiệu chứng từ "${doc.id}" phải là chuỗi ký tự.`)
        }
        if (doc.issuedBy !== undefined && typeof doc.issuedBy !== 'string') {
          errors.push(`Hồ sơ lô cây "${d.id}": Nơi cấp chứng từ "${doc.id}" phải là chuỗi ký tự.`)
        }
        if (doc.issuedAt !== undefined && typeof doc.issuedAt !== 'string') {
          errors.push(`Hồ sơ lô cây "${d.id}": Ngày cấp chứng từ "${doc.id}" phải là chuỗi ký tự.`)
        }
        if (doc.note !== undefined && typeof doc.note !== 'string') {
          errors.push(`Hồ sơ lô cây "${d.id}": Ghi chú chứng từ "${doc.id}" phải là chuỗi ký tự.`)
        }
      }
    }
  }

  // FC0/FC3: outstanding > readyQuantity is legitimate commitment shortage.
  // Preserve it unchanged; reservation, stock and shipment integrity remain validated.
  // Validate the same Garden aggregates using existing domain authorities,
  // deriving per batch before summing. External sources never enter own totals.
  const ownReservations = reservations.filter(r => r.sourceType === 'own_batch')
  const available: number[] = [], shortages: number[] = [], outstanding: number[] = []
  for (const b of batches) {
    const related = ownReservations.filter(r => r.batchId === b.id)
    const total = checkedSum(related.map(remainingReservationQuantity), `Lô "${b.id}": Còn giữ`)
    if (total === undefined) continue
    outstanding.push(total)
    available.push(availableQuantityForBatch(b, related))
    shortages.push(commitmentShortageForBatch(b, related))
  }
  checkedSum(batches.map(b => b.currentQuantity), 'Vườn: Cây còn sống')
  checkedSum(batches.map(b => b.readyQuantity), 'Vườn: Cây đủ bán')
  checkedSum(outstanding, 'Vườn: Còn giữ')
  checkedSum(available, 'Vườn: Còn bán')
  checkedSum(shortages, 'Vườn: Thiếu cây đã giữ')

  // 13. Order total completed shipped <= requestedQuantity
  for (const o of orders) {
    if (!isRecord(o)) continue
    const totalShipped = checkedSum(shipments
      .filter((s) => s.orderId === o.id && s.status === 'completed')
      .map(s => s.shippedQuantity), `Đơn hàng "${o.id}": Tổng đã xuất`)

    if (totalShipped !== undefined && totalShipped > o.requestedQuantity) {
      errors.push(
        `Đơn hàng "${o.id}": Tổng số cây đã xuất giao (${totalShipped}) vượt quá số cây khách đặt (${o.requestedQuantity}).`
      )
    }
  }

  // 14. Event entity validation
  for (const e of events) {
    if (!isRecord(e)) continue
    if (!isNonEmptyString(e.type)) {
      errors.push(`Sự kiện "${e.id}": Loại sự kiện (type) không được để trống.`)
    }
    if (!isNonEmptyString(e.entityType)) {
      errors.push(`Sự kiện "${e.id}": Loại đối tượng (entityType) không được để trống.`)
    }
    if (!isNonEmptyString(e.entityId)) {
      errors.push(`Sự kiện "${e.id}": Mã đối tượng (entityId) không được để trống.`)
    }
    if (!isNonEmptyString(e.createdAt)) {
      errors.push(`Sự kiện "${e.id}": Thời điểm tạo (createdAt) không được để trống.`)
    }
  }

  return {
    valid: errors.length === 0,
    errors
  }
}
