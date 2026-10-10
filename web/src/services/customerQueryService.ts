import { db } from '../data/db'
import { contactRepository, orderRepository, reservationRepository, shipmentRepository } from '../data/repositories'
import type { Contact } from '../domain/contact'
import { orderShortage, deriveOrderDisplayStatus, type OrderDisplayStatus } from '../domain/order'
import { remainingReservationQuantity, coveredQuantityForReservation } from '../domain/reservation'
import { validReservation } from '../domain/reconciliation'
import { shippedQuantityForOrder } from '../domain/shipment'
import { customerOrderReferences } from '../features/customers/customerOrderReference'

export interface CustomerSummary {
  id: string
  name: string
  phone?: string
  orderCount: number
  outstanding: number
  shipped: number
}
export interface CustomerOrderSummary {
  orderId: string
  referenceLabel: string
  variety: string
  requestedQuantity: number
  requestedDate?: string
  outstanding: number
  shipped: number
  shortage: number
  displayStatus: OrderDisplayStatus
}
export interface CustomerShipmentSummary {
  shipmentId: string
  orderId: string
  referenceLabel: string
  shippedQuantity: number
  shippedAt?: string
}
export interface CustomerDetailView {
  customer: CustomerSummary
  orders: CustomerOrderSummary[]
  completedShipments: CustomerShipmentSummary[]
}
export interface CustomersView {
  capturedAt: string
  customers: CustomerSummary[]
}

export function isCustomerContact(contact: Contact): boolean {
  return Array.isArray(contact.roles) && contact.roles.includes('customer') &&
    contact.roles.every(role => role === 'customer' || role === 'supplier')
}
function invalid(): never { throw new Error('Dữ liệu khách, đơn hoặc chuyến xuất cần kiểm tra.') }
function text(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !value.trim()) invalid()
}
function identity(value: unknown): asserts value is string {
  text(value)
  if (value === '.' || value === '..' || /[\p{Cc}\p{Cf}]/u.test(value)) invalid()
}
function quantity(value: unknown, positive = false): asserts value is number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < (positive ? 1 : 0)) invalid()
}
function add(a: number, b: number): number {
  quantity(b)
  if (b > Number.MAX_SAFE_INTEGER - a) invalid()
  return a + b
}
function optionalDate(value: unknown): void {
  if (value !== undefined && (typeof value !== 'string' || !value.trim() || !Number.isFinite(new Date(value).getTime()))) invalid()
}

/** Whole four-table snapshot fails closed. No implicit roles, guessed identity or repairs. */
async function readCustomers(): Promise<{ capturedAt: string; details: CustomerDetailView[] }> {
  const facts = await db.transaction('r', [db.contacts, db.orders, db.reservations, db.shipments], async () => ({
    contacts: await contactRepository.getAll(), orders: await orderRepository.getAll(),
    reservations: await reservationRepository.getAll(), shipments: await shipmentRepository.getAll()
  }))
  const eligible = facts.contacts.filter(isCustomerContact)
  const contacts = new Map(eligible.map(contact => {
    identity(contact.id); text(contact.name)
    if (contact.phone !== undefined && typeof contact.phone !== 'string') invalid()
    return [contact.id, contact] as const
  }))
  const orders = new Map(facts.orders.map(order => {
    identity(order.id); identity(order.customerId); text(order.variety); quantity(order.requestedQuantity, true)
    optionalDate(order.requestedDate)
    // Missing/legacy/supplier-only order customer is an explicit read error, never a guessed customer.
    if (!contacts.has(order.customerId) || !['open', 'partially_reserved', 'reserved', 'partially_shipped', 'shipped', 'cancelled'].includes(order.status)) invalid()
    return [order.id, order] as const
  }))
  if (orders.size !== facts.orders.length || contacts.size !== eligible.length) invalid()
  for (const reservation of facts.reservations) {
    identity(reservation.id); identity(reservation.orderId)
    if (!orders.has(reservation.orderId) || !validReservation(reservation)) invalid()
    if (reservation.sourceType === 'own_batch') identity(reservation.batchId)
    else identity(reservation.supplierId)
  }
  for (const shipment of facts.shipments) {
    identity(shipment.id); identity(shipment.orderId)
    if (!orders.has(shipment.orderId) || !['planned', 'completed', 'cancelled'].includes(shipment.status)) invalid()
    quantity(shipment.plannedQuantity, true); quantity(shipment.shippedQuantity, shipment.status === 'completed')
    optionalDate(shipment.shippedAt)
  }
  const references = customerOrderReferences([...orders.keys()])
  const details = [...contacts.values()].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0).map(contact => {
    let outstanding = 0
    let shipped = 0
    const rows = [...orders.values()].filter(order => order.customerId === contact.id).sort((a, b) => a.id < b.id ? -1 : 1).map(order => {
      const reservations = facts.reservations.filter(reservation => reservation.orderId === order.id)
      const shipments = facts.shipments.filter(shipment => shipment.orderId === order.id)
      // Check canonical sums before invoking helpers whose reducers do not guard overflow.
      reservations.reduce((total, reservation) => add(total, coveredQuantityForReservation(reservation)), 0)
      const ownOutstanding = reservations.filter(reservation => reservation.status === 'active')
        .reduce((total, reservation) => add(total, remainingReservationQuantity(reservation)), 0)
      shipments.filter(shipment => shipment.status === 'completed').reduce((total, shipment) => add(total, shipment.shippedQuantity), 0)
      const ownShipped = shippedQuantityForOrder(order.id, shipments)
      outstanding = add(outstanding, ownOutstanding)
      shipped = add(shipped, ownShipped)
      return { orderId: order.id, referenceLabel: references.get(order.id)!, variety: order.variety,
        requestedQuantity: order.requestedQuantity, requestedDate: order.requestedDate,
        outstanding: ownOutstanding, shipped: ownShipped, shortage: orderShortage(order, reservations),
        displayStatus: deriveOrderDisplayStatus(order, reservations, shipments) }
    })
    const completedShipments = facts.shipments.filter(shipment => shipment.status === 'completed' && orders.get(shipment.orderId)?.customerId === contact.id)
      .sort((a, b) => a.id < b.id ? -1 : 1).map(shipment => ({ shipmentId: shipment.id, orderId: shipment.orderId,
        referenceLabel: references.get(shipment.orderId)!, shippedQuantity: shipment.shippedQuantity, shippedAt: shipment.shippedAt }))
    return { customer: { id: contact.id, name: contact.name, phone: contact.phone, orderCount: rows.length, outstanding, shipped }, orders: rows, completedShipments }
  })
  return { capturedAt: new Date().toISOString(), details }
}

export async function getCustomers(): Promise<CustomersView> {
  const result = await readCustomers()
  return { capturedAt: result.capturedAt, customers: result.details.map(detail => detail.customer) }
}
export async function getCustomerDetail(id: string): Promise<CustomerDetailView | null> {
  identity(id)
  return (await readCustomers()).details.find(detail => detail.customer.id === id) ?? null
}
