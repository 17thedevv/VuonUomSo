import type { Contact, ContactRole } from '../domain/contact'
import { contactRepository, eventRepository } from '../data/repositories'
import { db } from '../data/db'

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
  const roles: ContactRole[] = input.roles?.length ? [...input.roles] : ['customer']
  const isSupplier = roles.includes('supplier')
  if (!name) {
    return { success: false, error: isSupplier ? 'Vui lòng nhập tên nhà vườn.' : 'Vui lòng nhập tên khách hàng.' }
  }

  const phone = input.phone?.trim()

  try {
    return await db.transaction('rw', [db.contacts, db.events], async (): Promise<CreateContactResult> => {
      // Role-specific creation and its history must either both commit or both roll back.
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

      const newContact: Contact = {
        id: `contact_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name, phone: phone || undefined, roles
      }

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
    })
  } catch (err) {
    console.error('Failed to create contact:', err)
    return {
      success: false,
      error: isSupplier ? 'Chưa lưu được thông tin nhà vườn. Vui lòng thử lại.' : 'Chưa lưu được thông tin khách hàng. Vui lòng thử lại.'
    }
  }
}
