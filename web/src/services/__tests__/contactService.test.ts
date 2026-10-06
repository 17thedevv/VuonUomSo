import { describe, it, expect, beforeEach } from 'vitest'
import { createContact } from '../contactService'
import { contactRepository, eventRepository } from '../../data/repositories'
import { clearAllData } from '../../data/seed'

describe('contactService', () => {
  beforeEach(async () => {
    await clearAllData()
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
