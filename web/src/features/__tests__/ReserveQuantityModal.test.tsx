import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ReserveQuantityModal, type ReserveSource } from '../orders/ReserveQuantityModal'
import { reserveOwnBatch, reserveExternalSupplier } from '../../services/reservationService'

vi.mock('../../services/reservationService', () => ({
  reserveOwnBatch: vi.fn().mockResolvedValue({}),
  reserveExternalSupplier: vi.fn().mockResolvedValue({})
}))
vi.mock('../../validation/validationTracker', () => ({
  validationTracker: {
    formStarted: vi.fn(),
    actionCompleted: vi.fn(),
    actionFailed: vi.fn()
  }
}))

const ownSource: ReserveSource = {
  type: 'own_batch',
  batch: {
    id: 'batch_32k', code: 'BV16 #01', variety: 'Keo lai BV16',
    initialQuantity: 50000, currentQuantity: 50000, readyQuantity: 32000,
    reservedQuantity: 0, availableQuantity: 32000, isAttention: false,
    status: 'ready', createdAt: '2026-10-08'
  }
}

function setup(source: ReserveSource = ownSource, orderShortage = 50000) {
  const props = {
    isOpen: true, orderId: 'order_test', orderVariety: 'Keo lai BV16',
    orderShortage, source, onClose: vi.fn(), onSuccess: vi.fn()
  }
  return { ...render(<ReserveQuantityModal {...props} />), props }
}

describe('ReserveQuantityModal quantity units', () => {
  beforeEach(() => vi.clearAllMocks())

  it('keeps the 32,000-plant default, helper, edited value and saved quantity consistent', async () => {
    setup()
    const input = screen.getByLabelText(/Số lượng giữ/)
    expect(input).toHaveValue('32000')
    expect(screen.getByText('= 32.000 cây')).toBeInTheDocument()
    expect(screen.queryByText('= 320.000.000 cây')).not.toBeInTheDocument()
    fireEvent.change(input, { target: { value: '32000' } })
    fireEvent.click(screen.getByRole('button', { name: 'GIỮ 32.000 CÂY' }))
    await waitFor(() => expect(reserveOwnBatch).toHaveBeenCalledWith({
      orderId: 'order_test', batchId: 'batch_32k', quantity: 32000
    }))
  })

  it('keeps quick vạn chips consistent and restores cây units when taking the batch maximum', async () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: '2 vạn' }))
    expect(screen.getByText('= 20.000 cây')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'GIỮ 20.000 CÂY' })).toBeEnabled()
    expect(screen.getByRole('combobox', { name: 'Đơn vị tính số lượng' })).toHaveValue('van')
    fireEvent.click(screen.getByRole('button', { name: '5 vạn' }))
    expect(screen.getByText('= 50.000 cây')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'XÁC NHẬN GIỮ CÂY' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Giữ hết lô (32.000 cây)' }))
    expect(screen.getByRole('combobox', { name: 'Đơn vị tính số lượng' })).toHaveValue('cay')
    expect(screen.getByText('= 32.000 cây')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'GIỮ 32.000 CÂY' }))
    await waitFor(() => expect(reserveOwnBatch).toHaveBeenCalledWith({
      orderId: 'order_test', batchId: 'batch_32k', quantity: 32000
    }))
  })

  it('previews the order maximum truthfully and still blocks quantities exceeding the batch', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: '2 vạn' }))
    fireEvent.click(screen.getByRole('button', { name: 'Giữ đủ đơn (50.000 cây)' }))
    expect(screen.getByText('= 50.000 cây')).toBeInTheDocument()
    expect(screen.getByLabelText(/Số lượng giữ/)).toHaveValue('50000')
    expect(screen.getByRole('combobox', { name: 'Đơn vị tính số lượng' })).toHaveValue('cay')
    expect(screen.getByRole('button', { name: 'XÁC NHẬN GIỮ CÂY' })).toBeDisabled()
    expect(reserveOwnBatch).not.toHaveBeenCalled()
  })

  it('submits decimal vạn input in the selected unit as the previewed plant quantity', async () => {
    setup()
    fireEvent.change(screen.getByRole('combobox', { name: 'Đơn vị tính số lượng' }), { target: { value: 'van' } })
    fireEvent.change(screen.getByLabelText(/Số lượng giữ/), { target: { value: '3,2' } })
    expect(screen.getByText('= 32.000 cây')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'GIỮ 32.000 CÂY' }))
    await waitFor(() => expect(reserveOwnBatch).toHaveBeenCalledWith({
      orderId: 'order_test', batchId: 'batch_32k', quantity: 32000
    }))
  })

  it('accepts explicit vạn input even when the selected unit is cây', async () => {
    setup()
    fireEvent.change(screen.getByLabelText(/Số lượng giữ/), { target: { value: '3,2 vạn' } })
    expect(screen.getByText('= 32.000 cây')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'GIỮ 32.000 CÂY' }))
    await waitFor(() => expect(reserveOwnBatch).toHaveBeenCalledWith({
      orderId: 'order_test', batchId: 'batch_32k', quantity: 32000
    }))
  })

  it('resets the input unit when reopening after a quick vạn chip', () => {
    const { rerender, props } = setup()
    fireEvent.click(screen.getByRole('button', { name: '1 vạn' }))
    rerender(<ReserveQuantityModal {...props} isOpen={false} />)
    rerender(<ReserveQuantityModal {...props} />)
    expect(screen.getByRole('combobox', { name: 'Đơn vị tính số lượng' })).toHaveValue('cay')
    expect(screen.getByLabelText(/Số lượng giữ/)).toHaveValue('32000')
    expect(screen.getByText('= 32.000 cây')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'GIỮ 32.000 CÂY' })).toBeEnabled()
  })

  it('keeps external source defaults and order maximum consistent after a vạn chip', async () => {
    setup({
      type: 'external_supplier',
      supplier: { supplierId: 'supplier_test', name: 'Vườn thử', variety: 'Keo lai BV16', estimatedQuantity: 35000 }
    }, 32000)
    expect(screen.getByText('= 32.000 cây')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '2 vạn' }))
    fireEvent.click(screen.getByRole('button', { name: 'Giữ đủ đơn (32.000 cây)' }))
    expect(screen.getByText('= 32.000 cây')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Đơn vị tính số lượng' })).toHaveValue('cay')
    fireEvent.click(screen.getByRole('button', { name: 'GIỮ 32.000 CÂY' }))
    await waitFor(() => expect(reserveExternalSupplier).toHaveBeenCalledWith({
      orderId: 'order_test', supplierId: 'supplier_test', quantity: 32000
    }))
  })
})
