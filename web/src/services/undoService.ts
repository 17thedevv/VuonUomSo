import { db } from '../data/db'
import { createDomainEvent } from '../analytics/events'
import { releaseReservation } from './reservationService'
import { deriveBatchStatus } from '../domain/batch'
import type { Reservation } from '../domain/reservation'

export type ReversibleMutation =
  | {
      type: 'create_batch'
      batchId: string
      batchCode: string
      description: string
    }
  | {
      type: 'update_inventory'
      batchId: string
      batchCode: string
      previousQuantity: number
      previousReadyQuantity?: number
      expectedCurrentQuantity?: number
      expectedReadyQuantity?: number
      description: string
    }
  | {
      type: 'update_ready_quantity'
      batchId: string
      batchCode: string
      previousReadyQuantity: number
      expectedReadyQuantity?: number
      expectedCurrentQuantity?: number
      description: string
    }
  | {
      type: 'create_order'
      orderId: string
      customerName: string
      description: string
    }
  | {
      type: 'create_reservation'
      reservationId: string
      orderId: string
      expectedReservation: Reservation
      expectedOrderEventIds: string[]
      description: string
    }

class UndoService {
  private currentMutation: ReversibleMutation | null = null
  private listeners: Set<() => void> = new Set()
  private timer: ReturnType<typeof setTimeout> | null = null

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private notify() {
    this.listeners.forEach((listener) => listener())
  }

  recordMutation(mutation: ReversibleMutation, autoExpireMs: number = 10000) {
    if (this.timer) {
      clearTimeout(this.timer)
    }
    this.currentMutation = mutation.type === 'create_reservation'
      ? { ...mutation, expectedReservation: { ...mutation.expectedReservation },
        expectedOrderEventIds: [...mutation.expectedOrderEventIds] }
      : mutation
    this.notify()

    if (autoExpireMs > 0) {
      this.timer = setTimeout(() => {
        this.clearLastMutation()
      }, autoExpireMs)
    }
  }

  getLastMutation(): ReversibleMutation | null {
    return this.currentMutation
  }

  clearLastMutation() {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    this.currentMutation = null
    this.notify()
  }

