import type {
  PilotSession,
  ValidationEvent,
  ValidationSummary,
  ActivationMetrics,
  TaskSummary,
  SupportLevel,
  ReturnIntention,
  WillingnessToPay,
  UsefulArea,
  ValidationAction
} from './validation.types'

export const TASK_LABELS: Record<ValidationAction, string> = {
  batch_created: 'Ghi lô cây',
  inventory_updated: 'Cập nhật tồn',
  order_created: 'Ghi đơn hàng',
  reservation_created: 'Giữ cây',
  reservation_released: 'Bỏ giữ cây',
  shipment_planned: 'Lên chuyến giao',
  shipment_cancelled: 'Hủy chuyến giao',
  shipment_completed: 'Xác nhận xuất xe',
  dossier_saved: 'Lưu hồ sơ nguồn',
  backup_exported: 'Xuất sao lưu',
  backup_restored: 'Khôi phục sao lưu',
  contact_created: 'Tạo khách hàng/nhà cung cấp',
  onboarding_completed: 'Hoàn thành khởi tạo'
}

/**
 * Canonical Vietnam timezone used for field pilot day boundaries (UTC+7).
 */
export const FIELD_PILOT_TIMEZONE = 'Asia/Ho_Chi_Minh'

/**
 * Derives local calendar date string (YYYY-MM-DD) in Vietnam local time (UTC+7).
 * Prevents UTC day rollover mismatch (e.g. 5:00 AM VN time being 22:00 UTC previous day).
 */
export function toLocalCalendarDay(
  isoString: string,
  timeZone = FIELD_PILOT_TIMEZONE
): string {
  try {
    const date = new Date(isoString)
    if (Number.isNaN(date.getTime())) {
      return isoString.slice(0, 10)
    }
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    })
    return formatter.format(date)
  } catch {
    const date = new Date(isoString)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
}

/**
 * Returns the count of unique participant codes.
 * Excludes demo mode and legacy missing-mode sessions by default.
 */
export function countParticipants(
  sessions: PilotSession[],
  includeDemo = false
): number {
  const targetSessions = includeDemo ? sessions : sessions.filter((s) => s.mode === 'pilot')
  const codes = new Set(targetSessions.map((s) => s.participantCode.toUpperCase()))
  return codes.size
}

/**
 * Counts total, completed, and in-progress pilot sessions.
 * Excludes demo mode and legacy missing-mode sessions by default.
 */
export function countPilotSessions(
  sessions: PilotSession[],
  includeDemo = false
): {
  total: number
  completed: number
  active: number
} {
  const targetSessions = includeDemo ? sessions : sessions.filter((s) => s.mode === 'pilot')
  const completed = targetSessions.filter((s) => !!s.endedAt).length
  return {
    total: targetSessions.length,
    completed,
    active: targetSessions.length - completed
  }
}

/**
 * Counts participants who returned across at least 2 distinct calendar days.
 * Calendar day is derived from startedAt using local Vietnam calendar date (Asia/Ho_Chi_Minh).
 * Excludes demo mode and legacy missing-mode sessions by default.
 */
export function countReturningParticipants(
  sessions: PilotSession[],
  includeDemo = false
): number {
  const targetSessions = includeDemo ? sessions : sessions.filter((s) => s.mode === 'pilot')
  const daysByParticipant = new Map<string, Set<string>>()

  for (const s of targetSessions) {
    const code = s.participantCode.toUpperCase()
    const day = toLocalCalendarDay(s.startedAt)
    if (!daysByParticipant.has(code)) {
      daysByParticipant.set(code, new Set())
    }
    daysByParticipant.get(code)!.add(day)
  }

  let returningCount = 0
  for (const days of daysByParticipant.values()) {
    if (days.size >= 2) {
      returningCount++
    }
  }

  return returningCount
}

/**
 * Derives A1, A2, and A3 activation levels for participants based on raw events.
 * Excludes demo mode events and sessions by default to prevent inflating pilot evidence.
 * Strict guards:
 * - Participants MUST originate from valid pilot sessions; orphan/mismatched events cannot create participants.
 * - Requires participant to achieve A2 first.
 * - Requires at least ONE action_completed belonging to the core workflow on a subsequent calendar day (post-A2).
 *   Completed session alone without core action only counts towards returningParticipants, NOT A3.
 */
