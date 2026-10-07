import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../../data/db'
import {
  startPilotSession,
  getActivePilotSession,
  completePilotSession,
  sanitizeParticipantCode
} from '../validationSession'
import { validationRepository } from '../validation.repository'
import { settingsRepository } from '../../data/repositories'
import type { Batch } from '../../domain/batch'

describe('ValidationSession Service & Repository', () => {
  beforeEach(async () => {
    await db.pilotSessions.clear()
    await db.validationEvents.clear()
    await db.batches.clear()
    await settingsRepository.set('app_mode', 'pilot')
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.clear()
    }
  })

  it('accepts P01/P002 and strictly rejects ANHHUNG, spaces, phone, and email', () => {
    // P01/P002 accepted
    expect(sanitizeParticipantCode('  p01  ')).toBe('P01')
    expect(sanitizeParticipantCode('P002')).toBe('P002')
    expect(sanitizeParticipantCode('P1234')).toBe('P1234')

    // ANHHUNG rejected (no digits / real name)
    expect(() => sanitizeParticipantCode('ANHHUNG')).toThrow('không đúng định dạng ẩn danh chuẩn')
    expect(() => sanitizeParticipantCode('Anh Hung')).toThrow('không đúng định dạng ẩn danh chuẩn')

    // Rejects empty
    expect(() => sanitizeParticipantCode('   ')).toThrow('Mã người thử không được để trống.')

    // Rejects invalid digit counts (must be 2-4 digits)
    expect(() => sanitizeParticipantCode('P1')).toThrow('không đúng định dạng ẩn danh chuẩn')
    expect(() => sanitizeParticipantCode('P12345')).toThrow('không đúng định dạng ẩn danh chuẩn')

    // Rejects phone numbers (PII)
    expect(() => sanitizeParticipantCode('0912345678')).toThrow('không đúng định dạng ẩn danh chuẩn')
    expect(() => sanitizeParticipantCode('+84912345678')).toThrow('không đúng định dạng ẩn danh chuẩn')
    expect(() => sanitizeParticipantCode('84912345678')).toThrow('không đúng định dạng ẩn danh chuẩn')

    // Rejects emails (PII)
    expect(() => sanitizeParticipantCode('user@domain.com')).toThrow('không đúng định dạng ẩn danh chuẩn')
    expect(() => sanitizeParticipantCode('pilot@vuon.vn')).toThrow('không đúng định dạng ẩn danh chuẩn')

    // Rejects pure numbers
    expect(() => sanitizeParticipantCode('123456')).toThrow('không đúng định dạng ẩn danh chuẩn')
  })

  it('unknown app_mode starts non-pilot (fail-conservative)', async () => {
    // 1. Unknown mode string -> fails safe to demo
    await settingsRepository.set('app_mode', 'banana' as unknown as 'pilot')
    const session1 = await startPilotSession('p01', 'accepted')
    expect(session1.mode).toBe('demo')

    // Clean up session1
    await completePilotSession({ sessionId: session1.id })

    // 2. Missing setting entirely -> fails safe to demo
    await db.settings.delete('app_mode')
    const session2 = await startPilotSession('p02', 'accepted')
    expect(session2.mode).toBe('demo')

    // Clean up session2
    await completePilotSession({ sessionId: session2.id })

    // 3. Explicit pilot mode -> pilot
    await settingsRepository.set('app_mode', 'pilot')
    const session3 = await startPilotSession('p03', 'accepted')
    expect(session3.mode).toBe('pilot')
  })

  it('starts a new pilot session and enforces max 1 active session invariant', async () => {
    const session = await startPilotSession('p03', 'accepted')

    expect(session.id).toBeDefined()
    expect(session.participantCode).toBe('P03')
    expect(session.consent).toBe('accepted')
    expect(session.startedAt).toBeDefined()
    expect(session.endedAt).toBeUndefined()
    expect(session.mode).toBe('pilot')

    // Query active session
    const active = await getActivePilotSession()
    expect(active).toBeDefined()
    expect(active?.id).toBe(session.id)
    expect(active?.participantCode).toBe('P03')

    // Attempting to start a second session must throw
    await expect(startPilotSession('P04', 'accepted')).rejects.toThrow(
      'Đang có một buổi thử nghiệm đang mở với mã "P03"'
    )
  })

  it('completes pilot session with survey responses and clears active session', async () => {
    const session = await startPilotSession('p05', 'accepted')

    const completed = await completePilotSession({
      sessionId: session.id,
      supportLevel: 'few',
      wouldUseNextWeek: 'yes',
      willingnessToPay: '50_100k',
      mostUsefulArea: 'reservation'
    })

    expect(completed.id).toBe(session.id)
    expect(completed.endedAt).toBeDefined()
    expect(completed.supportLevel).toBe('few')
    expect(completed.wouldUseNextWeek).toBe('yes')
    expect(completed.willingnessToPay).toBe('50_100k')
    expect(completed.mostUsefulArea).toBe('reservation')

    // Active session lookup must return undefined now
    const active = await getActivePilotSession()
    expect(active).toBeUndefined()

    // Can now start another session since previous is ended
    const nextSession = await startPilotSession('P06', 'accepted')
    expect(nextSession.participantCode).toBe('P06')
  })

  it('completePilotSession is idempotent on double completion', async () => {
    const session = await startPilotSession('p07', 'accepted')

    const first = await completePilotSession({
      sessionId: session.id,
      supportLevel: 'none'
    })

    const second = await completePilotSession({
      sessionId: session.id,
      wouldUseNextWeek: 'maybe'
    })

    expect(second.endedAt).toBe(first.endedAt)
    expect(second.supportLevel).toBe('none')
    expect(second.wouldUseNextWeek).toBe('maybe')
  })

  it('clearValidationData wipes research tables but preserves business tables', async () => {
    // Seed business batch
    const batch: Batch = {
      id: 'b_biz_01',
      code: 'KL-01',
      variety: 'Keo lai',
      initialQuantity: 1000,
      currentQuantity: 1000,
      readyQuantity: 1000,
      status: 'ready',
      createdAt: '2026-10-06'
    }
    await db.batches.put(batch)

    // Seed research data
    const session = await startPilotSession('p08', 'accepted')
    await validationRepository.recordValidationEvent({
      id: 'vevt_1',
      sessionId: session.id,
      participantCode: 'P08',
      mode: 'pilot',
      type: 'screen_viewed',
      route: 'today',
      createdAt: '2026-10-06T15:00:00.000Z'
    })

    expect(await db.pilotSessions.count()).toBe(1)
    expect(await db.validationEvents.count()).toBe(1)
    expect(await db.batches.count()).toBe(1)

    // Clear validation research data
    await validationRepository.clearValidationData()

    expect(await db.pilotSessions.count()).toBe(0)
    expect(await db.validationEvents.count()).toBe(0)
    // Business table untouched!
    expect(await db.batches.count()).toBe(1)
    const preservedBatch = await db.batches.get('b_biz_01')
    expect(preservedBatch?.code).toBe('KL-01')
  })
})
