import { describe, it, expect } from 'vitest'
import {
  countParticipants,
  countPilotSessions,
  countReturningParticipants,
  deriveActivationMetrics,
  summarizeTasks,
  summarizeSupport,
  summarizeWillingnessToPay,
  summarizeReturnIntention,
  summarizeMostUsefulArea,
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
      mode: 'pilot',
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
      mode: 'pilot',
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
      mode: 'pilot',
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
      mode: 'pilot',
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
    it('missing-mode session excluded from pilot across all metric aggregators', () => {
      const mixedSessions: PilotSession[] = [
        {
          id: 's_pilot',
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
          id: 's_legacy_missing_mode',
          participantCode: 'P02',
          consent: 'accepted',
          startedAt: '2026-10-07T09:00:00.000Z',
          endedAt: '2026-10-07T09:30:00.000Z',
          // mode is undefined! (Legacy pre-patch session)
          supportLevel: 'many',
          wouldUseNextWeek: 'yes',
          willingnessToPay: 'over_200k',
          mostUsefulArea: 'orders'
        },
        {
          id: 's_demo',
          participantCode: 'P03',
          consent: 'accepted',
          startedAt: '2026-10-08T09:00:00.000Z',
          endedAt: '2026-10-08T09:30:00.000Z',
          mode: 'demo',
          supportLevel: 'few',
          wouldUseNextWeek: 'no',
          willingnessToPay: '100_200k',
          mostUsefulArea: 'dossier'
        }
      ]

      // By default (includeDemo = false): only s_pilot (mode === 'pilot') is counted
      expect(countParticipants(mixedSessions)).toBe(1)
      expect(countPilotSessions(mixedSessions).total).toBe(1)
      expect(countReturningParticipants(mixedSessions)).toBe(0)
    })

    it('legacy missing-mode WTP/support excluded from pilot metrics', () => {
      const legacySessions: PilotSession[] = [
        {
          id: 's_legacy',
          participantCode: 'P01',
          consent: 'accepted',
          startedAt: '2026-10-06T09:00:00.000Z',
          endedAt: '2026-10-06T09:30:00.000Z',
          // mode undefined!
          supportLevel: 'many',
          willingnessToPay: 'over_200k',
          wouldUseNextWeek: 'yes',
          mostUsefulArea: 'backup'
        }
      ]

      // Under default pilot-only: must be excluded!
      expect(summarizeSupport(legacySessions).many).toBe(0)
      expect(summarizeWillingnessToPay(legacySessions).over_200k).toBe(0)
      expect(summarizeReturnIntention(legacySessions).yes).toBe(0)
      expect(summarizeMostUsefulArea(legacySessions).backup).toBe(0)

      // When includeDemo = true: included
      expect(summarizeSupport(legacySessions, true).many).toBe(1)
      expect(summarizeWillingnessToPay(legacySessions, true).over_200k).toBe(1)
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

    it('A2 + completed empty day2 => A3 false', () => {
      // Participant achieves A2 on Day 1, and on Day 2 completes an empty session (e.g. opens, answers survey, no core action)
      const sessions: PilotSession[] = [
        {
          id: 's1',
          participantCode: 'P10',
          consent: 'accepted',
          startedAt: '2026-10-06T08:00:00.000Z',
          endedAt: '2026-10-06T08:30:00.000Z',
          mode: 'pilot'
        },
        {
          id: 's2_day2',
          participantCode: 'P10',
          consent: 'accepted',
          startedAt: '2026-10-07T08:00:00.000Z',
          endedAt: '2026-10-07T08:15:00.000Z', // Completed session on Day 2!
          mode: 'pilot',
          supportLevel: 'none',
          wouldUseNextWeek: 'yes'
        }
      ]

      // Only Day 1 has actions (achieves A2)
      const day1OnlyActions: ValidationEvent[] = [
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

      // returningParticipants is 1 (attended 2 distinct calendar days)
      expect(countReturningParticipants(sessions)).toBe(1)

      // But A3 MUST BE FALSE because Day 2 had no core workflow action!
      const metrics = deriveActivationMetrics(sessions, day1OnlyActions, false)
      expect(metrics.a2Count).toBe(1)
      expect(metrics.a3Count).toBe(0) // A3 false!
    })

    it('A2 + core action day2 => A3 true', () => {
      const sessions: PilotSession[] = [
        {
          id: 's1',
          participantCode: 'P10',
          consent: 'accepted',
          startedAt: '2026-10-06T08:00:00.000Z',
          endedAt: '2026-10-06T08:30:00.000Z',
          mode: 'pilot'
        },
        {
          id: 's2_day2',
          participantCode: 'P10',
          consent: 'accepted',
          startedAt: '2026-10-07T08:00:00.000Z',
          endedAt: '2026-10-07T08:30:00.000Z',
          mode: 'pilot'
        }
      ]

      const actionsWithDay2Core: ValidationEvent[] = [
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
        },
        // Core workflow action on Day 2!
        {
          id: 'e4_day2',
          sessionId: 's2_day2',
          participantCode: 'P10',
          mode: 'pilot',
          type: 'action_completed',
          action: 'shipment_completed',
          createdAt: '2026-10-07T08:20:00.000Z'
        }
      ]

      const metrics = deriveActivationMetrics(sessions, actionsWithDay2Core, false)
      expect(metrics.a2Count).toBe(1)
      expect(metrics.a3Count).toBe(1) // A3 true!
    })

    it('orphan/mismatched pilot event cannot create participant', () => {
      // Only P01 has a valid pilot session
      const validSessions: PilotSession[] = [
        {
          id: 's_p01',
          participantCode: 'P01',
          consent: 'accepted',
          startedAt: '2026-10-06T08:00:00.000Z',
          endedAt: '2026-10-06T08:30:00.000Z',
          mode: 'pilot'
        }
      ]

      // Events include orphan P99 (no pilot session exists for P99)
      const eventsWithOrphan: ValidationEvent[] = [
        {
          id: 'e_p01',
          sessionId: 's_p01',
          participantCode: 'P01',
          mode: 'pilot',
          type: 'action_completed',
          action: 'batch_created',
          createdAt: '2026-10-06T08:05:00.000Z'
        },
        {
          id: 'e_orphan',
          sessionId: 's_nonexistent',
          participantCode: 'P99',
          mode: 'pilot',
          type: 'action_completed',
          action: 'order_created',
          createdAt: '2026-10-06T08:10:00.000Z'
        }
      ]

      const metrics = deriveActivationMetrics(validSessions, eventsWithOrphan, false)

      // Total participants must strictly be 1 (only P01), orphan P99 cannot create a participant!
      expect(metrics.totalParticipants).toBe(1)
      expect(metrics.a1Count).toBe(1) // Only P01
    })
  })
})