export function deriveActivationMetrics(
  sessions: PilotSession[],
  events: ValidationEvent[],
  includeDemo = false
): ActivationMetrics {
  const validSessions = includeDemo ? sessions : sessions.filter((s) => s.mode === 'pilot')
  const validEvents = includeDemo ? events : events.filter((e) => e.mode === 'pilot')

  // Map participant codes to valid sessions
  const sessionsByParticipant = new Map<string, PilotSession[]>()
  for (const s of validSessions) {
    const code = s.participantCode.toUpperCase()
    if (!sessionsByParticipant.has(code)) {
      sessionsByParticipant.set(code, [])
    }
    sessionsByParticipant.get(code)!.push(s)
  }

  // Participants MUST originate from valid pilot sessions.
  // Orphan or mismatched events without a valid pilot session CANNOT create a participant.
  const validParticipantCodes = new Set<string>(
    validSessions.map((s) => s.participantCode.toUpperCase())
  )

  // Map participant codes to valid action events (only for recognized participants)
  const actionEventsByParticipant = new Map<string, ValidationEvent[]>()
  for (const e of validEvents) {
    if (e.type === 'action_completed') {
      const code = e.participantCode.toUpperCase()
      if (validParticipantCodes.has(code)) {
        if (!actionEventsByParticipant.has(code)) {
          actionEventsByParticipant.set(code, [])
        }
        actionEventsByParticipant.get(code)!.push(e)
      }
    }
  }

  const CORE_ACTION_KEYS = new Set<ValidationAction>([
    'batch_created',
    'inventory_updated',
    'order_created',
    'reservation_created',
    'shipment_planned',
    'shipment_completed',
    'dossier_saved'
  ])

  let a1Count = 0
  let a2Count = 0
  let a3Count = 0

  for (const code of validParticipantCodes) {
    const pEvents = actionEventsByParticipant.get(code) || []

    // Sort action events chronologically
    const sortedActionEvents = [...pEvents].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )

    const completedActions = new Set<ValidationAction>()
    let hasA1 = false
    let hasA2 = false
    let a2Day: string | null = null

    for (const evt of sortedActionEvents) {
      if (evt.action) {
        completedActions.add(evt.action)
      }

      if (!hasA1) {
        if (
          completedActions.has('batch_created') ||
          completedActions.has('inventory_updated') ||
          completedActions.has('order_created')
        ) {
          hasA1 = true
        }
      }

      if (!hasA2) {
        const distinctCoreCount = Array.from(CORE_ACTION_KEYS).filter((k) =>
          completedActions.has(k)
        ).length

        const hasHighValueStep =
          completedActions.has('reservation_created') ||
          completedActions.has('shipment_planned') ||
          completedActions.has('shipment_completed') ||
          (completedActions.has('inventory_updated') && completedActions.has('batch_created'))

        if (distinctCoreCount >= 2 && hasHighValueStep) {
          hasA2 = true
          a2Day = toLocalCalendarDay(evt.createdAt)
        }
      }
    }

    if (hasA1) {
      a1Count++
    }

    if (hasA2) {
      a2Count++

      // Check for A3: Verified Operational Return
      // Condition: Must have at least ONE action_completed belonging to core workflow on a calendar day AFTER achieving A2 (day > a2Day).
      // Completed session alone on Day 2 without a core action only counts towards returningParticipants, NOT A3.
      let hasA3 = false

      if (a2Day) {
        const hasPostA2CoreAction = sortedActionEvents.some((e) => {
          if (!e.action || !CORE_ACTION_KEYS.has(e.action)) return false
          const eDay = toLocalCalendarDay(e.createdAt)
          return eDay > a2Day!
        })

        if (hasPostA2CoreAction) {
          hasA3 = true
        }
      }

      if (hasA3) {
        a3Count++
      }
    }
  }

  return {
    totalParticipants: validParticipantCodes.size,
    a1Count,
    a2Count,
    a3Count
  }
}

/**
 * Summarizes action completion and failure frequencies across monitored tasks.
 */
export function summarizeTasks(
  events: ValidationEvent[],
  includeDemo = false
): TaskSummary[] {
  const validEvents = includeDemo ? events : events.filter((e) => e.mode === 'pilot')

  const orderedActions: ValidationAction[] = [
    'batch_created',
    'inventory_updated',
    'order_created',
    'reservation_created',
    'reservation_released',
    'shipment_planned',
    'shipment_completed',
    'dossier_saved',
    'backup_exported',
    'backup_restored'
  ]

  const completedMap = new Map<ValidationAction, number>()
  const failedMap = new Map<ValidationAction, number>()

  for (const a of orderedActions) {
    completedMap.set(a, 0)
    failedMap.set(a, 0)
  }

  for (const e of validEvents) {
    if (e.type === 'action_completed') {
      completedMap.set(e.action, (completedMap.get(e.action) || 0) + 1)
    } else if (e.type === 'action_failed') {
      failedMap.set(e.action, (failedMap.get(e.action) || 0) + 1)
    }
  }

  return orderedActions.map((action) => ({
    action,
    label: TASK_LABELS[action] || action,
    completedCount: completedMap.get(action) || 0,
    failedCount: failedMap.get(action) || 0
  }))
}

