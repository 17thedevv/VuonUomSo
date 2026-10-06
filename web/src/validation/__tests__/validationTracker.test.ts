import { describe, it, expect, beforeEach, vi } from 'vitest'
import { db } from '../../data/db'
import { canonicalizeRoute } from '../routeCanonicalizer'
import { validationTracker } from '../validationTracker'
import { startPilotSession } from '../validationSession'
import { settingsRepository } from '../../data/repositories'
import { validationRepository } from '../validation.repository'

describe('Route Canonicalizer & ValidationTracker', () => {
  beforeEach(async () => {
    await db.pilotSessions.clear()
    await db.validationEvents.clear()
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.clear()
    }
    await settingsRepository.set('app_mode', 'pilot')
  })

  describe('canonicalizeRoute', () => {
    it('canonicalizes core routes and strips dynamic entity IDs', () => {
      expect(canonicalizeRoute('/')).toBe('today')
      expect(canonicalizeRoute('/today')).toBe('today')
      expect(canonicalizeRoute('/onboarding')).toBe('onboarding')

      expect(canonicalizeRoute('/batches')).toBe('batches')
      expect(canonicalizeRoute('/batches/new')).toBe('batch_new')
      expect(canonicalizeRoute('/batches/b_custom_12345')).toBe('batch_detail')
      expect(canonicalizeRoute('/batches/b_custom_12345/dossier')).toBe('dossier')
      expect(canonicalizeRoute('/dossiers/b_custom_12345')).toBe('dossier')

      expect(canonicalizeRoute('/orders')).toBe('orders')
      expect(canonicalizeRoute('/orders/new')).toBe('order_new')
      expect(canonicalizeRoute('/orders/ord_99999')).toBe('order_detail')
      expect(canonicalizeRoute('/orders/ord_99999/reserve')).toBe('order_reserve')

      expect(canonicalizeRoute('/shipments')).toBe('shipments')
      expect(canonicalizeRoute('/shipments/new')).toBe('shipment_new')
      expect(canonicalizeRoute('/shipments/shp_abc')).toBe('shipment_detail')

      expect(canonicalizeRoute('/more')).toBe('more')
      expect(canonicalizeRoute('/pilot-tools')).toBe('pilot_tools')
      expect(canonicalizeRoute('/validation')).toBe('validation_report')
    })

    it('strips query strings and trailing slashes safely', () => {
      expect(canonicalizeRoute('/orders/new?variety=Keo+lai')).toBe('order_new')
      expect(canonicalizeRoute('/batches/b_01/?param=1#anchor')).toBe('batch_detail')
      expect(canonicalizeRoute('/unknown-invalid-path')).toBeNull()
    })
  })

  describe('validationTracker', () => {
    it('is completely NO-OP when there is no active pilot session', async () => {
      await validationTracker.screenViewed('today')
      await validationTracker.formStarted('batch_created')
      await validationTracker.actionCompleted('batch_created')
      await validationTracker.actionFailed('batch_created', 'validation')

      const events = await db.validationEvents.toArray()
      expect(events.length).toBe(0)
    })

    it('records typed events when a pilot session is active', async () => {
      const session = await startPilotSession('p01', 'accepted')

      await validationTracker.screenViewed('today')
      await validationTracker.formStarted('order_created')
      await validationTracker.actionCompleted('order_created')
      await validationTracker.actionFailed('reservation_created', 'insufficient_stock')

      const events = await db.validationEvents.toArray()
      expect(events.length).toBe(4)

      const screenEvt = events.find((e) => e.type === 'screen_viewed')
      expect(screenEvt?.route).toBe('today')
      expect(screenEvt?.sessionId).toBe(session.id)
      expect(screenEvt?.participantCode).toBe('P01')
      expect(screenEvt?.mode).toBe('pilot')

      const formEvt = events.find((e) => e.type === 'form_started')
      expect(formEvt?.action).toBe('order_created')

      const compEvt = events.find((e) => e.type === 'action_completed')
      expect(compEvt?.action).toBe('order_created')

      const failEvt = events.find((e) => e.type === 'action_failed')
      expect(failEvt?.action).toBe('reservation_created')
      expect(failEvt?.failureKind).toBe('insufficient_stock')
    })

    it('tags events with mode "demo" when in demo mode', async () => {
      await settingsRepository.set('app_mode', 'demo')
      await startPilotSession('p02', 'accepted')

      await validationTracker.actionCompleted('batch_created')

      const events = await db.validationEvents.toArray()
      expect(events.length).toBe(1)
      expect(events[0].mode).toBe('demo')
    })

    it('critical invariant: tracker exceptions never throw or break caller', async () => {
      await startPilotSession('p03', 'accepted')

      // Mock repository failure
      const spy = vi
        .spyOn(validationRepository, 'recordValidationEvent')
        .mockRejectedValueOnce(new Error('Simulated IndexedDB failure'))

      // Must NOT throw
      await expect(validationTracker.actionCompleted('order_created')).resolves.not.toThrow()

      spy.mockRestore()
    })

    it('privacy invariant: events never leak forbidden PII fields', async () => {
      await startPilotSession('p04', 'accepted')
      await validationTracker.actionCompleted('order_created')

      const events = await db.validationEvents.toArray()
      expect(events.length).toBe(1)
      const raw = events[0] as unknown as Record<string, unknown>

      const forbiddenKeys = ['name', 'customerName', 'phone', 'address', 'note', 'sourceName']
      for (const key of forbiddenKeys) {
        expect(raw[key]).toBeUndefined()
      }
    })
  })
})
