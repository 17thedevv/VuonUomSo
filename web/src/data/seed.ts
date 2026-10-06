import type { Organization } from '../domain/organization'
import type { Batch } from '../domain/batch'
import type { Contact } from '../domain/contact'
import type { Order } from '../domain/order'
import type { Reservation } from '../domain/reservation'
import type { Shipment } from '../domain/shipment'
import type { DomainEvent } from '../analytics/events'
import {
  organizationRepository,
  batchRepository,
  contactRepository,
  orderRepository,
  reservationRepository,
  shipmentRepository,
  eventRepository,
  settingsRepository
} from './repositories'

export const DEMO_ORGANIZATION: Organization = {
  id: 'org_hong_anh',
  name: 'Vườn Hồng Anh',
  capabilities: ['produce', 'sell', 'aggregate', 'transport']
}

export const DEMO_CONTACTS: Contact[] = [
  {
    id: 'contact_hung',
    name: 'Anh Hùng',
    phone: '0912 345 678',
    roles: ['customer']
  },
  {
    id: 'contact_lan',
    name: 'Chị Lan',
    phone: '0988 765 432',
    roles: ['customer']
  },
  {
    id: 'contact_nam',
    name: 'Anh Nam',
    phone: '0933 111 222',
    roles: ['customer']
  },
  {
    id: 'contact_thao',
    name: 'Vườn Thảo',
    phone: '0977 123 456',
    roles: ['supplier']
  },
  {
    id: 'contact_hong',
    name: 'Vườn Hồng',
    phone: '0966 234 567',
    roles: ['supplier']
  },
  {
    id: 'contact_an',
    name: 'Vườn An',
    phone: '0955 345 678',
    roles: ['supplier']
  }
]

// Date helpers for realistic dates
const now = new Date()
const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000).toISOString()
const daysHence = (d: number) => new Date(now.getTime() + d * 86400000).toISOString().split('T')[0]

export const DEMO_BATCHES: Batch[] = [
  {
    id: 'batch_bv16_12',
    code: 'BV16 #12',
    variety: 'Keo lai BV16',
    createdAt: daysAgo(35),
    initialQuantity: 50000,
    currentQuantity: 45200,
    readyQuantity: 32000,
    status: 'ready',
    sourceNote: 'Cây hom chuẩn giống viện KHLN'
  },
  {
    id: 'batch_ah1_07',
    code: 'AH1 #07',
    variety: 'Keo lai AH1',
    createdAt: daysAgo(20),
    initialQuantity: 32000,
    currentQuantity: 30100,
    readyQuantity: 0,
    status: 'nearly_ready',
    sourceNote: 'Cấy mô AH1 Hữu Lũng'
  },
  {
    id: 'batch_bv523_03',
    code: 'BV523 #03',
    variety: 'Keo lai BV523',
    createdAt: daysAgo(50),
    initialQuantity: 20000,
    currentQuantity: 18400,
    readyQuantity: 18400,
    preferredSellBefore: daysHence(3),
    status: 'ready',
    sourceNote: 'Vườn Tuấn Sơn, cần xuất sớm tránh quá lứa rễ ăn sâu'
  }
]

export const DEMO_ORDERS: Order[] = [
  {
    id: 'order_hung_01',
    customerId: 'contact_hung',
    variety: 'Keo lai BV16',
    requestedQuantity: 30000,
    requestedDate: daysHence(4),
    unitPrice: 1200,
    note: 'Giao tại bãi Tuấn Sơn, xe 5 tấn nhận',
    status: 'reserved'
  },
  {
    id: 'order_lan_01',
    customerId: 'contact_lan',
    variety: 'Keo lai BV16',
    requestedQuantity: 50000,
    requestedDate: daysHence(5),
    unitPrice: 1200,
    note: 'Cần xe ghép chuyển về bãi nhận Lục Nam',
    status: 'partially_reserved'
  },
  {
    id: 'order_nam_01',
    customerId: 'contact_nam',
    variety: 'Keo lai AH1',
    requestedQuantity: 20000,
    requestedDate: daysAgo(2),
    unitPrice: 900,
    note: 'Xe 3.5 tấn đã bốc xong tại vườn',
    status: 'shipped'
  }
]

