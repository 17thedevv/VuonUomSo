import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { db } from '../../data/db'
import { createContact } from '../contactService'
import { contactRepository, eventRepository } from '../../data/repositories'
import { clearAllData } from '../../data/seed'

describe('contactService', () => {
  beforeEach(async () => {
    await clearAllData()
  })
  afterEach(() => vi.restoreAllMocks())

  it('creates a supplier without a phone or any commitment and records history atomically', async () => {
    const result = await createContact({ name: 'Nhà vườn mới', roles: ['supplier'] })
    expect(result).toMatchObject({ success: true, contact: { name: 'Nhà vườn mới', roles: ['supplier'] } })
    expect(await db.reservations.count()).toBe(0)
    expect(await db.events.count()).toBe(1)
  })

  it('duplicate customer-only phone remains customer-only; explicit new supplier preserves existing contact', async () => {
    const customer = (await createContact({ name: 'Khách', phone: '0912345678' })).contact!
    const input = { name: 'Nhà vườn riêng', phone: '0912 345 678', roles: ['supplier'] as const }
    expect(await createContact({ ...input, roles: [...input.roles] })).toMatchObject({ success: false, duplicateWarning: true, existingContact: customer })
    expect(await db.contacts.get(customer.id)).toEqual(customer)
    const supplier = await createContact({ ...input, roles: [...input.roles], allowDuplicatePhone: true })
    expect(supplier).toMatchObject({ success: true, contact: { roles: ['supplier'] } })
    expect(supplier.contact!.id).not.toBe(customer.id)
    expect(await db.contacts.get(customer.id)).toEqual(customer)
    expect(await db.reservations.count()).toBe(0)
  })

  it('supplier contact event failure rolls back contact and allows retry', async () => {
    vi.spyOn(db.events, 'put').mockRejectedValueOnce(new Error('storage failure'))
    expect(await createContact({ name: 'Nhà vườn', roles: ['supplier'] })).toMatchObject({ success: false })
    expect(await db.contacts.count()).toBe(0)
    expect(await db.events.count()).toBe(0)
    expect(await createContact({ name: 'Nhà vườn', roles: ['supplier'] })).toMatchObject({ success: true })
  })

  it('creates contact successfully with default role ["customer"]', async () => {
    const result = await createContact({
      name: 'Anh Hùng Hữu Lũng',
      phone: '0988123456'
    })

    expect(result.success).toBe(true)
    expect(result.contact).toBeDefined()
    const contact = result.contact!

    expect(contact.name).toBe('Anh Hùng Hữu Lũng')
    expect(contact.phone).toBe('0988123456')
    expect(contact.roles).toEqual(['customer'])

    const saved = await contactRepository.getById(contact.id)
    expect(saved).not.toBeNull()

    const events = await eventRepository.getAll()
    expect(events.some((e) => e.type === 'contact_created' && e.entityId === contact.id)).toBe(true)
  })

  it('detects duplicate phone number and returns warning', async () => {
    await createContact({
      name: 'Chị Lan',
      phone: '0977888999'
    })

    const duplicate = await createContact({
      name: 'Chị Lan Vườn 2',
      phone: '0977888999'
    })

    expect(duplicate.success).toBe(false)
    expect(duplicate.duplicateWarning).toBe(true)
    expect(duplicate.existingContact?.name).toBe('Chị Lan')
    expect(duplicate.error).toContain('Số điện thoại này đã có trong danh bạ')
  })

  it('allows duplicate phone number if allowDuplicatePhone is true', async () => {
    await createContact({
      name: 'Chị Lan',
      phone: '0977888999'
    })

    const allowed = await createContact({
      name: 'Chị Lan Vườn 2',
      phone: '0977888999',
      allowDuplicatePhone: true
    })

    expect(allowed.success).toBe(true)
    expect(allowed.contact?.name).toBe('Chị Lan Vườn 2')
  })

  it('rejects contact with empty name', async () => {
    const result = await createContact({
      name: '   '
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('tên khách hàng')
  })
})