  async undoLastMutation(): Promise<{ success: boolean; message: string; revertedType?: string }> {
    const mutation = this.currentMutation
    if (!mutation) {
      return { success: false, message: 'Không có thao tác nào để hoàn tác.' }
    }

    try {
      if (mutation.type === 'create_batch') {
        const txResult = await db.transaction('rw', [db.batches, db.events], async () => {
          const batch = await db.batches.get(mutation.batchId)
          if (!batch) {
            return { status: 'not_found' as const }
          }

          await db.batches.delete(mutation.batchId)
          const undoEvent = createDomainEvent('mutation_undone', 'batch', mutation.batchId, {
            action: 'delete_batch',
            batchCode: mutation.batchCode
          })
          await db.events.put(undoEvent)

          return { status: 'success' as const }
        })

        if (txResult.status === 'not_found') {
          this.clearLastMutation()
          return { success: false, message: 'Lô cây không còn tồn tại.' }
        }

        this.clearLastMutation()
        return {
          success: true,
          message: `Đã hoàn tác: Đã xóa lô ${mutation.batchCode}.`,
          revertedType: 'create_batch'
        }
      }

      if (mutation.type === 'update_inventory') {
        const txResult = await db.transaction('rw', [db.batches, db.events], async () => {
          const batch = await db.batches.get(mutation.batchId)
          if (!batch) {
            return { status: 'not_found' as const }
          }

          // Guard against intervening mutations INSIDE the transaction
          if (
            (mutation.expectedCurrentQuantity !== undefined && batch.currentQuantity !== mutation.expectedCurrentQuantity) ||
            (mutation.expectedReadyQuantity !== undefined && batch.readyQuantity !== mutation.expectedReadyQuantity)
          ) {
            return { status: 'conflict' as const }
          }

          const oldCurrent = batch.currentQuantity
          const oldReady = batch.readyQuantity
          batch.currentQuantity = mutation.previousQuantity

          if (mutation.previousReadyQuantity !== undefined) {
            batch.readyQuantity = mutation.previousReadyQuantity
          }

          batch.status = deriveBatchStatus(batch)

          await db.batches.put(batch)
          const undoEvent = createDomainEvent('mutation_undone', 'batch', mutation.batchId, {
            action: 'restore_inventory',
            batchCode: mutation.batchCode,
            fromQuantity: oldCurrent,
            restoredQuantity: mutation.previousQuantity,
            fromReadyQuantity: mutation.previousReadyQuantity !== undefined ? oldReady : undefined,
            restoredReadyQuantity: mutation.previousReadyQuantity
          })
          await db.events.put(undoEvent)

          return { status: 'success' as const }
        })

        if (txResult.status === 'not_found') {
          this.clearLastMutation()
          return { success: false, message: 'Lô cây không còn tồn tại.' }
        }

        if (txResult.status === 'conflict') {
          this.clearLastMutation()
          return {
            success: false,
            message: 'Không thể hoàn tác vì lô đã thay đổi sau thao tác này.'
          }
        }

        this.clearLastMutation()
        return {
          success: true,
          message: `Đã hoàn tác kiểm kê lô ${mutation.batchCode}: Khôi phục về ${mutation.previousQuantity.toLocaleString('vi-VN')} cây.`,
          revertedType: 'update_inventory'
        }
      }

      if (mutation.type === 'update_ready_quantity') {
        const txResult = await db.transaction('rw', [db.batches, db.events], async () => {
          const batch = await db.batches.get(mutation.batchId)
          if (!batch) {
            return { status: 'not_found' as const }
          }

          // Guard against intervening mutations INSIDE the transaction
          if (
            (mutation.expectedReadyQuantity !== undefined && batch.readyQuantity !== mutation.expectedReadyQuantity) ||
            (mutation.expectedCurrentQuantity !== undefined && batch.currentQuantity !== mutation.expectedCurrentQuantity)
          ) {
            return { status: 'conflict' as const }
          }

          const oldReady = batch.readyQuantity
          batch.readyQuantity = mutation.previousReadyQuantity
          batch.status = deriveBatchStatus(batch)

          await db.batches.put(batch)
          const undoEvent = createDomainEvent('mutation_undone', 'batch', mutation.batchId, {
            action: 'restore_ready_quantity',
            batchCode: mutation.batchCode,
            fromReadyQuantity: oldReady,
            restoredReadyQuantity: mutation.previousReadyQuantity
          })
          await db.events.put(undoEvent)

          return { status: 'success' as const }
        })

        if (txResult.status === 'not_found') {
          this.clearLastMutation()
          return { success: false, message: 'Lô cây không còn tồn tại.' }
        }

        if (txResult.status === 'conflict') {
          this.clearLastMutation()
          return {
            success: false,
            message: 'Không thể hoàn tác vì lô đã thay đổi sau thao tác này.'
          }
        }

        this.clearLastMutation()
        return {
          success: true,
          message: `Đã hoàn tác cập nhật cây đủ bán lô ${mutation.batchCode}: Khôi phục về ${mutation.previousReadyQuantity.toLocaleString('vi-VN')} cây.`,
          revertedType: 'update_ready_quantity'
        }
      }

      if (mutation.type === 'create_order') {
        const txResult = await db.transaction('rw', [db.orders, db.reservations, db.shipments, db.events], async () => {
          const order = await db.orders.get(mutation.orderId)
          if (!order) {
            return { status: 'not_found' as const }
          }

          const reservations = await db.reservations.where('orderId').equals(order.id).count()
          const shipments = await db.shipments.where('orderId').equals(order.id).count()
          const corrected = await db.events.where('entityId').equals(order.id)
            .filter((e) => e.entityType === 'order' && (e.type === 'order_updated' || e.type === 'order_cancelled')).count()
          if (order.status !== 'open' || reservations > 0 || shipments > 0 || corrected > 0) {
            return { status: 'changed' as const }
          }

          await db.orders.delete(mutation.orderId)
          const undoEvent = createDomainEvent('mutation_undone', 'order', mutation.orderId, {
            action: 'delete_order',
            orderId: mutation.orderId,
            customerName: mutation.customerName
          })
          await db.events.put(undoEvent)

          return { status: 'success' as const }
        })

        if (txResult.status === 'not_found') {
          this.clearLastMutation()
          return { success: false, message: 'Đơn hàng không còn tồn tại.' }
        }

        if (txResult.status === 'changed') {
          this.clearLastMutation()
          return { success: false, message: 'Không thể xóa đơn bằng hoàn tác vì đơn đã có thay đổi hoặc lịch sử giữ/xuất cây.' }
        }

        this.clearLastMutation()
        return {
          success: true,
          message: `Đã hoàn tác: Đã xóa đơn hàng của ${mutation.customerName}.`,
          revertedType: 'create_order'
        }
      }

      if (mutation.type === 'create_reservation') {
        const released = await db.transaction(
          'rw', [db.batches, db.orders, db.reservations, db.shipments, db.events, db.contacts], async () => {
            const current = await db.reservations.get(mutation.reservationId)
            const expected = mutation.expectedReservation
            if (!current || !expected || expected.id !== mutation.reservationId ||
              expected.orderId !== mutation.orderId || expected.status !== 'active' ||
              (expected.fulfilledQuantity ?? 0) !== 0 ||
              current.id !== expected.id || current.orderId !== expected.orderId ||
              current.quantity !== expected.quantity ||
              (current.fulfilledQuantity ?? 0) !== (expected.fulfilledQuantity ?? 0) ||
              current.status !== expected.status || current.sourceType !== expected.sourceType ||
              current.batchId !== expected.batchId || current.supplierId !== expected.supplierId ||
              current.createdAt !== expected.createdAt) return false

            const order = await db.orders.get(current.orderId)
            if (!order || order.status === 'cancelled' || order.status === 'shipped') return false
            if (current.sourceType === 'own_batch') {
              if (!current.batchId || !await db.batches.get(current.batchId)) return false
            } else {
              const supplier = current.supplierId ? await db.contacts.get(current.supplierId) : undefined
              if (!supplier?.roles.includes('supplier')) return false
            }

            // Fail closed on any intervening order history, including reconciliation
            // that restores the original Q/source. IDs avoid timestamp collisions.
            const eventIds = await db.events.where('entityId').equals(current.orderId)
              .filter(e => e.entityType === 'order').primaryKeys()
            const expectedIds = new Set(mutation.expectedOrderEventIds)
            if (eventIds.length !== expectedIds.size || eventIds.some(id => !expectedIds.has(id))) return false
            const shipmentHistory = await db.shipments
              .filter(s => (s.lines ?? []).some(line => line.reservationId === current.id)).first()
            if (shipmentHistory) return false

            // Nested Dexie transaction joins this transaction: no gap between
            // guard reads and the existing release/order/event writes.
            await releaseReservation({ reservationId: current.id })
            return true
          }
        )
        this.clearLastMutation()
        if (!released) return {
          success: false,
          message: 'Không thể hoàn tác vì nguồn giữ đã thay đổi sau thao tác này.'
        }
        return {
          success: true,
          message: 'Đã hoàn tác: Đã bỏ giữ cây.',
          revertedType: 'create_reservation'
        }
      }

      return { success: false, message: 'Loại thao tác không hỗ trợ hoàn tác.' }
    } catch (err) {
      console.error('Error undoing mutation:', err)
      return { success: false, message: 'Không thể hoàn tác thao tác này.' }
    }
  }
}

export const undoService = new UndoService()
