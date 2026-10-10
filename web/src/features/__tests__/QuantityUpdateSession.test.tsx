import { StrictMode, useLayoutEffect } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ReadyQuantityUpdateModal } from '../batches/ReadyQuantityUpdateModal'
import { InventoryUpdateModal } from '../batches/InventoryUpdateModal'
import { db } from '../../data/db'
import { clearAllData } from '../../data/seed'
import * as batchService from '../../services/batchService'
import { undoService } from '../../services/undoService'
import type { Batch } from '../../domain/batch'

const a: Batch = { id: 'a', code: 'M06', variety: 'Monthong', createdAt: '2026-10-01',
  initialQuantity: 30, currentQuantity: 30, readyQuantity: 15, status: 'ready' }
const b: Batch = { ...a, id: 'b', code: 'M07', initialQuantity: 40, currentQuantity: 40, readyQuantity: 20 }
type Kind = 'ready' | 'inventory'
const input = (kind: Kind) => screen.getByLabelText(kind === 'ready'
  ? /Tổng số cây đủ chuẩn hiện tại/ : /Hiện còn bao nhiêu cây sống/)
const note = () => screen.getByLabelText(/Ghi chú.*tùy chọn/)
function modal(kind: Kind, batch: Batch, onSuccess: (updated: Batch) => void, isOpen = true) {
  return kind === 'ready'
    ? <ReadyQuantityUpdateModal batch={batch} reservedQuantity={0} isOpen={isOpen} onClose={() => {}} onSuccess={onSuccess} />
    : <InventoryUpdateModal batch={batch} reservations={[]} isOpen={isOpen} onClose={() => {}} onSuccess={onSuccess} />
}
beforeEach(async () => { await clearAllData(); undoService.clearLastMutation(); await db.batches.bulkPut([a, b]) })
afterEach(() => { cleanup(); vi.restoreAllMocks(); undoService.clearLastMutation() })

