import { describe, it, expect } from 'vitest'
import {
  deriveDossierCompleteness,
  isDocumentRefNonEmpty,
  MATERIAL_TYPE_LABELS,
  type BatchDossier,
  type DossierDocumentRef
} from '../dossier'

describe('Domain: Batch Dossier', () => {
  it('maps material types to forestry Vietnamese labels', () => {
    expect(MATERIAL_TYPE_LABELS.seed).toBe('Hạt giống')
    expect(MATERIAL_TYPE_LABELS.cutting).toBe('Hom')
    expect(MATERIAL_TYPE_LABELS.tissue_culture).toBe('Cây mô')
    expect(MATERIAL_TYPE_LABELS.seedling).toBe('Cây giống mua/nhận từ nguồn khác')
    expect(MATERIAL_TYPE_LABELS.other).toBe('Khác')
    expect(MATERIAL_TYPE_LABELS.unknown).toBe('Chưa rõ')
  })

  it('derives none completeness when dossier is null or undefined', () => {
    expect(deriveDossierCompleteness(null)).toBe('none')
    expect(deriveDossierCompleteness(undefined)).toBe('none')
  })

  it('derives none completeness when dossier has unknown material and no source info', () => {
    const emptyDossier: BatchDossier = {
      id: 'dos_empty',
      batchId: 'batch_empty',
      materialType: 'unknown',
      documents: [],
      createdAt: '2026-10-01',
      updatedAt: '2026-10-01'
    }
    expect(deriveDossierCompleteness(emptyDossier)).toBe('none')
  })

  it('derives basic completeness when dossier exists without reference documents', () => {
    const dossier: BatchDossier = {
      id: 'dos_1',
      batchId: 'batch_1',
      materialType: 'cutting',
      sourceName: 'Vườn đầu dòng',
      documents: [],
      createdAt: '2026-10-01',
      updatedAt: '2026-10-01'
    }
    expect(deriveDossierCompleteness(dossier)).toBe('basic')
  })

  it('derives basic completeness when documents array only contains empty document refs', () => {
    const dossier: BatchDossier = {
      id: 'dos_1',
      batchId: 'batch_1',
      materialType: 'seed',
      documents: [{ id: 'doc_empty', title: '   ', number: '' }],
      createdAt: '2026-10-01',
      updatedAt: '2026-10-01'
    }
    expect(deriveDossierCompleteness(dossier)).toBe('basic')
  })

  it('derives referenced completeness when at least one valid document ref exists', () => {
    const dossier: BatchDossier = {
      id: 'dos_1',
      batchId: 'batch_1',
      materialType: 'cutting',
      documents: [
        {
          id: 'doc_1',
          title: 'Phiếu nguồn giống',
          number: '12/2026'
        }
      ],
      createdAt: '2026-10-01',
      updatedAt: '2026-10-01'
    }
    expect(deriveDossierCompleteness(dossier)).toBe('referenced')
  })

  it('identifies non-empty vs empty document references accurately', () => {
    const emptyDoc: DossierDocumentRef = { id: 'doc_1', title: '  ', number: '' }
    expect(isDocumentRefNonEmpty(emptyDoc)).toBe(false)

    const docWithTitle: DossierDocumentRef = { id: 'doc_2', title: 'Giấy chứng nhận' }
    expect(isDocumentRefNonEmpty(docWithTitle)).toBe(true)

    const docWithNumber: DossierDocumentRef = { id: 'doc_3', number: '05/2026/GCN' }
    expect(isDocumentRefNonEmpty(docWithNumber)).toBe(true)

    const docWithIssuer: DossierDocumentRef = { id: 'doc_4', issuedBy: 'Chi cục Lâm nghiệp' }
    expect(isDocumentRefNonEmpty(docWithIssuer)).toBe(true)

    const docWithNote: DossierDocumentRef = { id: 'doc_5', note: 'Lưu tại tủ số 2' }
    expect(isDocumentRefNonEmpty(docWithNote)).toBe(true)
  })
})
