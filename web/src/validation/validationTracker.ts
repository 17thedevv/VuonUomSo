import { getActivePilotSession } from './validationSession'
import { validationRepository } from './validation.repository'
import { settingsRepository } from '../data/repositories'
import type {
  ValidationRoute,
  ValidationAction,
  ValidationFailureKind,
  ValidationEvent
} from './validation.types'

class ValidationTracker {
  private async resolveMode(): Promise<'pilot' | 'demo'> {
    try {
      const modeVal = await settingsRepository.get('app_mode')
      return modeVal === 'demo' ? 'demo' : 'pilot'
    } catch {
      return 'pilot'
    }
  }

  /**
   * Records a canonical screen view event.
   * NO-OP if there is no active pilot session.
   */
  async screenViewed(route: ValidationRoute): Promise<void> {
    try {
      const session = await getActivePilotSession()
      if (!session) return

      const mode = await this.resolveMode()
      const event: ValidationEvent = {
        id: `vevt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        sessionId: session.id,
        participantCode: session.participantCode,
        mode,
        createdAt: new Date().toISOString(),
        type: 'screen_viewed',
        route
      }

      await validationRepository.recordValidationEvent(event)
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn('[ValidationTracker] Failed to record screenViewed:', err)
      }
    }
  }

  /**
   * Records that a user has opened / initiated a key task form.
   * NO-OP if there is no active pilot session.
   */
  async formStarted(action: ValidationAction): Promise<void> {
    try {
      const session = await getActivePilotSession()
      if (!session) return

      const mode = await this.resolveMode()
      const event: ValidationEvent = {
        id: `vevt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        sessionId: session.id,
        participantCode: session.participantCode,
        mode,
        createdAt: new Date().toISOString(),
        type: 'form_started',
        action
      }

      await validationRepository.recordValidationEvent(event)
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn('[ValidationTracker] Failed to record formStarted:', err)
      }
    }
  }

  /**
   * Records that a core business mutation completed successfully.
   * NO-OP if there is no active pilot session.
   */
  async actionCompleted(action: ValidationAction): Promise<void> {
    try {
      const session = await getActivePilotSession()
      if (!session) return

      const mode = await this.resolveMode()
      const event: ValidationEvent = {
        id: `vevt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        sessionId: session.id,
        participantCode: session.participantCode,
        mode,
        createdAt: new Date().toISOString(),
        type: 'action_completed',
        action
      }

      await validationRepository.recordValidationEvent(event)
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn('[ValidationTracker] Failed to record actionCompleted:', err)
      }
    }
  }

  /**
   * Records that a core business action failed with a coarse category.
   * Does NOT record error message strings, stack traces, or customer PII.
   * NO-OP if there is no active pilot session.
   */
  async actionFailed(action: ValidationAction, failureKind: ValidationFailureKind): Promise<void> {
    try {
      const session = await getActivePilotSession()
      if (!session) return

      const mode = await this.resolveMode()
      const event: ValidationEvent = {
        id: `vevt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        sessionId: session.id,
        participantCode: session.participantCode,
        mode,
        createdAt: new Date().toISOString(),
        type: 'action_failed',
        action,
        failureKind
      }

      await validationRepository.recordValidationEvent(event)
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn('[ValidationTracker] Failed to record actionFailed:', err)
      }
    }
  }
}

export const validationTracker = new ValidationTracker()
