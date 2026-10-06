import type { Contact, ContactRole } from '../domain/contact'
import { contactRepository, eventRepository } from '../data/repositories'

export interface CreateContactInput {
  name: string
  phone?: string
  roles?: ContactRole[]
  allowDuplicatePhone?: boolean
}

export interface CreateContactResult {
  success: boolean
  contact?: Contact
  duplicateWarning?: boolean
  existingContact?: Contact
  error?: string
}

/**
 * Creates a new contact with phone deduplication check.
 */
export async function createContact(input: CreateContactInput): Promise<CreateContactResult> {
  const name = input.name.trim()
  if (!name) {
    return { success: false, error: 'Vui lòng nhập tên khách hàng.' }
  }

  const phone = input.phone?.trim()

  // Check phone duplicate if phone is provided and duplicate not explicitly allowed
  if (phone && !input.allowDuplicatePhone) {
    const existing = await contactRepository.findByPhone(phone)
    if (existing) {
      return {
        success: false,
        duplicateWarning: true,
        existingContact: existing,
        error: `Số điện thoại này đã có trong danh bạ: "${existing.name}".`
      }
    }
  }

  const id = `contact_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
  const newContact: Contact = {
    id,
    name,
    phone: phone || undefined,
    roles: input.roles && input.roles.length > 0 ? input.roles : ['customer']
  }

  try {
    await contactRepository.save(newContact)

    await eventRepository.record({
      type: 'contact_created',
      entityType: 'contact',
      entityId: newContact.id,
      payload: {
        message: `Tạo liên hệ mới: ${newContact.name}`,
        name: newContact.name,
        phone: newContact.phone,
        roles: newContact.roles
      }
    })

    return { success: true, contact: newContact }
  } catch (err) {
    console.error('Failed to create contact:', err)
    return {
      success: false,
      error: 'Chưa lưu được thông tin khách hàng. Vui lòng thử lại.'
    }
  }
}
