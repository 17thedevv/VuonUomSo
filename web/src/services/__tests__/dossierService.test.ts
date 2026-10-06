import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../../data/db'
import type { Batch } from '../../domain/batch'
import {
  saveBatchDossier,
  getBatchDossier,
  getBatchDossierDetail,
  getDossierCompleteness
} from '../dossierService'

describe('Service: Batch Dossier', () => {
  const BATCH_ID = 'b_dossier_test_01'
  const SUPPLIER_ID = 'sup_dossier_01'
  const CUSTOMER_ID = 'cust_dossier_01'

  beforeEach(async () => {
    await db.batches.clear()
    await db.contacts.clear()
    await db.dossiers.clear()
    await db.events.clear()

    // Seed test batch
    const batch: Batch = {
      id: BATCH_ID,
      code: 'BV16 #05',
      variety: 'Keo lai BV16',
      initialQuantity: 15000,
      currentQuantity: 15000,
      readyQuantity: 12000,
      status: 'ready',
      createdAt: '2026-09-01'
    }
    await db.batches.add(batch)

    // Seed test supplier
    await db.contacts.add({
      id: SUPPLIER_ID,
      name: 'Vườn cây đầu dòng Ba Vì',
      phone: '0912345678',
      roles: ['supplier']
    })

    // Seed test contact that is NOT a supplier
    await db.contacts.add({
      id: CUSTOMER_ID,
      name: 'Khách hàng A',
      phone: '0987654321',
      roles: ['customer']
    })
  })

  it('creates a new dossier for a batch and saves to db', async () => {
    const res = await saveBatchDossier({
      batchId: BATCH_ID,
      materialType: 'cutting',
      sourceName: 'Vườn đầu dòng',
      sourceLocation: 'Hà Nội',
      sourceLotCode: 'BV16-2026-01',
      supplierContactId: SUPPLIER_ID,
      documents: [
        {
          id: 'doc_1',
          title: 'Phiếu nguồn giống',
          number: '12/2026'
        }
      ]
    })

    expect(res.success).toBe(true)
    expect(res.dossier.batchId).toBe(BATCH_ID)
    expect(res.dossier.materialType).toBe('cutting')
    expect(res.dossier.supplierContactId).toBe(SUPPLIER_ID)
    expect(res.dossier.documents.length).toBe(1)

    // Verify persisted
    const saved = await getBatchDossier(BATCH_ID)
    expect(saved).not.toBeNull()
    expect(saved?.id).toBe(res.dossier.id)
    expect(saved?.sourceLotCode).toBe('BV16-2026-01')

    // Verify domain event
    const events = await db.events.toArray()
    expect(events.length).toBe(1)
    expect(events[0].type).toBe('dossier_created')
    expect(events[0].entityId).toBe(BATCH_ID)
  })

  it('enforces 1:1 invariant: updates existing dossier instead of creating duplicate', async () => {
    // First save
    const first = await saveBatchDossier({
      batchId: BATCH_ID,
      materialType: 'cutting',
      sourceName: 'Nguồn 1'
    })

    // Second save for same batch
    const second = await saveBatchDossier({
      batchId: BATCH_ID,
      materialType: 'tissue_culture',
      sourceName: 'Nguồn 2 đã sửa'
    })

    expect(second.dossier.id).toBe(first.dossier.id)
    expect(second.dossier.materialType).toBe('tissue_culture')
    expect(second.dossier.sourceName).toBe('Nguồn 2 đã sửa')

    // Verify only 1 dossier exists for batch in database
    const allDossiers = await db.dossiers.toArray()
    expect(allDossiers.length).toBe(1)
    expect(allDossiers[0].id).toBe(first.dossier.id)

    // Verify update event recorded
    const events = await db.events.toArray()
    expect(events.length).toBe(2)
    expect(events[1].type).toBe('dossier_updated')
  })

  it('rejects saving dossier for non-existent batch (orphan guard)', async () => {
    await expect(
      saveBatchDossier({
        batchId: 'non_existent_batch_999',
        materialType: 'cutting'
      })
    ).rejects.toThrow('Lô cây không tồn tại.')

    const allDossiers = await db.dossiers.toArray()
    expect(allDossiers.length).toBe(0)
  })

  it('rejects saving dossier if supplier contact does not exist', async () => {
    await expect(
      saveBatchDossier({
        batchId: BATCH_ID,
        materialType: 'seed',
        supplierContactId: 'ghost_supplier_123'
      })
    ).rejects.toThrow('Không tìm thấy liên hệ nhà cung cấp.')
  })

  it('rejects saving dossier if referenced contact lacks supplier role', async () => {
    await expect(
      saveBatchDossier({
        batchId: BATCH_ID,
        materialType: 'seed',
        supplierContactId: CUSTOMER_ID
      })
    ).rejects.toThrow('Liên hệ này không phải nguồn cung cây.')
  })

  it('allows saving incomplete historical dossier (empty source and unknown material)', async () => {
    const res = await saveBatchDossier({
      batchId: BATCH_ID,
      materialType: 'unknown'
    })

    expect(res.success).toBe(true)
    expect(res.dossier.materialType).toBe('unknown')
    expect(res.dossier.sourceName).toBeUndefined()
    expect(res.dossier.documents.length).toBe(0)

    const completeness = getDossierCompleteness(res.dossier)
    expect(completeness).toBe('basic')
  })

  it('cleans out completely empty document references', async () => {
    const res = await saveBatchDossier({
      batchId: BATCH_ID,
      materialType: 'cutting',
      documents: [
        { id: 'doc_empty_1', title: '   ', number: '' },
        { id: 'doc_valid_1', title: 'Phiếu giao nhận giống' },
        { id: 'doc_empty_2', title: '', number: '   ', note: '' }
      ]
    })

    expect(res.dossier.documents.length).toBe(1)
    expect(res.dossier.documents[0].title).toBe('Phiếu giao nhận giống')
  })

  it('retrieves detailed dossier with resolved batch and supplier', async () => {
    await saveBatchDossier({
      batchId: BATCH_ID,
      materialType: 'cutting',
      supplierContactId: SUPPLIER_ID,
      documents: [{ id: 'doc_1', title: 'Hồ sơ cây mẹ', number: 'BV-99' }]
    })

    const detail = await getBatchDossierDetail(BATCH_ID)
    expect(detail).not.toBeNull()
    expect(detail?.batch.code).toBe('BV16 #05')
    expect(detail?.supplierContact?.name).toBe('Vườn cây đầu dòng Ba Vì')
    expect(detail?.completeness).toBe('referenced')
  })
})
