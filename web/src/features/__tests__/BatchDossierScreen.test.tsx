import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { BatchDossierScreen } from '../dossiers/BatchDossierScreen'
import { db } from '../../data/db'
import type { Batch } from '../../domain/batch'
import type { Contact } from '../../domain/contact'
import type { Organization } from '../../domain/organization'
import type { BatchDossier } from '../../domain/dossier'

describe('BatchDossierScreen', () => {
  const BATCH_ID = 'batch_dossier_test'

  beforeEach(async () => {
    await db.batches.clear()
    await db.contacts.clear()
    await db.dossiers.clear()
    await db.organizations.clear()

    const batch: Batch = {
      id: BATCH_ID,
      code: 'BV16 #12',
      variety: 'Keo lai BV16',
      initialQuantity: 50000,
      currentQuantity: 45200,
      readyQuantity: 32000,
      status: 'ready',
      createdAt: '2026-09-01T00:00:00.000Z'
    }
    await db.batches.add(batch)

    const org: Organization = {
      id: 'org_1',
      name: 'Vườn Ươm Ba Vì',
      capabilities: ['produce', 'sell']
    }
    await db.organizations.add(org)

    const supplier: Contact = {
      id: 'sup_test',
      name: 'Vườn Cây Đầu Dòng',
      phone: '0988776655',
      roles: ['supplier']
    }
    await db.contacts.add(supplier)
  })

  it('renders initial create form when batch has no dossier yet', async () => {
    render(
      <MemoryRouter initialEntries={[`/dossiers/${BATCH_ID}`]}>
        <Routes>
          <Route path="/dossiers/:batchId" element={<BatchDossierScreen />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getAllByText(/BV16 #12/).length).toBeGreaterThanOrEqual(1)
      expect(screen.getByLabelText(/Loại vật liệu nhân giống/)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /LƯU HỒ SƠ/ })).toBeInTheDocument()
    })
  })

  it('saves new dossier with material type and reference document', async () => {
    render(
      <MemoryRouter initialEntries={[`/dossiers/${BATCH_ID}`]}>
        <Routes>
          <Route path="/dossiers/:batchId" element={<BatchDossierScreen />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByLabelText(/Loại vật liệu nhân giống/)).toBeInTheDocument()
    })

    // Enter source name
    const sourceInput = screen.getByLabelText(/Nguồn \/ Nơi lấy vật liệu/)
    fireEvent.change(sourceInput, { target: { value: 'Rừng giống Ba Vì' } })

    // Add a reference document
    const addDocBtn = screen.getByRole('button', { name: /Thêm chứng từ/ })
    fireEvent.click(addDocBtn)

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Phiếu nguồn giống/)).toBeInTheDocument()
    })

    const docTitleInput = screen.getByPlaceholderText(/Phiếu nguồn giống/)
    fireEvent.change(docTitleInput, { target: { value: 'Phiếu nguồn giống 2026' } })

    const docNumberInput = screen.getByPlaceholderText(/12\/2026\/GCN/)
    fireEvent.change(docNumberInput, { target: { value: '08/BV-2026' } })

    // Save dossier
    const submitBtn = screen.getByRole('button', { name: /LƯU HỒ SƠ/ })
    fireEvent.click(submitBtn)

    // After save, transitions to read mode
    await waitFor(() => {
      expect(screen.getByText('Rừng giống Ba Vì')).toBeInTheDocument()
      expect(screen.getByText('Phiếu nguồn giống 2026')).toBeInTheDocument()
      expect(screen.getByText(/Số: 08\/BV-2026/)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /SỬA HỒ SƠ/ })).toBeInTheDocument()
    })

    // Verify persisted in Dexie
    const persisted = await db.dossiers.where('batchId').equals(BATCH_ID).first()
    expect(persisted).not.toBeNull()
    expect(persisted?.sourceName).toBe('Rừng giống Ba Vì')
    expect(persisted?.documents.length).toBe(1)
  })

  it('renders read mode for existing dossier and triggers window.print on print button click', async () => {
    const existingDossier: BatchDossier = {
      id: 'dos_existing',
      batchId: BATCH_ID,
      materialType: 'cutting',
      sourceName: 'Vườn cây đầu dòng Ba Vì',
      sourceLotCode: 'BV16-01',
      documents: [
        {
          id: 'doc_1',
          title: 'Hồ sơ cây mẹ',
          number: '123/QD'
        }
      ],
      createdAt: '2026-09-02',
      updatedAt: '2026-09-02'
    }
    await db.dossiers.add(existingDossier)

    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {})

    render(
      <MemoryRouter initialEntries={[`/dossiers/${BATCH_ID}`]}>
        <Routes>
          <Route path="/dossiers/:batchId" element={<BatchDossierScreen />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Vườn cây đầu dòng Ba Vì')).toBeInTheDocument()
      expect(screen.getByText('BV16-01')).toBeInTheDocument()
      expect(screen.getByText('Hồ sơ cây mẹ')).toBeInTheDocument()
      // Check disclaimer
      expect(
        screen.getAllByText(
          /Hồ sơ này là bản lưu nội bộ trong Vườn Ươm\. Không thay thế giấy tờ hoặc chứng nhận do cơ quan có thẩm quyền cấp\./
        ).length
      ).toBeGreaterThan(0)
    })

    // Click print button
    const printBtn = screen.getByRole('button', { name: /In hoặc lưu PDF/ })
    fireEvent.click(printBtn)

    expect(printSpy).toHaveBeenCalled()
    printSpy.mockRestore()
  })
})
