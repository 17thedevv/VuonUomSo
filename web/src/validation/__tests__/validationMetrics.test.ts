import { describe, it, expect } from 'vitest'
import {
  countParticipants,
  countPilotSessions,
  countReturningParticipants,
  deriveActivationMetrics,
  summarizeTasks,
  summarizeSupport,
  summarizeWillingnessToPay,
  buildValidationSummary
} from '../validationMetrics'
import type { PilotSession, ValidationEvent } from '../validation.types'

describe('Validation Metrics Engine', () => {
  const mockSessions: PilotSession[] = [
    {
      id: 's1',
      participantCode: 'P01',
      consent: 'accepted',
      startedAt: '2026-10-06T09:00:00.000Z',
      endedAt: '2026-10-06T09:30:00.000Z',
      supportLevel: 'none',
      wouldUseNextWeek: 'yes',
      willingnessToPay: '50_100k',
      mostUsefulArea: 'stock'
    },
    {
      id: 's2',
      participantCode: 'P01',
      consent: 'accepted',
      startedAt: '2026-10-08T10:00:00.000Z', // Distinct calendar day!
      endedAt: '2026-10-08T10:20:00.000Z',
      supportLevel: 'once',
      wouldUseNextWeek: 'yes',
      willingnessToPay: '50_100k',
      mostUsefulArea: 'orders'
    },
    {
      id: 's3',
      participantCode: 'P02',
      consent: 'accepted',
      startedAt: '2026-10-06T14:00:00.000Z',
      endedAt: '2026-10-06T14:45:00.000Z',
      supportLevel: 'many',
      wouldUseNextWeek: 'no',
      willingnessToPay: 'zero',
      mostUsefulArea: 'backup'
    },
    {
      id: 's4',
      participantCode: 'P03',
      consent: 'accepted',
      startedAt: '2026-10-07T11:00:00.000Z',
      // Active / Incomplete session
      supportLevel: undefined
    }
  ]

  const mockEvents: ValidationEvent[] = [
    // P01 actions (Achieves A1, A2, and returns on day 2 -> A3)
    {
      id: 'e1',
      sessionId: 's1',
      participantCode: 'P01',
      mode: 'pilot',
      type: 'action_completed',
      action: 'batch_created',
      createdAt: '2026-10-06T09:05:00.000Z'
    },
    {
      id: 'e2',
      sessionId: 's1',
      participantCode: 'P01',
      mode: 'pilot',
      type: 'action_completed',
      action: 'order_created',
      createdAt: '2026-10-06T09:10:00.000Z'
    },
    {
      id: 'e3',
      sessionId: 's1',
      participantCode: 'P01',
      mode: 'pilot',
      type: 'action_completed',
      action: 'reservation_created',
      createdAt: '2026-10-06T09:15:00.000Z'
    },
    {
      id: 'e4',
      sessionId: 's2',
      participantCode: 'P01',
      mode: 'pilot',
      type: 'action_completed',
      action: 'shipment_completed',
      createdAt: '2026-10-08T10:15:00.000Z'
    },
    // P02 actions (Achieves A1 only, failed at reservation)
    {
      id: 'e5',
      sessionId: 's3',
      participantCode: 'P02',
      mode: 'pilot',
      type: 'action_completed',
      action: 'order_created',
      createdAt: '2026-10-06T14:10:00.000Z'
    },
    {
      id: 'e6',
      sessionId: 's3',
      participantCode: 'P02',
      mode: 'pilot',
      type: 'action_failed',
      action: 'reservation_created',
      failureKind: 'insufficient_stock',
      createdAt: '2026-10-06T14:15:00.000Z'
    },
    // Demo event (must be excluded from pilot metrics)
    {
      id: 'e_demo',
      sessionId: 's3',
      participantCode: 'P02',
      mode: 'demo',
      type: 'action_completed',
      action: 'shipment_completed',
      createdAt: '2026-10-06T14:20:00.000Z'
    }
  ]

  it('counts participants and session statuses accurately', () => {
    expect(countParticipants(mockSessions)).toBe(3) // P01, P02, P03

    const counts = countPilotSessions(mockSessions)
    expect(counts.total).toBe(4)
    expect(counts.completed).toBe(3)
    expect(counts.active).toBe(1)
  })

  it('detects returning participants on distinct calendar days', () => {
    // P01 has sessions on 2026-10-06 and 2026-10-08 -> Returning
    // P02 has only 2026-10-06
    // P03 has only 2026-10-07
    expect(countReturningParticipants(mockSessions)).toBe(1)
  })

  it('calculates activation tiers A1, A2, A3 excluding demo events', () => {
    const activation = deriveActivationMetrics(mockSessions, mockEvents, false)

    expect(activation.totalParticipants).toBe(3)
    // P01 and P02 have A1 (batch/order created) -> 2
    expect(activation.a1Count).toBe(2)
    // Only P01 has A2 (batch + order + reservation) -> 1 (P02 demo shipment excluded)
    expect(activation.a2Count).toBe(1)
    // P01 achieved A2 and returned on another day -> A3 = 1
    expect(activation.a3Count).toBe(1)
  })

  it('summarizes task completion and failures', () => {
    const tasks = summarizeTasks(mockEvents, false)

    const orderTask = tasks.find((t) => t.action === 'order_created')
    expect(orderTask?.completedCount).toBe(2)
    expect(orderTask?.failedCount).toBe(0)

    const resTask = tasks.find((t) => t.action === 'reservation_created')
    expect(resTask?.completedCount).toBe(1)
    expect(resTask?.failedCount).toBe(1)

    // Demo shipment excluded
    const shipTask = tasks.find((t) => t.action === 'shipment_completed')
    expect(shipTask?.completedCount).toBe(1)
  })

  it('summarizes support level and willingness to pay', () => {
    const support = summarizeSupport(mockSessions)
    expect(support.none).toBe(1)
    expect(support.once).toBe(1)
    expect(support.few).toBe(0)
    expect(support.many).toBe(1)

    const wtp = summarizeWillingnessToPay(mockSessions)
    expect(wtp['50_100k']).toBe(2)
    expect(wtp.zero).toBe(1)
  })

  it('builds reproducible summary with evidence thresholds', () => {
    const summary1 = buildValidationSummary(mockSessions, mockEvents)
    const summary2 = buildValidationSummary(mockSessions, mockEvents)

    expect(summary1).toEqual(summary2)
    expect(summary1.evidence.activatedA2.current).toBe(1)
    expect(summary1.evidence.activatedA2.target).toBe('3–5')
    expect(summary1.evidence.activatedA2.met).toBe(false)

    expect(summary1.evidence.returned.current).toBe(1)
    expect(summary1.evidence.returned.target).toBe('≥2')
    expect(summary1.evidence.returned.met).toBe(false)

    expect(summary1.evidence.positiveWtp.current).toBe(2)
    expect(summary1.evidence.positiveWtp.target).toBe('≥1')
    expect(summary1.evidence.positiveWtp.met).toBe(true)

    expect(summary1.evidence.heavySupport.current).toBe(1)
    expect(summary1.evidence.heavySupport.total).toBe(3)
  })
})
