import { db } from '../data/db'
import type { PilotSession, ValidationEvent } from './validation.types'

export class ValidationRepository {
  async savePilotSession(session: PilotSession): Promise<void> {
    await db.pilotSessions.put(session)
  }

  async getPilotSession(id: string): Promise<PilotSession | undefined> {
    return await db.pilotSessions.get(id)
  }

  /**
   * Returns the currently active pilot session (endedAt is undefined).
   * By business invariant, at most 1 session can be active at a time.
   */
  async getActivePilotSession(): Promise<PilotSession | undefined> {
    const all = await db.pilotSessions.toArray()
    return all.find((s) => !s.endedAt)
  }

  async getAllPilotSessions(): Promise<PilotSession[]> {
    return await db.pilotSessions.toArray()
  }

  async recordValidationEvent(event: ValidationEvent): Promise<void> {
    await db.validationEvents.put(event)
  }

  async getAllValidationEvents(): Promise<ValidationEvent[]> {
    return await db.validationEvents.toArray()
  }

  async getValidationEventsForSession(sessionId: string): Promise<ValidationEvent[]> {
    return await db.validationEvents.where('sessionId').equals(sessionId).toArray()
  }

  /**
   * Clears only pilot sessions and telemetry events.
   * Leaves all business tables (batches, orders, contacts, etc.) completely intact.
   */
  async clearValidationData(): Promise<void> {
    await db.transaction('rw', [db.pilotSessions, db.validationEvents], async () => {
      await db.pilotSessions.clear()
      await db.validationEvents.clear()
    })
  }
}

export const validationRepository = new ValidationRepository()
