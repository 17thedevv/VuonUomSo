export type DomainEvent = {
  id: string
  type: string
  entityType: string
  entityId: string
  payload: unknown
  createdAt: string
}

export function createDomainEvent(
  type: string,
  entityType: string,
  entityId: string,
  payload: unknown = {}
): DomainEvent {
  return {
    id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    type,
    entityType,
    entityId,
    payload,
    createdAt: new Date().toISOString()
  }
}
