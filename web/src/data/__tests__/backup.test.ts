import { describe, it, expect, beforeEach, vi } from 'vitest'
import { db } from '../db'
import {
  exportWorkspaceBackup,
  generateBackupFilename,
  restoreWorkspaceBackup,
  parseAndPreviewBackup,
  normalizeBackup,
  BACKUP_FORMAT
} from '../backup'
import type { Organization } from '../../domain/organization'
import type { Contact } from '../../domain/contact'
import type { Batch } from '../../domain/batch'
import type { Order } from '../../domain/order'
import type { Reservation } from '../../domain/reservation'
import type { Shipment } from '../../domain/shipment'
import type { BatchDossier } from '../../domain/dossier'

describe('Data: Backup & Restore System', () => {
  beforeEach(async () => {
    await db.organizations.clear()
    await db.settings.clear()
    await db.contacts.clear()
    await db.batches.clear()
    await db.orders.clear()
    await db.reservations.clear()
    await db.shipments.clear()
    await db.dossiers.clear()
    await db.events.clear()
  })

  // Helper to populate a rich workspace with all P0-P5 entities
  async function seedRichWorkspace() {
    const org: Organization = {
      id: 'org_test_01',
      name: 'Vườn Ươm Ba Vì',
      capabilities: ['produce', 'sell']
    }
    await db.organizations.add(org)
    await db.settings.add({ key: 'currentOrganizationId', value: org.id })

    const customer: Contact = {
      id: 'cust_01',
      name: 'Bác Hùng',
      phone: '0912345678',
      roles: ['customer']
    }
    const supplier: Contact = {
      id: 'sup_01',
      name: 'Vườn Cây Đầu Dòng Thảo',
      phone: '0987654321',
      roles: ['supplier']
    }
    await db.contacts.bulkAdd([customer, supplier])

    const batch: Batch = {
      id: 'batch_01',
      code: 'BV16 #01',
      variety: 'Keo lai BV16',
      initialQuantity: 50000,
      currentQuantity: 40000,
      readyQuantity: 30000,
      status: 'ready',
      createdAt: '2026-09-02T00:00:00.000Z'
    }
    await db.batches.add(batch)

    const order: Order = {
      id: 'order_01',
      customerId: 'cust_01',
      variety: 'Keo lai BV16',
      requestedQuantity: 20000,
      status: 'partially_shipped'
    }
    await db.orders.add(order)

    const resOwn: Reservation = {
      id: 'res_own_01',
      orderId: 'order_01',
      sourceType: 'own_batch',
      batchId: 'batch_01',
      quantity: 15000,
      fulfilledQuantity: 10000,
      status: 'active',
      createdAt: '2026-09-03T00:00:00.000Z'
    }
    const resExt: Reservation = {
      id: 'res_ext_01',
      orderId: 'order_01',
      sourceType: 'external_supplier',
      supplierId: 'sup_01',
      quantity: 5000,
      fulfilledQuantity: 0,
      status: 'active',
      createdAt: '2026-09-03T00:00:00.000Z'
    }
    await db.reservations.bulkAdd([resOwn, resExt])

    const shipmentCompleted: Shipment = {
      id: 'ship_comp_01',
      orderId: 'order_01',
      lines: [
        {
          reservationId: 'res_own_01',
          sourceType: 'own_batch',
          batchId: 'batch_01',
          quantity: 10000
        }
      ],
      plannedQuantity: 10000,
      shippedQuantity: 10000,
      plannedDate: '2026-09-10',
      shippedAt: '2026-09-10T08:00:00.000Z',
      status: 'completed',
      createdAt: '2026-09-09T00:00:00.000Z'
    }
    const shipmentPlanned: Shipment = {
      id: 'ship_plan_01',
      orderId: 'order_01',
      lines: [
        {
          reservationId: 'res_own_01',
          sourceType: 'own_batch',
          batchId: 'batch_01',
          quantity: 5000
        }
      ],
      plannedQuantity: 5000,
      shippedQuantity: 0,
      plannedDate: '2026-10-15',
      status: 'planned',
      createdAt: '2026-10-06T00:00:00.000Z'
    }
    await db.shipments.bulkAdd([shipmentCompleted, shipmentPlanned])

    const dossier: BatchDossier = {
      id: 'dos_01',
      batchId: 'batch_01',
      materialType: 'cutting',
      sourceName: 'Vườn Thảo',
      supplierContactId: 'sup_01',
      documents: [
        {
          id: 'doc_01',
          title: 'Phiếu xuất nguồn giống',
          number: '12/2026'
        }
      ],
      createdAt: '2026-09-02T00:00:00.000Z',
      updatedAt: '2026-09-02T00:00:00.000Z'
    }
    await db.dossiers.add(dossier)

    await db.events.add({
      id: 'evt_01',
      type: 'batch_created',
      entityType: 'batch',
      entityId: 'batch_01',
      payload: { code: 'BV16 #01' },
      createdAt: '2026-09-02T00:00:00.000Z'
    })
  }

  it('exports complete workspace with versioned envelope and correct counts', async () => {
    await seedRichWorkspace()

    const { backup, jsonString } = await exportWorkspaceBackup()

    expect(backup.format).toBe(BACKUP_FORMAT)
    expect(backup.formatVersion).toBe(1)
    expect(backup.dbSchemaVersion).toBe(4)

    expect(backup.recordCounts.organizations).toBe(1)
    expect(backup.recordCounts.contacts).toBe(2)
    expect(backup.recordCounts.batches).toBe(1)
    expect(backup.recordCounts.orders).toBe(1)
    expect(backup.recordCounts.reservations).toBe(2)
    expect(backup.recordCounts.shipments).toBe(2)
    expect(backup.recordCounts.dossiers).toBe(1)
    expect(backup.recordCounts.events).toBe(1)

    // Check JSON string is valid
    const parsed = JSON.parse(jsonString)
    expect(parsed.data.batches[0].code).toBe('BV16 #01')
  })

  it('generates predictable ASCII backup filename', () => {
    const fixedDate = new Date(2026, 9, 6, 21, 15) // Oct 6, 2026, 21:15
    const filename = generateBackupFilename(fixedDate)
    expect(filename).toBe('vuon-uom-backup-2026-10-06-2115.json')
  })

  it('MANDATORY: completes export -> restore round-trip preserving semantic records, IDs, and timestamps', async () => {
    await seedRichWorkspace()

    // 1. Export workspace A
    const { jsonString } = await exportWorkspaceBackup()

    // 2. Clear entire database (simulating new phone or catastrophic wipe)
    await db.organizations.clear()
    await db.settings.clear()
    await db.contacts.clear()
    await db.batches.clear()
    await db.orders.clear()
    await db.reservations.clear()
    await db.shipments.clear()
    await db.dossiers.clear()
    await db.events.clear()

    expect(await db.batches.count()).toBe(0)
    expect(await db.orders.count()).toBe(0)

    // 3. Restore from backup
    const restoreResult = await restoreWorkspaceBackup(jsonString)
    expect(restoreResult.success).toBe(true)
    expect(restoreResult.preview.organizationName).toBe('Vườn Ươm Ba Vì')

    // 4. Read restored records and compare
    const restoredBatch = await db.batches.get('batch_01')
    expect(restoredBatch).not.toBeNull()
    expect(restoredBatch?.code).toBe('BV16 #01')
    expect(restoredBatch?.currentQuantity).toBe(40000)
    expect(restoredBatch?.readyQuantity).toBe(30000)
    expect(restoredBatch?.createdAt).toBe('2026-09-02T00:00:00.000Z')

    const restoredOrder = await db.orders.get('order_01')
    expect(restoredOrder?.status).toBe('partially_shipped')
    expect(restoredOrder?.requestedQuantity).toBe(20000)

    const restoredRes = await db.reservations.get('res_own_01')
    expect(restoredRes?.fulfilledQuantity).toBe(10000)
    expect(restoredRes?.quantity).toBe(15000)

    const restoredShipment = await db.shipments.get('ship_comp_01')
    expect(restoredShipment?.status).toBe('completed')
    expect(restoredShipment?.shippedQuantity).toBe(10000)
    expect(restoredShipment?.lines?.[0]?.quantity).toBe(10000)

    const restoredDossier = await db.dossiers.get('dos_01')
    expect(restoredDossier?.batchId).toBe('batch_01')
    expect(restoredDossier?.documents?.[0]?.title).toBe('Phiếu xuất nguồn giống')
  })

  it('rejects invalid JSON syntax and leaves current database untouched', async () => {
    await seedRichWorkspace()

    await expect(restoreWorkspaceBackup('{ invalid json syntax')).rejects.toThrow(
      'File sao lưu không đúng định dạng JSON.'
    )

    // Current workspace remains completely intact
    expect(await db.batches.count()).toBe(1)
    expect(await db.orders.count()).toBe(1)
  })

  it('rejects wrong format from other apps without mutating database', async () => {
    await seedRichWorkspace()

    const wrongFormat = JSON.stringify({
      format: 'some-other-erp-app',
      version: 1,
      data: {}
    })

    await expect(restoreWorkspaceBackup(wrongFormat)).rejects.toThrow(
      'File không phải bản sao lưu hợp lệ của Vườn Ươm.'
    )

    expect(await db.batches.count()).toBe(1)
  })

  it('rejects future format version with friendly update message', async () => {
    await seedRichWorkspace()

    const futureBackup = JSON.stringify({
      format: 'vuonuom-backup',
      formatVersion: 999,
      data: {}
    })

    await expect(restoreWorkspaceBackup(futureBackup)).rejects.toThrow(
      'Bản sao này được tạo bởi phiên bản Vườn Ươm mới hơn. Hãy cập nhật ứng dụng trước khi khôi phục.'
    )

    expect(await db.batches.count()).toBe(1)
  })

  it('rejects duplicate IDs within table before restore starts', async () => {
    await seedRichWorkspace()

    const { backup } = await exportWorkspaceBackup()
    // Inject duplicate batch id
    backup.data.batches.push({
      ...backup.data.batches[0]
    })

    const invalidJson = JSON.stringify(backup)

    await expect(restoreWorkspaceBackup(invalidJson)).rejects.toThrow(
      'Trùng lặp mã định danh "batch_01"'
    )

    // DB remains intact
    expect(await db.batches.count()).toBe(1)
  })

  it('rejects broken referential links (e.g. reservation points to missing order)', async () => {
    await seedRichWorkspace()

    const { backup } = await exportWorkspaceBackup()
    backup.data.reservations[0].orderId = 'missing_order_xyz'

    const invalidJson = JSON.stringify(backup)

    await expect(restoreWorkspaceBackup(invalidJson)).rejects.toThrow(
      'Đơn hàng "missing_order_xyz" không tồn tại.'
    )

    expect(await db.batches.count()).toBe(1)
  })

  it('rejects invalid quantities (e.g. readyQuantity > currentQuantity)', async () => {
    await seedRichWorkspace()

    const { backup } = await exportWorkspaceBackup()
    // Corrupt batch: ready > current
    backup.data.batches[0].readyQuantity = 45000
    backup.data.batches[0].currentQuantity = 40000

    const invalidJson = JSON.stringify(backup)

    await expect(restoreWorkspaceBackup(invalidJson)).rejects.toThrow(
      'Cây đủ chuẩn (45000) vượt quá số cây còn sống (40000)'
    )

    expect(await db.batches.count()).toBe(1)
  })

  it('rejects reservation with fulfilledQuantity > quantity', async () => {
    await seedRichWorkspace()

    const { backup } = await exportWorkspaceBackup()
    backup.data.reservations[0].fulfilledQuantity = 20000
    backup.data.reservations[0].quantity = 15000

    const invalidJson = JSON.stringify(backup)

    await expect(restoreWorkspaceBackup(invalidJson)).rejects.toThrow(
      'vượt quá số lượng giữ'
    )

    expect(await db.batches.count()).toBe(1)
  })

  it('rejects corrupt shipment integrity (plannedQuantity != sum of lines)', async () => {
    await seedRichWorkspace()

    const { backup } = await exportWorkspaceBackup()
    // Corrupt plannedQuantity vs line quantity sum
    backup.data.shipments[0].plannedQuantity = 20000 // line is only 10000

    const invalidJson = JSON.stringify(backup)

    await expect(restoreWorkspaceBackup(invalidJson)).rejects.toThrow(
      'không khớp với số lượng dự kiến'
    )

    expect(await db.batches.count()).toBe(1)
  })

  it('imports and normalizes exact legacy pre-P5 backup format without data loss', async () => {
    // Exact fixture matching pre-P5 DatabaseBackup format
    const legacyFixture = {
      version: 1,
      exportedAt: '2026-09-05T12:00:00.000Z',
      organization: {
        id: 'org_legacy_01',
        name: 'Vườn Ươm Cũ',
        phone: '0901234567',
        address: 'Hà Nội',
        createdAt: '2026-09-01T00:00:00.000Z'
      },
      contacts: [
        { id: 'c_leg_1', name: 'Anh Nam', phone: '0911111111', roles: ['customer'] }
      ],
      batches: [
        {
          id: 'b_leg_1',
          code: 'KL-01',
          variety: 'Keo lai BV16',
          initialQuantity: 10000,
          currentQuantity: 9000,
          readyQuantity: 8000,
          status: 'ready',
          createdAt: '2026-09-01T00:00:00.000Z'
        }
      ],
      orders: [
        {
          id: 'o_leg_1',
          customerId: 'c_leg_1',
          variety: 'Keo lai BV16',
          requestedQuantity: 5000,
          status: 'reserved'
        }
      ],
      reservations: [
        {
          id: 'r_leg_1',
          orderId: 'o_leg_1',
          sourceType: 'own_batch',
          batchId: 'b_leg_1',
          quantity: 5000,
          status: 'active',
          // fulfilledQuantity missing in legacy!
          createdAt: '2026-09-02T00:00:00.000Z'
        }
      ],
      shipments: [
        {
          id: 's_leg_1',
          orderId: 'o_leg_1',
          shippedQuantity: 0,
          status: 'planned'
          // lines, plannedQuantity missing in legacy!
        }
      ],
      events: []
    }

    const legacyJson = JSON.stringify(legacyFixture)

    // Normalize check
    const normalized = normalizeBackup(legacyFixture)
    expect(normalized.format).toBe(BACKUP_FORMAT)
    expect(normalized.data.organizations.length).toBe(1)
    expect(normalized.data.organizations[0].name).toBe('Vườn Ươm Cũ')
    expect(normalized.data.reservations[0].fulfilledQuantity).toBe(0)
    expect(normalized.data.shipments[0].lines).toEqual([])
    expect(normalized.data.dossiers).toEqual([])

    // Restore check
    const res = await restoreWorkspaceBackup(legacyJson)
    expect(res.success).toBe(true)
    expect(res.preview.organizationName).toBe('Vườn Ươm Cũ')

    // Verify in database
    const batch = await db.batches.get('b_leg_1')
    expect(batch?.code).toBe('KL-01')

    const resRecord = await db.reservations.get('r_leg_1')
    expect(resRecord?.fulfilledQuantity).toBe(0)
  })

  it('previews backup safely without executing any mutations', () => {
    const rawBackup = {
      format: 'vuonuom-backup',
      formatVersion: 1,
      exportedAt: '2026-10-06T15:00:00.000Z',
      recordCounts: {
        organizations: 1,
        settings: 1,
        contacts: 1,
        batches: 2,
        orders: 1,
        reservations: 1,
        shipments: 1,
        dossiers: 1,
        events: 0
      },
      data: {
        organizations: [{ id: 'org_1', name: 'Vườn Mẫu' }],
        settings: [{ key: 'currentOrganizationId', value: 'org_1' }],
        contacts: [{ id: 'c_1', name: 'Khách', roles: ['customer'] }],
        batches: [
          { id: 'b_1', code: 'B1', variety: 'Keo', initialQuantity: 1000, currentQuantity: 1000, readyQuantity: 1000, status: 'ready' },
          { id: 'b_2', code: 'B2', variety: 'Bạch đàn', initialQuantity: 2000, currentQuantity: 2000, readyQuantity: 2000, status: 'ready' }
        ],
        orders: [
          { id: 'o_1', customerId: 'c_1', variety: 'Keo', requestedQuantity: 500, status: 'reserved' }
        ],
        reservations: [
          { id: 'r_1', orderId: 'o_1', sourceType: 'own_batch', batchId: 'b_1', quantity: 500, fulfilledQuantity: 0, status: 'active' }
        ],
        shipments: [
          { id: 's_1', orderId: 'o_1', plannedQuantity: 500, shippedQuantity: 0, status: 'planned', lines: [{ reservationId: 'r_1', sourceType: 'own_batch', batchId: 'b_1', quantity: 500 }] }
        ],
        dossiers: [
          { id: 'd_1', batchId: 'b_1', materialType: 'seed', documents: [] }
        ],
        events: []
      }
    }

    const previewResult = parseAndPreviewBackup(JSON.stringify(rawBackup))
    expect(previewResult.success).toBe(true)
    expect(previewResult.preview?.organizationName).toBe('Vườn Mẫu')
    expect(previewResult.preview?.recordCounts.batches).toBe(2)
  })

  it('MANDATORY: guarantees transaction rollback when restore fails mid-transaction', async () => {
    // 1. Seed initial workspace with distinct batch
    await db.batches.add({
      id: 'batch_original',
      code: 'ORIGINAL-01',
      variety: 'Keo lai',
      initialQuantity: 1000,
      currentQuantity: 1000,
      readyQuantity: 1000,
      status: 'ready',
      createdAt: '2026-09-01'
    })

    // 2. Prepare valid backup of different workspace
    const rawBackup = {
      format: 'vuonuom-backup',
      formatVersion: 1,
      exportedAt: '2026-10-06T15:00:00.000Z',
      recordCounts: {
        organizations: 0,
        settings: 0,
        contacts: 0,
        batches: 1,
        orders: 0,
        reservations: 0,
        shipments: 0,
        dossiers: 0,
        events: 0
      },
      data: {
        organizations: [],
        settings: [],
        contacts: [],
        batches: [
          {
            id: 'batch_new',
            code: 'NEW-01',
            variety: 'Bạch đàn',
            initialQuantity: 500,
            currentQuantity: 500,
            readyQuantity: 500,
            status: 'ready',
            createdAt: '2026-10-06'
          }
        ],
        orders: [],
        reservations: [],
        shipments: [],
        dossiers: [],
        events: []
      }
    }
    const backupJson = JSON.stringify(rawBackup)

    // 3. Spy and mock error during db.batches.bulkPut inside the transaction
    const bulkPutSpy = vi.spyOn(db.batches, 'bulkPut').mockRejectedValueOnce(
      new Error('Disk failure during bulkPut')
    )

    // 4. Run restore -> must reject
    await expect(restoreWorkspaceBackup(backupJson)).rejects.toThrow('Disk failure during bulkPut')

    // 5. Restore original function
    bulkPutSpy.mockRestore()

    // 6. Verify Dexie TRANSACTION ROLLBACK: original batch is STILL in database!
    const originalBatch = await db.batches.get('batch_original')
    expect(originalBatch).not.toBeNull()
    expect(originalBatch?.code).toBe('ORIGINAL-01')

    // The new batch was NOT committed
    const newBatch = await db.batches.get('batch_new')
    expect(newBatch).toBeUndefined()
  })
})
