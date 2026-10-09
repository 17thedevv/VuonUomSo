import { db } from '../data/db'
import { batchRepository, reservationRepository } from '../data/repositories'
import type { Batch } from '../domain/batch'
import { type Reservation, validateReservationQuantity } from '../domain/reservation'
import {
  reservedOutstandingQuantityForBatch,
  availableQuantityForBatch,
  commitmentShortageForBatch
} from '../domain/quantity'

export interface QuantityTotals {
  living: number
  ready: number
  outstanding: number
  available: number
  commitmentShortage: number
}

export interface GardenBatchAvailability extends QuantityTotals {
  id: string
  code: string
  variety: string
}

export interface GardenVarietyGroup {
  key: string
  label: string
  batchIds: string[]
  /** Presentation/search metadata only; never the input to group totals. */
  matchedBatchIds: string[]
  totals: QuantityTotals
  batches: GardenBatchAvailability[]
}

export interface GardenAvailabilityView {
  basis: 'legacy_variety'
  /** Local view creation time after successful capture/projection, not a stocktake time. */
  capturedAt: string
  /** Whole garden, independent of search and view filters. */
  ownTotals: QuantityTotals
  groups: GardenVarietyGroup[]
}

export interface GardenAvailabilityQuery {
  search?: string
  view?: 'available' | 'all'
}

const metrics = ['living', 'ready', 'outstanding', 'available', 'commitmentShortage'] as const
const zeroTotals = (): QuantityTotals => ({ living: 0, ready: 0, outstanding: 0, available: 0, commitmentShortage: 0 })
const normalize = (value: string): string => value.trim().toLowerCase()
// Code-unit ordering is deterministic across device locales.
const compareStrings = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0

function invalid(context: string): never {
  throw new Error(`Garden availability: dữ liệu không hợp lệ (${context}).`)
}

function requireText(value: unknown, context: string): asserts value is string {
  if (typeof value !== 'string' || !value.trim()) invalid(context)
}

function requireQuantity(value: unknown, context: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) invalid(context)
}

function addTotals(target: QuantityTotals, facts: QuantityTotals): void {
  for (const metric of metrics) {
    // Check before addition, including outstanding/shortage when stock is zero.
    if (facts[metric] > Number.MAX_SAFE_INTEGER - target[metric]) invalid(`${metric} overflow`)
    target[metric] += facts[metric]
  }
}

function projectSnapshot(batches: Batch[], reservations: Reservation[], query: GardenAvailabilityQuery) {
  const batchIds = new Set<string>()
  for (const batch of batches) {
    requireText(batch.id, 'batch.id')
    requireText(batch.code, `batch ${batch.id}.code`)
    requireText(batch.variety, `batch ${batch.id}.variety`)
    requireQuantity(batch.currentQuantity, `batch ${batch.id}.currentQuantity`)
    requireQuantity(batch.readyQuantity, `batch ${batch.id}.readyQuantity`)
    if (batch.readyQuantity > batch.currentQuantity) invalid(`batch ${batch.id}: ready > living`)
    batchIds.add(batch.id)
  }

  const ownReservations = new Map<string, Reservation[]>()
  for (const reservation of reservations) {
    // External facts are not own stock, even if an extraneous batchId collides.
    if (reservation.sourceType === 'external_supplier') continue
    if (reservation.sourceType !== 'own_batch') invalid(`reservation ${reservation.id}.sourceType`)
    requireText(reservation.batchId, `reservation ${reservation.id}.batchId`)
    if (!batchIds.has(reservation.batchId)) invalid(`reservation ${reservation.id}: missing batch`)
    if (!['active', 'released', 'fulfilled'].includes(reservation.status)) invalid(`reservation ${reservation.id}.status`)
    if (!validateReservationQuantity(reservation.quantity).valid) invalid(`reservation ${reservation.id}.quantity`)
    // Missing legacy F uses the canonical default. Explicit F must be a valid fact.
    if (reservation.fulfilledQuantity !== undefined) {
      requireQuantity(reservation.fulfilledQuantity, `reservation ${reservation.id}.fulfilledQuantity`)
    }
    const fulfilled = reservation.fulfilledQuantity ?? 0
    if (fulfilled > reservation.quantity) invalid(`reservation ${reservation.id}: F > Q`)
    if (reservation.status === 'active' && fulfilled === reservation.quantity) invalid(`reservation ${reservation.id}: active fully fulfilled`)
    if (reservation.status === 'fulfilled' && reservation.fulfilledQuantity !== undefined && fulfilled !== reservation.quantity) {
      invalid(`reservation ${reservation.id}: incomplete fulfilled quantity`)
    }
    const list = ownReservations.get(reservation.batchId) ?? []
    list.push(reservation)
    ownReservations.set(reservation.batchId, list)
  }

  const groupsByKey = new Map<string, GardenVarietyGroup>()
  const ownTotals = zeroTotals()
  for (const batch of [...batches].sort((a, b) => compareStrings(a.id, b.id))) {
    const commitments = ownReservations.get(batch.id) ?? []
    const outstanding = reservedOutstandingQuantityForBatch(batch.id, commitments)
    requireQuantity(outstanding, `batch ${batch.id}.outstanding overflow`)
    const facts: GardenBatchAvailability = {
      id: batch.id, code: batch.code, variety: batch.variety,
      living: batch.currentQuantity, ready: batch.readyQuantity, outstanding,
      available: availableQuantityForBatch(batch, commitments),
      commitmentShortage: commitmentShortageForBatch(batch, commitments)
    }
    const key = normalize(batch.variety)
    let group = groupsByKey.get(key)
    if (!group) {
      // Batches are ID-sorted, so the first batch supplies the stable label.
      group = { key, label: batch.variety.trim(), batchIds: [], matchedBatchIds: [], totals: zeroTotals(), batches: [] }
      groupsByKey.set(key, group)
    }
    group.batchIds.push(batch.id)
    group.batches.push(facts)
    addTotals(group.totals, facts)
    addTotals(ownTotals, facts)
  }

  const search = normalize(query.search ?? '')
  const groups = [...groupsByKey.values()]
    .sort((a, b) => compareStrings(a.key, b.key))
    .filter((group) => {
      group.matchedBatchIds = group.key.includes(search)
        ? [...group.batchIds]
        : group.batches.filter((batch) => normalize(batch.code).includes(search)).map((batch) => batch.id)
      return group.matchedBatchIds.length > 0 && (query.view === 'all' || group.totals.available > 0)
    })
  return { ownTotals, groups }
}

/**
 * Stateless, fail-closed read projection. Errors reject the entire view; no partial totals.
 * A displayed snapshot never authorizes a reserve: mutations re-read current authority.
 * Last-request-wins belongs to the V2-A2 UI integration, not this read service.
 */
export async function getGardenAvailability(query: GardenAvailabilityQuery = {}): Promise<GardenAvailabilityView> {
  if (query.search !== undefined && typeof query.search !== 'string') invalid('query.search')
  if (query.view !== undefined && query.view !== 'available' && query.view !== 'all') invalid('query.view')
  const snapshot = await db.transaction('r', [db.batches, db.reservations], async () => {
    const batches = await batchRepository.getAll()
    const reservations = await reservationRepository.getAll()
    return { batches, reservations }
  })
  const projection = projectSnapshot(snapshot.batches, snapshot.reservations, query)
  return { basis: 'legacy_variety', ...projection, capturedAt: new Date().toISOString() }
}
