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
 * Returns the count of unique participant codes.
 */
export function countParticipants(sessions: PilotSession[]): number {
  const codes = new Set(sessions.map((s) => s.participantCode.toUpperCase()))
  return codes.size
}

/**
 * Counts total, completed, and in-progress pilot sessions.
 */
export function countPilotSessions(sessions: PilotSession[]): {
  total: number
  completed: number
  active: number
} {
  const completed = sessions.filter((s) => !!s.endedAt).length
  return {
    total: sessions.length,
    completed,
    active: sessions.length - completed
  }
}

/**
 * Counts participants who returned across at least 2 distinct calendar days.
 * Calendar day is derived from startedAt in local ISO date slice (YYYY-MM-DD).
 */
export function countReturningParticipants(sessions: PilotSession[]): number {
  const daysByParticipant = new Map<string, Set<string>>()

  for (const s of sessions) {
    const code = s.participantCode.toUpperCase()
    const day = s.startedAt.slice(0, 10)
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
 * Excludes demo mode events by default to prevent inflating pilot evidence.
 */
export function deriveActivationMetrics(
  sessions: PilotSession[],
  events: ValidationEvent[],
  includeDemo = false
): ActivationMetrics {
  const validEvents = includeDemo ? events : events.filter((e) => e.mode === 'pilot')

  // Group completed actions by participant
  const completedActionsByParticipant = new Map<string, Set<ValidationAction>>()
  const participantActiveDays = new Map<string, Set<string>>()

  for (const s of sessions) {
    const code = s.participantCode.toUpperCase()
    const day = s.startedAt.slice(0, 10)
    if (!participantActiveDays.has(code)) {
      participantActiveDays.set(code, new Set())
    }
    participantActiveDays.get(code)!.add(day)
  }

  for (const e of validEvents) {
    if (e.type === 'action_completed') {
      const code = e.participantCode.toUpperCase()
      if (!completedActionsByParticipant.has(code)) {
        completedActionsByParticipant.set(code, new Set())
      }
      completedActionsByParticipant.get(code)!.add(e.action)
    }
  }

  const allParticipantCodes = new Set(sessions.map((s) => s.participantCode.toUpperCase()))
  let a1Count = 0
  let a2Count = 0
  let a3Count = 0

  for (const code of allParticipantCodes) {
    const actions = completedActionsByParticipant.get(code) || new Set<ValidationAction>()
    const days = participantActiveDays.get(code) || new Set<string>()

    // A1: Data Entry (at least 1 batch_created, inventory_updated, or order_created)
    const hasA1 =
      actions.has('batch_created') ||
      actions.has('inventory_updated') ||
      actions.has('order_created')

    if (hasA1) {
      a1Count++
    }

    // A2: Core Workflow (at least 2 distinct core actions AND a value-creation step)
    const coreActionKeys: ValidationAction[] = [
      'batch_created',
      'inventory_updated',
      'order_created',
      'reservation_created',
      'shipment_planned',
      'shipment_completed',
      'dossier_saved'
    ]
    const distinctCoreCount = coreActionKeys.filter((k) => actions.has(k)).length
    const hasHighValueStep =
      actions.has('reservation_created') ||
      actions.has('shipment_planned') ||
      actions.has('shipment_completed') ||
      (actions.has('inventory_updated') && actions.has('batch_created'))

    const hasA2 = distinctCoreCount >= 2 && hasHighValueStep

    if (hasA2) {
      a2Count++
    }

    // A3: Operational Return (Achieved A2 + returned on another calendar day)
    const isReturning = days.size >= 2
    if (hasA2 && isReturning) {
      a3Count++
    }
  }

  return {
    totalParticipants: allParticipantCodes.size,
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

export function summarizeSupport(sessions: PilotSession[]): Record<SupportLevel, number> {
  const counts: Record<SupportLevel, number> = {
    none: 0,
    once: 0,
    few: 0,
    many: 0
  }
  for (const s of sessions) {
    if (s.supportLevel && counts[s.supportLevel] !== undefined) {
      counts[s.supportLevel]++
    }
  }
  return counts
}

export function summarizeWillingnessToPay(
  sessions: PilotSession[]
): Record<WillingnessToPay, number> {
  const counts: Record<WillingnessToPay, number> = {
    zero: 0,
    under_50k: 0,
    '50_100k': 0,
    '100_200k': 0,
    over_200k: 0,
    unsure: 0
  }
  for (const s of sessions) {
    if (s.willingnessToPay && counts[s.willingnessToPay] !== undefined) {
      counts[s.willingnessToPay]++
    }
  }
  return counts
}

export function summarizeReturnIntention(
  sessions: PilotSession[]
): Record<ReturnIntention, number> {
  const counts: Record<ReturnIntention, number> = {
    yes: 0,
    maybe: 0,
    no: 0
  }
  for (const s of sessions) {
    if (s.wouldUseNextWeek && counts[s.wouldUseNextWeek] !== undefined) {
      counts[s.wouldUseNextWeek]++
    }
  }
  return counts
}

export function summarizeMostUsefulArea(sessions: PilotSession[]): Record<UsefulArea, number> {
  const counts: Record<UsefulArea, number> = {
    stock: 0,
    orders: 0,
    reservation: 0,
    shipment: 0,
    dossier: 0,
    backup: 0,
    other: 0
  }
  for (const s of sessions) {
    if (s.mostUsefulArea && counts[s.mostUsefulArea] !== undefined) {
      counts[s.mostUsefulArea]++
    }
  }
  return counts
}

/**
 * Builds a deterministic, reproducible ValidationSummary from sessions and telemetry events.
 */
export function buildValidationSummary(
  sessions: PilotSession[],
  events: ValidationEvent[],
  options?: { includeDemo?: boolean }
): ValidationSummary {
  const includeDemo = options?.includeDemo ?? false
  const totalParticipants = countParticipants(sessions)
  const sessionCounts = countPilotSessions(sessions)
  const returningParticipants = countReturningParticipants(sessions)
  const activation = deriveActivationMetrics(sessions, events, includeDemo)
  const tasks = summarizeTasks(events, includeDemo)
  const support = summarizeSupport(sessions)
  const willingnessToPay = summarizeWillingnessToPay(sessions)
  const returnIntention = summarizeReturnIntention(sessions)
  const mostUsefulArea = summarizeMostUsefulArea(sessions)

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