export function summarizeSupport(
  sessions: PilotSession[],
  includeDemo = false
): Record<SupportLevel, number> {
  const targetSessions = includeDemo ? sessions : sessions.filter((s) => s.mode === 'pilot')
  const counts: Record<SupportLevel, number> = {
    none: 0,
    once: 0,
    few: 0,
    many: 0
  }
  for (const s of targetSessions) {
    if (s.supportLevel && counts[s.supportLevel] !== undefined) {
      counts[s.supportLevel]++
    }
  }
  return counts
}

export function summarizeWillingnessToPay(
  sessions: PilotSession[],
  includeDemo = false
): Record<WillingnessToPay, number> {
  const targetSessions = includeDemo ? sessions : sessions.filter((s) => s.mode === 'pilot')
  const counts: Record<WillingnessToPay, number> = {
    zero: 0,
    under_50k: 0,
    '50_100k': 0,
    '100_200k': 0,
    over_200k: 0,
    unsure: 0
  }
  for (const s of targetSessions) {
    if (s.willingnessToPay && counts[s.willingnessToPay] !== undefined) {
      counts[s.willingnessToPay]++
    }
  }
  return counts
}

export function summarizeReturnIntention(
  sessions: PilotSession[],
  includeDemo = false
): Record<ReturnIntention, number> {
  const targetSessions = includeDemo ? sessions : sessions.filter((s) => s.mode === 'pilot')
  const counts: Record<ReturnIntention, number> = {
    yes: 0,
    maybe: 0,
    no: 0
  }
  for (const s of targetSessions) {
    if (s.wouldUseNextWeek && counts[s.wouldUseNextWeek] !== undefined) {
      counts[s.wouldUseNextWeek]++
    }
  }
  return counts
}

export function summarizeMostUsefulArea(
  sessions: PilotSession[],
  includeDemo = false
): Record<UsefulArea, number> {
  const targetSessions = includeDemo ? sessions : sessions.filter((s) => s.mode === 'pilot')
  const counts: Record<UsefulArea, number> = {
    stock: 0,
    orders: 0,
    reservation: 0,
    shipment: 0,
    dossier: 0,
    backup: 0,
    other: 0
  }
  for (const s of targetSessions) {
    if (s.mostUsefulArea && counts[s.mostUsefulArea] !== undefined) {
      counts[s.mostUsefulArea]++
    }
  }
  return counts
}

/**
 * Builds a deterministic, reproducible ValidationSummary from sessions and telemetry events.
 * By default, excludes all demo mode and legacy missing-mode sessions and events.
 */
export function buildValidationSummary(
  sessions: PilotSession[],
  events: ValidationEvent[],
  options?: { includeDemo?: boolean }
): ValidationSummary {
  const includeDemo = options?.includeDemo ?? false
  const targetSessions = includeDemo ? sessions : sessions.filter((s) => s.mode === 'pilot')
  const targetEvents = includeDemo ? events : events.filter((e) => e.mode === 'pilot')

  const totalParticipants = countParticipants(targetSessions, includeDemo)
  const sessionCounts = countPilotSessions(targetSessions, includeDemo)
  const returningParticipants = countReturningParticipants(targetSessions, includeDemo)
  const activation = deriveActivationMetrics(targetSessions, targetEvents, includeDemo)
  const tasks = summarizeTasks(targetEvents, includeDemo)
  const support = summarizeSupport(targetSessions, includeDemo)
  const willingnessToPay = summarizeWillingnessToPay(targetSessions, includeDemo)
  const returnIntention = summarizeReturnIntention(targetSessions, includeDemo)
  const mostUsefulArea = summarizeMostUsefulArea(targetSessions, includeDemo)

  // Positive WTP = any tier above zero and unsure
  const positiveWtpCount =
    willingnessToPay.under_50k +
    willingnessToPay['50_100k'] +
    willingnessToPay['100_200k'] +
    willingnessToPay.over_200k

  return {
    totalParticipants,
    totalSessions: sessionCounts.total,
    completedSessions: sessionCounts.completed,
    activeSessions: sessionCounts.active,
    returningParticipants,
    activation,
    tasks,
    support,
    willingnessToPay,
    returnIntention,
    mostUsefulArea,
    evidence: {
      activatedA2: {
        current: activation.a2Count,
        target: '3–5',
        met: activation.a2Count >= 3
      },
      returned: {
        current: returningParticipants,
        target: '≥2',
        met: returningParticipants >= 2
      },
      positiveWtp: {
        current: positiveWtpCount,
        target: '≥1',
        met: positiveWtpCount >= 1
      },
      heavySupport: {
        current: support.many,
        total: totalParticipants
      }
    }
  }
}
