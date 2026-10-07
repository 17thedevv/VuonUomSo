export type SupportLevel = 'none' | 'once' | 'few' | 'many'
export type ReturnIntention = 'yes' | 'maybe' | 'no'
export type WillingnessToPay =
  | 'zero'
  | 'under_50k'
  | '50_100k'
  | '100_200k'
  | 'over_200k'
  | 'unsure'
export type UsefulArea =
  | 'stock'
  | 'orders'
  | 'reservation'
  | 'shipment'
  | 'dossier'
  | 'backup'
  | 'other'

/**
 * Strictly pseudonymous participant code regex: P followed by 2 to 4 digits (e.g. P01, P002, P1234).
 * Single source of truth for both runtime sanitization and export boundary verification.
 */
export const PARTICIPANT_CODE_REGEX = /^P\d{2,4}$/

export interface PilotSession {
  id: string
  participantCode: string // e.g. "P01", "P02", uppercase/sanitized, no real names or phone
  consent: 'accepted'
  startedAt: string // ISO string
  endedAt?: string // ISO string
  mode?: 'pilot' | 'demo'

  supportLevel?: SupportLevel
  wouldUseNextWeek?: ReturnIntention
  willingnessToPay?: WillingnessToPay
  mostUsefulArea?: UsefulArea
}

export type ValidationRoute =
  | 'onboarding'
  | 'today'
  | 'batches'
  | 'batch_new'
  | 'batch_detail'
  | 'orders'
  | 'order_new'
  | 'order_detail'
  | 'order_reserve'
  | 'shipments'
  | 'shipment_new'
  | 'shipment_detail'
  | 'dossier'
  | 'more'
  | 'pilot_tools'
  | 'validation_report'

export type ValidationAction =
  | 'onboarding_completed'
  | 'batch_created'
  | 'inventory_updated'
  | 'contact_created'
  | 'order_created'
  | 'reservation_created'
  | 'reservation_released'
  | 'shipment_planned'
  | 'shipment_cancelled'
  | 'shipment_completed'
  | 'dossier_saved'
  | 'backup_exported'
  | 'backup_restored'

export type ValidationFailureKind =
  | 'validation'
  | 'insufficient_stock'
  | 'domain_conflict'
  | 'not_found'
  | 'storage'
  | 'unknown'

export interface ValidationEventBase {
  id: string
  sessionId: string
  participantCode: string
  mode: 'pilot' | 'demo'
  createdAt: string
}

export interface ScreenViewedEvent extends ValidationEventBase {
  type: 'screen_viewed'
  route: ValidationRoute
  action?: undefined
  failureKind?: undefined
}

export interface FormStartedEvent extends ValidationEventBase {
  type: 'form_started'
  action: ValidationAction
  route?: undefined
  failureKind?: undefined
}

export interface ActionCompletedEvent extends ValidationEventBase {
  type: 'action_completed'
  action: ValidationAction
  route?: undefined
  failureKind?: undefined
}

export interface ActionFailedEvent extends ValidationEventBase {
  type: 'action_failed'
  action: ValidationAction
  failureKind: ValidationFailureKind
  route?: undefined
}

export type ValidationEvent =
  | ScreenViewedEvent
  | FormStartedEvent
  | ActionCompletedEvent
  | ActionFailedEvent

export interface ActivationMetrics {
  totalParticipants: number
  a1Count: number // Data Entry (>= 1 batch_created, inventory_updated, or order_created)
  a2Count: number // Core Workflow (>= 2 core actions and at least one high-value action or inventory+view)
  a3Count: number // Operational Return (A2 + returned another calendar day)
}

export interface TaskSummary {
  action: ValidationAction
  label: string
  completedCount: number
  failedCount: number
}

export interface ValidationSummary {
  totalParticipants: number
  totalSessions: number
  completedSessions: number
  activeSessions: number
  returningParticipants: number

  activation: ActivationMetrics

  tasks: TaskSummary[]

  support: Record<SupportLevel, number>
  willingnessToPay: Record<WillingnessToPay, number>
  returnIntention: Record<ReturnIntention, number>
  mostUsefulArea: Record<UsefulArea, number>

  evidence: {
    activatedA2: { current: number; target: string; met: boolean }
    returned: { current: number; target: string; met: boolean }
    positiveWtp: { current: number; target: string; met: boolean }
    heavySupport: { current: number; total: number }
  }
}

export interface VuonUomValidationExportV1 {
  format: 'vuonuom-validation'
  formatVersion: 1
  exportedAt: string
  summary: ValidationSummary
  sessions: PilotSession[]
  events: ValidationEvent[]
}
