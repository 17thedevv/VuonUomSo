import { validationRepository } from './validation.repository'
import { settingsRepository } from '../data/repositories'
import type {
  PilotSession,
  SupportLevel,
  ReturnIntention,
  WillingnessToPay,
  UsefulArea
} from './validation.types'

export const ACTIVE_SESSION_STORAGE_KEY = 'vuonuom_active_pilot_session_id'

export interface CompleteSessionInput {
  sessionId: string
  supportLevel?: SupportLevel
  wouldUseNextWeek?: ReturnIntention
  willingnessToPay?: WillingnessToPay
  mostUsefulArea?: UsefulArea
}

const KNOWN_SUPPORT_LEVELS = new Set<SupportLevel>(['none', 'once', 'few', 'many'])
const KNOWN_RETURN_INTENTIONS = new Set<ReturnIntention>(['yes', 'maybe', 'no'])
const KNOWN_WTP = new Set<WillingnessToPay>([
  'zero',
  'under_50k',
  '50_100k',
  '100_200k',
  'over_200k',
  'unsure'
])
const KNOWN_USEFUL_AREAS = new Set<UsefulArea>([
  'stock',
  'orders',
  'reservation',
  'shipment',
  'dossier',
  'backup',
  'other'
])

function getStoredSessionId(): string | null {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      return window.sessionStorage.getItem(ACTIVE_SESSION_STORAGE_KEY)
    }
  } catch {
    // Ignore storage errors in restricted contexts
  }
  return null
}

function setStoredSessionId(id: string): void {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, id)
    }
  } catch {
    // Ignore storage errors
  }
}

function clearStoredSessionId(): void {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY)
    }
  } catch {
    // Ignore storage errors
  }
}

/**
 * Validates and sanitizes a participant code (e.g. "P01", "P02").
 * Rejects full names, spaces, emails, phone numbers, or pure numeric IDs to strictly protect privacy.
 */
export function sanitizeParticipantCode(code: string): string {
  const trimmed = code.trim().toUpperCase()
  if (!trimmed) {
    throw new Error('Mã người thử không được để trống.')
  }
  if (trimmed.length < 2) {
    throw new Error('Mã người thử phải có ít nhất 2 ký tự (ví dụ: P01, P02).')
  }
  if (trimmed.length > 20) {
    throw new Error('Mã người thử quá dài (tối đa 20 ký tự).')
  }
  // Disallow spaces (likely full name)
  if (/\s/.test(trimmed)) {
    throw new Error('Mã người thử không được chứa khoảng trắng (dùng mã như P01, P02).')
  }
  // Disallow email patterns
  if (/@|\.(COM|VN|NET|ORG)/.test(trimmed)) {
    throw new Error('Không dùng địa chỉ email làm mã người thử. Hãy dùng mã ẩn danh như P01, P02.')
  }
  // Disallow phone numbers (starts with 0, 84, +84, or has >= 7 digits)
  if (/^(\+?84|0)\d+/.test(trimmed) || /\d{7,}/.test(trimmed)) {
    throw new Error('Không dùng số điện thoại làm mã người thử. Hãy dùng mã ẩn danh như P01, P02.')
  }
  // Allow only alphanumeric, dash, underscore
  if (!/^[A-Z0-9_-]+$/.test(trimmed)) {
    throw new Error('Mã người thử chỉ được chứa chữ cái, số, dấu gạch nối (-) hoặc gạch dưới (_).')
  }
  // Disallow purely numeric codes
  if (!/[A-Z]/.test(trimmed)) {
    throw new Error('Mã người thử phải chứa ít nhất một chữ cái (ví dụ: P01, P02).')
  }
  return trimmed
}

/**
 * Starts a new pilot session with explicit consent and pseudonymous participant code.
 * Enforces the invariant: at most ONE active pilot session at any time.
 */
export async function startPilotSession(
  participantCodeInput: string,
  consent: 'accepted',
  modeInput?: 'pilot' | 'demo'
): Promise<PilotSession> {
  if (consent !== 'accepted') {
    throw new Error('Chưa có sự đồng ý tham gia thử nghiệm (consent).')
  }

  const participantCode = sanitizeParticipantCode(participantCodeInput)

  let mode: 'pilot' | 'demo' = modeInput ?? 'pilot'
  if (!modeInput) {
    try {
      const modeVal = await settingsRepository.get('app_mode')
      mode = modeVal === 'demo' ? 'demo' : 'pilot'
    } catch {
      mode = 'pilot'
    }
  }

  // Invariant: max 1 active session in DB
  const existingActive = await validationRepository.getActivePilotSession()
  if (existingActive) {
    throw new Error(
      `Đang có một buổi thử nghiệm đang mở với mã "${existingActive.participantCode}". Hãy kết thúc buổi thử trước khi bắt đầu buổi mới.`
    )
  }

  const newSession: PilotSession = {
    id: `psess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    participantCode,
    consent: 'accepted',
    startedAt: new Date().toISOString(),
    mode
  }

  await validationRepository.savePilotSession(newSession)
  setStoredSessionId(newSession.id)

  return newSession
}

/**
 * Returns the currently active pilot session if one exists.
 */
export async function getActivePilotSession(): Promise<PilotSession | undefined> {
  const storedId = getStoredSessionId()
  if (storedId) {
    const session = await validationRepository.getPilotSession(storedId)
    if (session && !session.endedAt) {
      return session
    }
  }

  // Fallback to checking the database directly
  const active = await validationRepository.getActivePilotSession()
  if (active) {
    setStoredSessionId(active.id)
    return active
  }

  clearStoredSessionId()
  return undefined
}

/**
 * Completes a pilot session with optional survey responses.
 * Idempotent: If the session was already completed, updates survey responses without failing.
 */
export async function completePilotSession(input: CompleteSessionInput): Promise<PilotSession> {
  const { sessionId, supportLevel, wouldUseNextWeek, willingnessToPay, mostUsefulArea } = input

  const session = await validationRepository.getPilotSession(sessionId)
  if (!session) {
    throw new Error('Buổi thử nghiệm không tồn tại.')
  }

  if (supportLevel && !KNOWN_SUPPORT_LEVELS.has(supportLevel)) {
    throw new Error(`Mức độ trợ giúp "${supportLevel}" không hợp lệ.`)
  }
  if (wouldUseNextWeek && !KNOWN_RETURN_INTENTIONS.has(wouldUseNextWeek)) {
    throw new Error(`Ý định quay lại "${wouldUseNextWeek}" không hợp lệ.`)
  }
  if (willingnessToPay && !KNOWN_WTP.has(willingnessToPay)) {
    throw new Error(`Mức phí chi trả "${willingnessToPay}" không hợp lệ.`)
  }
  if (mostUsefulArea && !KNOWN_USEFUL_AREAS.has(mostUsefulArea)) {
    throw new Error(`Khu vực hữu ích nhất "${mostUsefulArea}" không hợp lệ.`)
  }

  const updated: PilotSession = {
    ...session,
    endedAt: session.endedAt || new Date().toISOString(),
    supportLevel: supportLevel ?? session.supportLevel,
    wouldUseNextWeek: wouldUseNextWeek ?? session.wouldUseNextWeek,
    willingnessToPay: willingnessToPay ?? session.willingnessToPay,
    mostUsefulArea: mostUsefulArea ?? session.mostUsefulArea
  }

  await validationRepository.savePilotSession(updated)

  // Clear active session storage if this was the active one
  const currentStored = getStoredSessionId()
  if (currentStored === sessionId) {
    clearStoredSessionId()
  }

  return updated
}
