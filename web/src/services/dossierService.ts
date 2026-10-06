import { db } from '../data/db'
import type {
  BatchDossier,
  PlantingMaterialType,
  DossierDocumentRef,
  DossierCompleteness
} from '../domain/dossier'
import { deriveDossierCompleteness, isDocumentRefNonEmpty } from '../domain/dossier'
import type { Batch } from '../domain/batch'
import type { Contact } from '../domain/contact'
import { createDomainEvent } from '../analytics/events'

export interface SaveBatchDossierInput {
  batchId: string
  materialType: PlantingMaterialType
  sourceName?: string
  sourceLocation?: string
  sourceLotCode?: string
  supplierContactId?: string
  receivedAt?: string
  propagatedAt?: string
  documents?: DossierDocumentRef[]
  note?: string
}

export interface BatchDossierDetail {
  dossier: BatchDossier | null
  batch: Batch
  supplierContact: Contact | null
  completeness: DossierCompleteness
}

/**
 * Retrieves the dossier for a batch if one exists.
 */
export async function getBatchDossier(batchId: string): Promise<BatchDossier | null> {
  const dossier = await db.dossiers.where('batchId').equals(batchId).first()
  return dossier ?? null
}

/**
 * Retrieves full dossier detail with resolved batch and supplier contact.
 */
export async function getBatchDossierDetail(batchId: string): Promise<BatchDossierDetail | null> {
  const batch = await db.batches.get(batchId)
  if (!batch) return null

  const dossier = (await db.dossiers.where('batchId').equals(batchId).first()) ?? null
  let supplierContact: Contact | null = null

  if (dossier?.supplierContactId) {
    supplierContact = (await db.contacts.get(dossier.supplierContactId)) ?? null
  }

  const completeness = deriveDossierCompleteness(dossier)

  return {
    dossier,
    batch,
    supplierContact,
    completeness
  }
}

/**
 * Derives completeness label from dossier.
 */
export function getDossierCompleteness(dossier: BatchDossier | null): DossierCompleteness {
  return deriveDossierCompleteness(dossier)
}

/**
 * Saves or updates a batch dossier with domain validation and 1:1 invariant enforcement.
 *
 * Enforces:
 * 1. Batch must exist (rejects orphan dossier).
 * 2. One batch -> at most one dossier. Updates existing dossier if one already exists.
 * 3. supplierContactId validation: must exist and have role 'supplier'.
 * 4. Filters out completely empty document references.
 * 5. Records minimal domain event on success.
 */
export async function saveBatchDossier(input: SaveBatchDossierInput): Promise<{
  success: boolean
  dossier: BatchDossier
}> {
  const {
    batchId,
    materialType,
    sourceName,
    sourceLocation,
    sourceLotCode,
    supplierContactId,
    receivedAt,
    propagatedAt,
    documents = [],
    note
  } = input

  return await db.transaction('rw', [db.batches, db.contacts, db.dossiers, db.events], async () => {
    // 1. Re-read batch to guarantee existence
    const batch = await db.batches.get(batchId)
    if (!batch) {
      throw new Error('Lô cây không tồn tại.')
    }

    // 2. Validate supplierContactId if provided
    let verifiedSupplierId: string | undefined = undefined
    if (supplierContactId && supplierContactId.trim()) {
      const contact = await db.contacts.get(supplierContactId.trim())
      if (!contact) {
        throw new Error('Không tìm thấy liên hệ nhà cung cấp.')
      }
      if (!contact.roles.includes('supplier')) {
        throw new Error('Liên hệ này không phải nguồn cung cây.')
      }
      verifiedSupplierId = contact.id
    }

    // 3. Clean and normalize document references (remove completely empty documents)
    const validDocuments: DossierDocumentRef[] = documents
      .filter(isDocumentRefNonEmpty)
      .map((doc, idx) => ({
        id: doc.id && doc.id.trim() ? doc.id.trim() : `doc_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
        title: doc.title?.trim() || undefined,
        number: doc.number?.trim() || undefined,
        issuedBy: doc.issuedBy?.trim() || undefined,
        issuedAt: doc.issuedAt?.trim() || undefined,
        note: doc.note?.trim() || undefined
      }))

    // 4. Check for existing dossier (enforcing 1:1 invariant)
    const existingDossier = await db.dossiers.where('batchId').equals(batchId).first()
    const now = new Date().toISOString()
    const isNew = !existingDossier

    const dossier: BatchDossier = {
      id: existingDossier?.id || `dos_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      batchId,
      materialType: materialType || 'unknown',
      sourceName: sourceName?.trim() || undefined,
      sourceLocation: sourceLocation?.trim() || undefined,
      sourceLotCode: sourceLotCode?.trim() || undefined,
      supplierContactId: verifiedSupplierId,
      receivedAt: receivedAt?.trim() || undefined,
      propagatedAt: propagatedAt?.trim() || undefined,
      documents: validDocuments,
      note: note?.trim() || undefined,
      createdAt: existingDossier?.createdAt || now,
      updatedAt: now
    }

    await db.dossiers.put(dossier)

    // 5. Record minimal domain event
    await db.events.put(
      createDomainEvent(
        isNew ? 'dossier_created' : 'dossier_updated',
        'batch',
        batchId,
        {
          dossierId: dossier.id,
          batchId
        }
      )
    )

    return {
      success: true,
      dossier
    }
  })
}
