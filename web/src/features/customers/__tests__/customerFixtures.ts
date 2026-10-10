import { db } from '../../../data/db'

export const orderA = 'same-order-prefix-a'
export const orderB = 'same-order-prefix-b'
export async function customerFixture() {
  await db.contacts.bulkPut([
    { id: 'customer-a', name: 'Anh Hùng', phone: '0912345678', roles: ['customer'] },
    { id: 'customer-b', name: 'Khách hai vai trò', roles: ['customer', 'supplier'] },
    { id: 'customer-c', name: 'Anh Hùng', phone: '0912345678', roles: ['customer'] },
    { id: 'supplier', name: 'Vườn ngoài', roles: ['supplier'] }
  ])
  // Two completed own-source shipments of 40 already reduced living/ready by 80.
  await db.batches.put({ id: 'batch', code: 'MH01', variety: 'Monthong', initialQuantity: 200, currentQuantity: 120, readyQuantity: 120, createdAt: '2026-10-01', status: 'ready' })
  await db.orders.bulkPut([orderA, orderB].map(id => ({ id, customerId: 'customer-a', variety: 'Monthong', requestedQuantity: 100,
    requestedDate: '2026-10-15', status: 'partially_shipped' as const, unitPrice: 999, note: 'PRIVATE NOTE' })))
  await db.reservations.bulkPut([
    { id: 'own-active', orderId: orderA, sourceType: 'own_batch', batchId: 'batch', quantity: 100, fulfilledQuantity: 40, status: 'active', createdAt: '2026-10-01' },
    { id: 'own-released', orderId: orderB, sourceType: 'own_batch', batchId: 'batch', quantity: 100, fulfilledQuantity: 40, status: 'released', createdAt: '2026-10-01' },
    { id: 'external', orderId: orderB, sourceType: 'external_supplier', supplierId: 'supplier', quantity: 60, fulfilledQuantity: 0, status: 'active', createdAt: '2026-10-02' }
  ])
  await db.shipments.bulkPut([
    { id: 'shipped-a', orderId: orderA, plannedQuantity: 40, shippedQuantity: 40, shippedAt: '2026-10-05', status: 'completed', lines: [{ reservationId: 'own-active', sourceType: 'own_batch', batchId: 'batch', quantity: 40 }] },
    { id: 'shipped-b', orderId: orderB, plannedQuantity: 40, shippedQuantity: 40, status: 'completed', lines: [{ reservationId: 'own-released', sourceType: 'own_batch', batchId: 'batch', quantity: 40 }] },
    { id: 'planned', orderId: orderA, plannedQuantity: 20, shippedQuantity: 0, plannedDate: '2026-10-15', status: 'planned', lines: [{ reservationId: 'own-active', sourceType: 'own_batch', batchId: 'batch', quantity: 20 }] },
    { id: 'cancelled', orderId: orderB, plannedQuantity: 20, shippedQuantity: 0, status: 'cancelled', lines: [{ reservationId: 'own-released', sourceType: 'own_batch', batchId: 'batch', quantity: 20 }] }
  ])
}
export const businessSnapshot = () => Promise.all([db.contacts, db.batches, db.orders, db.reservations, db.shipments, db.events, db.dossiers].map(table => table.toArray()))
