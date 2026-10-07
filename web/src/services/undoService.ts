import { batchRepository, orderRepository, eventRepository } from '../data/repositories'
import { releaseReservation } from './reservationService'
import { deriveBatchStatus } from '../domain/batch'

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
      description: string
    }
  | {
      type: 'update_ready_quantity'
      batchId: string
      batchCode: string
      previousReadyQuantity: number
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
    this.currentMutation = mutation
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
        const batch = await batchRepository.getById(mutation.batchId)
        if (!batch) {
          this.clearLastMutation()
          return { success: false, message: 'Lô cây không còn tồn tại.' }
        }

        // Delete newly created batch
        await batchRepository.delete(mutation.batchId)

        // Record undo event
        await eventRepository.record({
          type: 'mutation_undone',
          entityType: 'batch',
          entityId: mutation.batchId,
          payload: {
            action: 'delete_batch',
            batchCode: mutation.batchCode
          }
        })

        this.clearLastMutation()
        return {
          success: true,
          message: `Đã hoàn tác: Đã xóa lô ${mutation.batchCode}.`,
          revertedType: 'create_batch'
        }
      }

      if (mutation.type === 'update_inventory') {
        const batch = await batchRepository.getById(mutation.batchId)
        if (!batch) {
          this.clearLastMutation()
          return { success: false, message: 'Lô cây không còn tồn tại.' }
        }

        const oldCurrent = batch.currentQuantity
        const oldReady = batch.readyQuantity
        batch.currentQuantity = mutation.previousQuantity

        if (mutation.previousReadyQuantity !== undefined) {
          batch.readyQuantity = mutation.previousReadyQuantity
        }

        batch.status = deriveBatchStatus(batch)

        await batchRepository.save(batch)

        // Record undo event
        await eventRepository.record({
          type: 'mutation_undone',
          entityType: 'batch',
          entityId: mutation.batchId,
          payload: {
            action: 'restore_inventory',
            batchCode: mutation.batchCode,
            fromQuantity: oldCurrent,
            restoredQuantity: mutation.previousQuantity,
            fromReadyQuantity: mutation.previousReadyQuantity !== undefined ? oldReady : undefined,
            restoredReadyQuantity: mutation.previousReadyQuantity
          }
        })

        this.clearLastMutation()
        return {
          success: true,
          message: `Đã hoàn tác kiểm kê lô ${mutation.batchCode}: Khôi phục về ${mutation.previousQuantity.toLocaleString('vi-VN')} cây.`,
          revertedType: 'update_inventory'
        }
      }

      if (mutation.type === 'update_ready_quantity') {
        const batch = await batchRepository.getById(mutation.batchId)
        if (!batch) {
          this.clearLastMutation()
          return { success: false, message: 'Lô cây không còn tồn tại.' }
        }

        const oldReady = batch.readyQuantity
        batch.readyQuantity = mutation.previousReadyQuantity
        batch.status = deriveBatchStatus(batch)

        await batchRepository.save(batch)

        // Record undo event
        await eventRepository.record({
          type: 'mutation_undone',
          entityType: 'batch',
          entityId: mutation.batchId,
          payload: {
            action: 'restore_ready_quantity',
            batchCode: mutation.batchCode,
            fromReadyQuantity: oldReady,
            restoredReadyQuantity: mutation.previousReadyQuantity
          }
        })

        this.clearLastMutation()
        return {
          success: true,
          message: `Đã hoàn tác cập nhật cây đủ bán lô ${mutation.batchCode}: Khôi phục về ${mutation.previousReadyQuantity.toLocaleString('vi-VN')} cây.`,
          revertedType: 'update_ready_quantity'
        }
      }

      if (mutation.type === 'create_order') {
        const order = await orderRepository.getById(mutation.orderId)
        if (!order) {
          this.clearLastMutation()
          return { success: false, message: 'Đơn hàng không còn tồn tại.' }
        }

        // Delete newly created order
        await orderRepository.delete(mutation.orderId)

        // Record undo event
        await eventRepository.record({
          type: 'mutation_undone',
          entityType: 'order',
          entityId: mutation.orderId,
          payload: {
            action: 'delete_order',
            orderId: mutation.orderId,
            customerName: mutation.customerName
          }
        })

        this.clearLastMutation()
        return {
          success: true,
          message: `Đã hoàn tác: Đã xóa đơn hàng của ${mutation.customerName}.`,
          revertedType: 'create_order'
        }
      }

      if (mutation.type === 'create_reservation') {
        await releaseReservation({ reservationId: mutation.reservationId })

        this.clearLastMutation()
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
