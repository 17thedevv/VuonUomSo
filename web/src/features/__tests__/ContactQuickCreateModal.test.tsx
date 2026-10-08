import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { ContactQuickCreateModal } from '../orders/ContactQuickCreateModal'
import { createContact } from '../../services/contactService'
import { db } from '../../data/db'
import { clearAllData } from '../../data/seed'

vi.mock('../../validation/validationTracker', () => ({ validationTracker: { actionCompleted: vi.fn(), actionFailed: vi.fn() } }))

function setup(mode?: 'customer' | 'supplier') {
  const onSuccess = vi.fn()
  render(<ContactQuickCreateModal isOpen mode={mode} onClose={vi.fn()} onSuccess={onSuccess} />)
  return onSuccess
}
describe('Quick contact customer/supplier roles (real Dexie)', () => {
  beforeEach(async () => { await clearAllData(); vi.clearAllMocks() })
  afterEach(() => { cleanup(); vi.restoreAllMocks() })

  it('keeps default customer wording and creates only customer role', async () => {
    const success = setup()
    expect(screen.getByRole('heading', { name: 'Thêm khách mới' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/Tên khách hàng/), { target: { value: 'Khách mới' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu khách' }))
    await waitFor(() => expect(success).toHaveBeenCalledWith(expect.objectContaining({ roles: ['customer'] })))
    expect(await db.reservations.count()).toBe(0)
  })

  it('creates supplier without phone, without commitment, and prevents duplicate taps', async () => {
    const success = setup('supplier')
    fireEvent.click(screen.getByRole('button', { name: 'Lưu nhà vườn' }))
    expect(screen.getByText('Vui lòng nhập tên nhà vườn.')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/Tên nhà vườn/), { target: { value: 'Vườn mới' } })
    const submit = screen.getByRole('button', { name: 'Lưu nhà vườn' })
    fireEvent.click(submit); fireEvent.click(submit)
    await waitFor(() => expect(success).toHaveBeenCalledTimes(1))
    expect(success).toHaveBeenCalledWith(expect.objectContaining({ roles: ['supplier'], phone: undefined }))
    expect(await db.contacts.count()).toBe(1)
    expect(await db.reservations.count()).toBe(0)
  })

  it('can reuse a duplicate supplier/dual-role contact by explicit action', async () => {
    const existing = (await createContact({ name: 'Vườn cũ', phone: '0912345678', roles: ['customer', 'supplier'] })).contact!
    const success = setup('supplier')
    fireEvent.change(screen.getByLabelText(/Tên nhà vườn/), { target: { value: 'Vườn mới' } })
    fireEvent.change(screen.getByLabelText(/Số điện thoại/), { target: { value: '0912 345 678' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu nhà vườn' }))
    await screen.findByRole('button', { name: 'Dùng nhà vườn này' })
    expect(success).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Dùng nhà vườn này' }))
    expect(success).toHaveBeenCalledWith(existing)
    expect(await db.contacts.count()).toBe(1)
  })

  it('never silently reuses customer-only duplicate; explicit separate supplier preserves the customer', async () => {
    const customer = (await createContact({ name: 'Khách cũ', phone: '0912345678' })).contact!
    const success = setup('supplier')
    fireEvent.change(screen.getByLabelText(/Tên nhà vườn/), { target: { value: 'Vườn riêng' } })
    fireEvent.change(screen.getByLabelText(/Số điện thoại/), { target: { value: '0912345678' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu nhà vườn' }))
    await screen.findByText(/Liên hệ này chỉ là khách hàng/)
    expect(screen.queryByRole('button', { name: 'Dùng nhà vườn này' })).not.toBeInTheDocument()
    expect(success).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Vẫn tạo nhà vườn mới' }))
    await waitFor(() => expect(success).toHaveBeenCalledWith(expect.objectContaining({ name: 'Vườn riêng', roles: ['supplier'] })))
    expect(await db.contacts.get(customer.id)).toEqual(customer)
    expect(await db.contacts.count()).toBe(2)
    expect(await db.reservations.count()).toBe(0)
  })

  it('event failure does not report saved supplier or leave a ghost contact', async () => {
    vi.spyOn(db.events, 'put').mockRejectedValueOnce(new Error('storage failure'))
    const success = setup('supplier')
    fireEvent.change(screen.getByLabelText(/Tên nhà vườn/), { target: { value: 'Vườn mới' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu nhà vườn' }))
    await screen.findByText(/Chưa lưu được thông tin nhà vườn/)
    expect(success).not.toHaveBeenCalled()
    expect(await db.contacts.count()).toBe(0)
  })
})
