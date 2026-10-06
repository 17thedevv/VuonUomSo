export type ContactRole =
  | 'customer'
  | 'supplier'

export type Contact = {
  id: string
  name: string
  phone?: string

  roles: ContactRole[]
}
