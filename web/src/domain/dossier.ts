export type PlantingMaterialType =
  | 'seed'
  | 'cutting'
  | 'tissue_culture'
  | 'seedling'
  | 'other'
  | 'unknown'

export const MATERIAL_TYPE_LABELS: Record<PlantingMaterialType, string> = {
  seed: 'Hạt giống',
  cutting: 'Hom',
  tissue_culture: 'Cây mô',
  seedling: 'Cây giống mua/nhận từ nguồn khác',
  other: 'Khác',
  unknown: 'Chưa rõ'
}

export interface DossierDocumentRef {
  id: string
  title?: string
  number?: string
  issuedBy?: string
  issuedAt?: string
  note?: string
}

export interface BatchDossier {
  id: string
  batchId: string
  materialType: PlantingMaterialType
  sourceName?: string
  sourceLocation?: string
  sourceLotCode?: string
  supplierContactId?: string
  receivedAt?: string
  propagatedAt?: string
  documents: DossierDocumentRef[]
  note?: string
  createdAt: string
  updatedAt: string
}

export type DossierCompleteness = 'none' | 'basic' | 'referenced'

export const DOSSIER_COMPLETENESS_LABELS: Record<DossierCompleteness, string> = {
  none: 'Chưa có hồ sơ',
  basic: 'Đã ghi nguồn',
  referenced: 'Có chứng từ tham chiếu'
}

/**
 * Derives dossier completeness.
 * - none: no dossier exists
 * - basic: dossier exists and has material or source info
 * - referenced: at least one non-empty document reference exists
 */
export function deriveDossierCompleteness(dossier: BatchDossier | null | undefined): DossierCompleteness {
  if (!dossier) return 'none'

  const hasReferenceDoc = (dossier.documents ?? []).some((doc) => {
    return Boolean(
      (doc.title && doc.title.trim()) ||
      (doc.number && doc.number.trim()) ||
      (doc.issuedBy && doc.issuedBy.trim())
    )
  })

  if (hasReferenceDoc) return 'referenced'

  return 'basic'
}

/**
 * Validates document reference. An empty document reference has no title, number, issuedBy, issuedAt, or note.
 */
export function isDocumentRefNonEmpty(doc: DossierDocumentRef): boolean {
  return Boolean(
    (doc.title && doc.title.trim()) ||
    (doc.number && doc.number.trim()) ||
    (doc.issuedBy && doc.issuedBy.trim()) ||
    (doc.issuedAt && doc.issuedAt.trim()) ||
    (doc.note && doc.note.trim())
  )
}