describe('quantity editing sessions (real Dexie)', () => {
  it.each([a, b])('Q01–Q06: $code ready edit before passive effects survives StrictMode and commits exactly once', async batch => {
    const success = vi.fn(), spy = vi.spyOn(batchService, 'updateBatchReadyQuantity')
    function BeforePassiveEffects() {
      // Exercise the DOM-committed / passive-effect-pending boundary without sleeps or mocked effects.
      useLayoutEffect(() => { fireEvent.change(input('ready'), { target: { value: '10' } }) }, [])
      return modal('ready', batch, success)
    }
    render(<StrictMode><BeforePassiveEffects /></StrictMode>)
    expect(input('ready')).toHaveValue('10')
    expect(screen.getByText('= 10 cây')).toBeInTheDocument()
    const save = screen.getByRole('button', { name: 'CẬP NHẬT' })
    act(() => { save.click(); save.click() })
    await waitFor(() => expect(success).toHaveBeenCalledOnce())
    expect(spy).toHaveBeenCalledExactlyOnceWith({ batchId: batch.id, newReadyQuantity: 10, note: undefined })
    expect((await db.batches.get(batch.id))?.readyQuantity).toBe(10)
    expect((await db.events.toArray()).filter(event => event.type === 'batch_ready_stock_updated')).toHaveLength(1)
  })

  it('Q03/Q04/Q12: living edit before passive effects survives initialization and commits its visible value', async () => {
    const success = vi.fn()
    function BeforePassiveEffects() {
      useLayoutEffect(() => { fireEvent.change(input('inventory'), { target: { value: '25' } }) }, [])
      return modal('inventory', a, success)
    }
    render(<StrictMode><BeforePassiveEffects /></StrictMode>)
    expect(input('inventory')).toHaveValue('25')
    expect(screen.getByText('= 25 cây')).toBeInTheDocument()
    const save = screen.getByRole('button', { name: 'CẬP NHẬT' })
    act(() => { save.click(); save.click() })
    await waitFor(() => expect(success).toHaveBeenCalledOnce())
    expect(await db.batches.get('a')).toMatchObject({ currentQuantity: 25, readyQuantity: 15 })
    expect((await db.events.toArray()).filter(event => event.type === 'batch_inventory_updated')).toHaveLength(1)
  })

  it.each(['ready', 'inventory'] as const)('Q07/Q10/Q14: %s dirty draft survives refreshed facts; commit/Undo use current authority', async kind => {
    const success = vi.fn(), value = kind === 'ready' ? '10' : '25'
    const view = render(<StrictMode>{modal(kind, a, success)}</StrictMode>)
    fireEvent.change(input(kind), { target: { value } })
    fireEvent.change(note(), { target: { value: 'TEST note' } })
    view.rerender(<StrictMode>{modal(kind, { ...a }, success)}</StrictMode>)
    expect(input(kind)).toHaveValue(value)
    const fresh = { ...a, currentQuantity: 24, readyQuantity: 12 }
    await db.batches.put(fresh)
    view.rerender(<StrictMode>{modal(kind, fresh, success)}</StrictMode>)
    expect(input(kind)).toHaveValue(value)
    expect(note()).toHaveValue('TEST note')
    fireEvent.click(screen.getByRole('button', { name: 'CẬP NHẬT' }))
    await waitFor(() => expect(success).toHaveBeenCalledOnce())
    expect(await db.batches.get('a')).toMatchObject(kind === 'ready'
      ? { currentQuantity: 24, readyQuantity: 10 } : { currentQuantity: 25, readyQuantity: 12 })
    expect((await undoService.undoLastMutation()).success).toBe(true)
    expect(await db.batches.get('a')).toEqual(fresh)
  })

  it.each(['ready', 'inventory'] as const)('Q08/Q09: %s batch switch and close/reopen reset the whole session from current facts', async kind => {
    const success = vi.fn(), view = render(<StrictMode>{modal(kind, a, success)}</StrictMode>)
    fireEvent.change(screen.getByLabelText('Đơn vị tính số lượng'), { target: { value: 'van' } })
    fireEvent.change(input(kind), { target: { value: '0,001' } })
    fireEvent.change(note(), { target: { value: 'discard this session' } })
    view.rerender(<StrictMode>{modal(kind, b, success)}</StrictMode>)
    expect(input(kind)).toHaveValue(kind === 'ready' ? '20' : '40')
    expect(screen.getByLabelText('Đơn vị tính số lượng')).toHaveValue('cay')
    expect(note()).toHaveValue('')
    view.rerender(<StrictMode>{modal(kind, b, success, false)}</StrictMode>)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    const fresh = { ...b, currentQuantity: 32, readyQuantity: 18 }
    await db.batches.put(fresh)
    view.rerender(<StrictMode>{modal(kind, fresh, success)}</StrictMode>)
    expect(input(kind)).toHaveValue(kind === 'ready' ? '18' : '32')
    expect(screen.getByLabelText('Đơn vị tính số lượng')).toHaveValue('cay')
    expect(screen.queryByLabelText(/Cây đủ bán hiện tại:/)).not.toBeInTheDocument()
    expect(success).not.toHaveBeenCalled()
    expect(await db.events.count()).toBe(0)
  })

  it.each([
    ['ready', 'cay', '10', 10], ['ready', 'van', '0,001', 10],
    ['inventory', 'cay', '25', 25], ['inventory', 'van', '0,0025', 25]
  ] as const)('Q11: %s %s raw %s displays and submits %i', async (kind, unit, raw, quantity) => {
    const success = vi.fn()
    const spy = kind === 'ready' ? vi.spyOn(batchService, 'updateBatchReadyQuantity') : vi.spyOn(batchService, 'updateBatchInventory')
    render(<StrictMode>{modal(kind, a, success)}</StrictMode>)
    fireEvent.change(screen.getByLabelText('Đơn vị tính số lượng'), { target: { value: unit } })
    fireEvent.change(input(kind), { target: { value: raw } })
    expect(input(kind)).toHaveValue(raw)
    expect(screen.getByText(`= ${quantity} cây`)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'CẬP NHẬT' }))
    await waitFor(() => expect(success).toHaveBeenCalledOnce())
    expect(spy).toHaveBeenCalledExactlyOnceWith(kind === 'ready'
      ? { batchId: 'a', newReadyQuantity: quantity, note: undefined }
      : { batchId: 'a', newQuantity: quantity, newReadyQuantity: undefined, note: undefined })
    expect((await db.batches.get('a'))?.[kind === 'ready' ? 'readyQuantity' : 'currentQuantity']).toBe(quantity)
  })

  it.each(['ready', 'inventory'] as const)('Q10/Q13: %s save revalidates unseen persisted changes, keeps draft and allows explicit retry', async kind => {
    const success = vi.fn(), value = kind === 'ready' ? '10' : '25'
    const view = render(<StrictMode>{modal(kind, a, success)}</StrictMode>)
    fireEvent.change(input(kind), { target: { value } })
    const fresh = kind === 'ready' ? { ...a, currentQuantity: 8, readyQuantity: 8 }
      : { ...a, initialQuantity: 20, currentQuantity: 20, readyQuantity: 15 }
    await db.batches.put(fresh)
    fireEvent.click(screen.getByRole('button', { name: 'CẬP NHẬT' }))
    await screen.findByText(kind === 'ready' ? /không thể lớn hơn số cây còn sống/ : /không thể lớn hơn số lượng cắm hom/)
    expect(input(kind)).toHaveValue(value)
    expect(await db.batches.get('a')).toEqual(fresh)
    expect(await db.events.count()).toBe(0)
    expect(success).not.toHaveBeenCalled()
    expect(undoService.getLastMutation()).toBeNull()
    view.rerender(<StrictMode>{modal(kind, fresh, success)}</StrictMode>)
    expect(input(kind)).toHaveValue(value)
    expect(screen.getByRole('button', { name: 'CẬP NHẬT' })).toBeDisabled()
    fireEvent.change(input(kind), { target: { value: '7' } })
    if (kind === 'inventory') fireEvent.change(screen.getByLabelText(/Cây đủ bán hiện tại:/), { target: { value: '6' } })
    fireEvent.click(screen.getByRole('button', { name: 'CẬP NHẬT' }))
    await waitFor(() => expect(success).toHaveBeenCalledOnce())
    expect((await db.batches.get('a'))?.[kind === 'ready' ? 'readyQuantity' : 'currentQuantity']).toBe(7)
  })
})