export const DEMO_RESERVATIONS: Reservation[] = [
  // Order Anh Hùng: 30.000 plants total (10.000 from own batch, 20.000 from Vườn Thảo)
  {
    id: 'res_bv16_hung_own',
    orderId: 'order_hung_01',
    sourceType: 'own_batch',
    batchId: 'batch_bv16_12',
    quantity: 10000,
    fulfilledQuantity: 0,
    status: 'active',
    createdAt: daysAgo(1)
  },
  {
    id: 'res_bv16_hung_ext',
    orderId: 'order_hung_01',
    sourceType: 'external_supplier',
    supplierId: 'contact_thao',
    quantity: 20000,
    fulfilledQuantity: 0,
    status: 'active',
    createdAt: daysAgo(1)
  },

  // Order Chị Lan: 50.000 plants total (32.000 reserved, shortage = 18.000)
  {
    id: 'res_lan_ext_01',
    orderId: 'order_lan_01',
    sourceType: 'external_supplier',
    supplierId: 'contact_hong',
    quantity: 20000,
    fulfilledQuantity: 0,
    status: 'active',
    createdAt: daysAgo(2)
  },
  {
    id: 'res_lan_ext_02',
    orderId: 'order_lan_01',
    sourceType: 'external_supplier',
    supplierId: 'contact_an',
    quantity: 12000,
    fulfilledQuantity: 0,
    status: 'active',
    createdAt: daysAgo(2)
  },

  // Order Anh Nam: 20.000 plants fulfilled & shipped
  {
    id: 'res_nam_01',
    orderId: 'order_nam_01',
    sourceType: 'external_supplier',
    supplierId: 'contact_thao',
    quantity: 20000,
    fulfilledQuantity: 20000,
    status: 'fulfilled',
    createdAt: daysAgo(4)
  }
]

export const DEMO_SHIPMENTS: Shipment[] = [
  {
    id: 'ship_nam_01',
    orderId: 'order_nam_01',
    lines: [
      {
        reservationId: 'res_nam_01',
        sourceType: 'external_supplier',
        supplierId: 'contact_thao',
        quantity: 20000
      }
    ],
    plannedQuantity: 20000,
    shippedQuantity: 20000,
    plannedDate: daysAgo(2).split('T')[0],
    shippedAt: daysAgo(2),
    status: 'completed',
    note: 'Xe 3.5 tấn đã bốc xong tại vườn',
    createdAt: daysAgo(2)
  }
]

export const DEMO_EVENTS: DomainEvent[] = [
  {
    id: 'evt_bv16_01',
    type: 'reservation_created',
    entityType: 'batch',
    entityId: 'batch_bv16_12',
    payload: { message: 'Đã giữ 10.000 cây cho đơn Anh Hùng', quantity: 10000 },
    createdAt: daysAgo(1)
  },
  {
    id: 'evt_bv16_02',
    type: 'batch_inspected',
    entityType: 'batch',
    entityId: 'batch_bv16_12',
    payload: { message: 'Kiểm kê đợt 2: còn 45.200 cây', currentQuantity: 45200 },
    createdAt: daysAgo(4)
  },
  {
    id: 'evt_bv16_03',
    type: 'batch_status_changed',
    entityType: 'batch',
    entityId: 'batch_bv16_12',
    payload: { message: '32.000 cây đạt chuẩn đủ bán', readyQuantity: 32000 },
    createdAt: daysAgo(10)
  },
  {
    id: 'evt_bv16_04',
    type: 'batch_created',
    entityType: 'batch',
    entityId: 'batch_bv16_12',
    payload: { message: 'Nhập vườn 50.000 cây hom chuẩn KHLN', initialQuantity: 50000 },
    createdAt: daysAgo(35)
  }
]

/**
 * Resets the database and seeds the standard demo dataset.
 */
export async function resetDemoData(): Promise<void> {
  // Clear all data
  await clearAllData()

  // Populate demo data
  await organizationRepository.save(DEMO_ORGANIZATION)
  await contactRepository.saveMany(DEMO_CONTACTS)
  await batchRepository.saveMany(DEMO_BATCHES)
  await orderRepository.saveMany(DEMO_ORDERS)
  await reservationRepository.saveMany(DEMO_RESERVATIONS)
  await shipmentRepository.saveMany(DEMO_SHIPMENTS)

  // Seed events
  for (const evt of DEMO_EVENTS) {
    await eventRepository.record({
      type: evt.type,
      entityType: evt.entityType,
      entityId: evt.entityId,
      payload: evt.payload
    })
  }

  // Configure settings
  await settingsRepository.set('onboarding_completed', 'true')
  await settingsRepository.set('app_mode', 'demo')

  // Record domain event
  await eventRepository.record({
    type: 'demo_data_reset',
    entityType: 'system',
    entityId: 'demo',
    payload: { timestamp: new Date().toISOString() }
  })
}

/**
 * Clears demo transactions and enters Pilot mode with empty batches/orders.
 */
export async function resetToPilotWorkspace(orgName = 'Vườn của tôi'): Promise<void> {
  await clearAllData()

  const pilotOrg: Organization = {
    id: `org_${Date.now()}`,
    name: orgName,
    capabilities: ['produce', 'sell']
  }

  await organizationRepository.save(pilotOrg)
  await settingsRepository.set('onboarding_completed', 'true')
  await settingsRepository.set('app_mode', 'pilot')

  await eventRepository.record({
    type: 'pilot_workspace_initialized',
    entityType: 'organization',
    entityId: pilotOrg.id,
    payload: { name: orgName }
  })
}

/**
 * Completely clears all local data and returns to pristine initial state (un-onboarded).
 */
export async function clearAllData(): Promise<void> {
  await organizationRepository.clear()
  await contactRepository.clear()
  await batchRepository.clear()
  await orderRepository.clear()
  await reservationRepository.clear()
  await shipmentRepository.clear()
  await eventRepository.clear()
  await settingsRepository.clear()
}
