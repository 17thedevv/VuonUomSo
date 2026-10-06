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

  describe('P6 Evidence Integrity Hardening', () => {
    it('strictly excludes demo sessions across all metric aggregators by default', () => {
      const mixedSessions: PilotSession[] = [
        {
          id: 's_real',
          participantCode: 'P01',
          consent: 'accepted',
          startedAt: '2026-10-06T09:00:00.000Z',
          endedAt: '2026-10-06T09:30:00.000Z',
          mode: 'pilot',
          supportLevel: 'none',
          wouldUseNextWeek: 'yes',
          willingnessToPay: '50_100k',
          mostUsefulArea: 'stock'
        },
        {
          id: 's_demo',
          participantCode: 'DEMO_USER',
          consent: 'accepted',
          startedAt: '2026-10-07T09:00:00.000Z',
          endedAt: '2026-10-07T09:30:00.000Z',
          mode: 'demo',
          supportLevel: 'many',
          wouldUseNextWeek: 'yes',
          willingnessToPay: 'over_200k',
          mostUsefulArea: 'orders'
        }
      ]

      // By default (includeDemo = false): only 1 participant and 1 session
      expect(countParticipants(mixedSessions)).toBe(1)
      expect(countPilotSessions(mixedSessions).total).toBe(1)
      expect(countReturningParticipants(mixedSessions)).toBe(0)
      expect(summarizeSupport(mixedSessions).many).toBe(0)
      expect(summarizeWillingnessToPay(mixedSessions).over_200k).toBe(0)

      // When includeDemo = true: includes demo sessions
      expect(countParticipants(mixedSessions, true)).toBe(2)
      expect(countPilotSessions(mixedSessions, true).total).toBe(2)
      expect(summarizeSupport(mixedSessions, true).many).toBe(1)
      expect(summarizeWillingnessToPay(mixedSessions, true).over_200k).toBe(1)
    })

    it('handles Vietnam local calendar day (UTC+7) boundary accurately', () => {
      // 5:00 AM VN time on Oct 7 is 22:00 UTC on Oct 6
      const earlyMorningVn = '2026-10-06T22:00:00.000Z'
      // 9:00 AM VN time on Oct 7 is 02:00 UTC on Oct 7
      const midMorningVn = '2026-10-07T02:00:00.000Z'

      // Under UTC slice, these look like two different days ('2026-10-06' and '2026-10-07')
      expect(earlyMorningVn.slice(0, 10)).not.toBe(midMorningVn.slice(0, 10))

      // Under Vietnam local calendar day, both map to '2026-10-07'
      const sessionsSameLocalDay: PilotSession[] = [
        {
          id: 's_morning1',
          participantCode: 'P01',
          consent: 'accepted',
          startedAt: earlyMorningVn,
          endedAt: '2026-10-06T22:30:00.000Z',
          mode: 'pilot'
        },
        {
          id: 's_morning2',
          participantCode: 'P01',
          consent: 'accepted',
          startedAt: midMorningVn,
          endedAt: '2026-10-07T02:30:00.000Z',
          mode: 'pilot'
        }
      ]

      // Must NOT be counted as returning on distinct calendar days
      expect(countReturningParticipants(sessionsSameLocalDay)).toBe(0)

      // Next local day: 1:00 AM VN time on Oct 8 is 18:00 UTC on Oct 7
      const nextDayVn = '2026-10-07T18:00:00.000Z'
      const sessionsDistinctLocalDays: PilotSession[] = [
        ...sessionsSameLocalDay,
        {
          id: 's_next_day',
          participantCode: 'P01',
          consent: 'accepted',
          startedAt: nextDayVn,
          endedAt: '2026-10-07T18:30:00.000Z',
          mode: 'pilot'
        }
      ]

      // Now counts as 1 returning participant
      expect(countReturningParticipants(sessionsDistinctLocalDays)).toBe(1)
    })

    it('prevents A3 false positives from same-day multiple opens or unverified sessions', () => {
      // Scenario A: Participant achieves A2 on Day 1, but multiple sessions on SAME day -> A3 must be 0
      const sameDaySessions: PilotSession[] = [
        {
          id: 's1',
          participantCode: 'P10',
          consent: 'accepted',
          startedAt: '2026-10-06T08:00:00.000Z',
          endedAt: '2026-10-06T08:30:00.000Z',
          mode: 'pilot'
        },
        {
          id: 's2',
          participantCode: 'P10',
          consent: 'accepted',
          startedAt: '2026-10-06T14:00:00.000Z',
          endedAt: '2026-10-06T14:30:00.000Z',
          mode: 'pilot'
        }
      ]
      const day1A2Events: ValidationEvent[] = [
        {
          id: 'e1',
          sessionId: 's1',
          participantCode: 'P10',
          mode: 'pilot',
          type: 'action_completed',
          action: 'batch_created',
          createdAt: '2026-10-06T08:05:00.000Z'
        },
        {
          id: 'e2',
          sessionId: 's1',
          participantCode: 'P10',
          mode: 'pilot',
          type: 'action_completed',
          action: 'order_created',
          createdAt: '2026-10-06T08:10:00.000Z'
        },
        {
          id: 'e3',
          sessionId: 's1',
          participantCode: 'P10',
          mode: 'pilot',
          type: 'action_completed',
          action: 'reservation_created',
          createdAt: '2026-10-06T08:15:00.000Z'
        }
      ]

      const sameDayMetrics = deriveActivationMetrics(sameDaySessions, day1A2Events, false)
      expect(sameDayMetrics.a2Count).toBe(1)
      expect(sameDayMetrics.a3Count).toBe(0) // Must NOT count as A3!

      // Scenario B: Participant achieves A2 on Day 1, opens an empty/abandoned session on Day 2 without actions or completion -> A3 must be 0
      const abandonedDay2Sessions: PilotSession[] = [
        ...sameDaySessions,
        {
          id: 's3',
          participantCode: 'P10',
          consent: 'accepted',
          startedAt: '2026-10-07T08:00:00.000Z',
          endedAt: undefined, // Abandoned / unverified
          mode: 'pilot'
        }
      ]
      const abandonedMetrics = deriveActivationMetrics(abandonedDay2Sessions, day1A2Events, false)
      expect(abandonedMetrics.a2Count).toBe(1)
      expect(abandonedMetrics.a3Count).toBe(0) // Unverified session must NOT trigger A3!

      // Scenario C: Day 2 has genuine post-A2 completed action event -> A3 must be 1
      const verifiedDay2Events: ValidationEvent[] = [
        ...day1A2Events,
        {
          id: 'e4',
          sessionId: 's3',
          participantCode: 'P10',
          mode: 'pilot',
          type: 'action_completed',
          action: 'shipment_completed',
          createdAt: '2026-10-07T08:20:00.000Z'
        }
      ]
      const verifiedMetrics = deriveActivationMetrics(abandonedDay2Sessions, verifiedDay2Events, false)
      expect(verifiedMetrics.a2Count).toBe(1)
      expect(verifiedMetrics.a3Count).toBe(1) // Verified post-A2 action triggers A3!
    })

    it('prevents A3 false positive if sessions happened before A2 was achieved and user never returned after', () => {
      // Participant opens empty session on Day 1 (no actions), then achieves A2 on Day 2, but NEVER returns after Day 2
      const preA2Sessions: PilotSession[] = [
        {
          id: 's_empty_day1',
          participantCode: 'P20',
          consent: 'accepted',
          startedAt: '2026-10-05T08:00:00.000Z',
          endedAt: '2026-10-05T08:05:00.000Z',
          mode: 'pilot'
        },
        {
          id: 's_active_day2',
          participantCode: 'P20',
          consent: 'accepted',
          startedAt: '2026-10-06T08:00:00.000Z',
          endedAt: '2026-10-06T08:30:00.000Z',
          mode: 'pilot'
        }
      ]

      const day2OnlyA2Events: ValidationEvent[] = [
        {
          id: 'e_d2_1',
          sessionId: 's_active_day2',
          participantCode: 'P20',
          mode: 'pilot',
          type: 'action_completed',
          action: 'batch_created',
          createdAt: '2026-10-06T08:05:00.000Z'
        },
        {
          id: 'e_d2_2',
          sessionId: 's_active_day2',
          participantCode: 'P20',
          mode: 'pilot',
          type: 'action_completed',
          action: 'order_created',
          createdAt: '2026-10-06T08:10:00.000Z'
        },
        {
          id: 'e_d2_3',
          sessionId: 's_active_day2',
          participantCode: 'P20',
          mode: 'pilot',
          type: 'action_completed',
          action: 'reservation_created',
          createdAt: '2026-10-06T08:15:00.000Z'
        }
      ]

      const metrics = deriveActivationMetrics(preA2Sessions, day2OnlyA2Events, false)
      expect(metrics.a2Count).toBe(1)
      // Must NOT be A3 because they never returned AFTER achieving A2
      expect(metrics.a3Count).toBe(0)
    })
  })
})
