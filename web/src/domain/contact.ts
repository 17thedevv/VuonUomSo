export const MAX_CONTACT_NAME_LENGTH = 100

export type ContactRole =
  | 'customer'
  | 'supplier'

export type Contact = {
  id: string
  name: string
  phone?: string

  roles: ContactRole[]
}
