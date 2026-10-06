import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../../data/db'
import {
  startPilotSession,
  getActivePilotSession,
  completePilotSession,
  sanitizeParticipantCode
} from '../validationSession'
import { validationRepository } from '../validation.repository'
import type { Batch } from '../../domain/batch'

describe('ValidationSession Service & Repository', () => {
  beforeEach(async () => {
    await db.pilotSessions.clear()
    await db.validationEvents.clear()
    await db.batches.clear()
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.clear()
    }
  })

  it('sanitizes participant code and rejects invalid/PII patterns', () => {
    expect(sanitizeParticipantCode('  p01  ')).toBe('P01')
    expect(sanitizeParticipantCode('p-pilot_2')).toBe('P-PILOT_2')

    // Rejects empty
    expect(() => sanitizeParticipantCode('   ')).toThrow('Mã người thử không được để trống.')

    // Rejects too short
    expect(() => sanitizeParticipantCode('P')).toThrow('Mã người thử phải có ít nhất 2 ký tự')

    // Rejects too long
    expect(() => sanitizeParticipantCode('P'.repeat(25))).toThrow('Mã người thử quá dài')

    // Rejects spaces (likely full name)
    expect(() => sanitizeParticipantCode('Anh Hung')).toThrow('không được chứa khoảng trắng')

    // Rejects phone numbers (PII)
    expect(() => sanitizeParticipantCode('0912345678')).toThrow('Không dùng số điện thoại')
    expect(() => sanitizeParticipantCode('+84912345678')).toThrow('Không dùng số điện thoại')
    expect(() => sanitizeParticipantCode('84912345678')).toThrow('Không dùng số điện thoại')

    // Rejects emails (PII)
    expect(() => sanitizeParticipantCode('user@domain.com')).toThrow('Không dùng địa chỉ email')
    expect(() => sanitizeParticipantCode('pilot@vuon.vn')).toThrow('Không dùng địa chỉ email')

    // Rejects pure numbers
    expect(() => sanitizeParticipantCode('123456')).toThrow('Mã người thử phải chứa ít nhất một chữ cái')
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
