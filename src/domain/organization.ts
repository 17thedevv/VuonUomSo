export type OrganizationCapability =
  | 'produce'
  | 'sell'
  | 'buy'
  | 'aggregate'
  | 'transport'

export type Organization = {
  id: string
  name: string
  capabilities: OrganizationCapability[]
}
