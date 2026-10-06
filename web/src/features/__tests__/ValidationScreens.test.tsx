import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { db } from '../../data/db'
import { PilotSessionPanel } from '../validation/PilotSessionPanel'
import { ValidationReportScreen } from '../validation/ValidationReportScreen'
import { validationRepository } from '../../validation/validation.repository'

describe('Validation UI Components', () => {
  beforeEach(async () => {
    await db.pilotSessions.clear()
    await db.validationEvents.clear()
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.clear()
    }
  })

  describe('PilotSessionPanel', () => {
    it('renders start session panel and initiates session on submit', async () => {
      render(
        <MemoryRouter>
          <PilotSessionPanel />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByText('Buổi thử nghiệm tại vườn (Pilot)')).toBeInTheDocument()
      })
      expect(screen.getByText(/Không ghi tên\/số điện thoại trong dữ liệu/i)).toBeInTheDocument()

      const input = screen.getByLabelText(/Mã người thử/i) as HTMLInputElement
      fireEvent.change(input, { target: { value: 'P05' } })

      const startBtn = screen.getByRole('button', { name: /Bắt đầu buổi thử/i })
      fireEvent.click(startBtn)

      await waitFor(() => {
        expect(screen.getByText(/Buổi thử đang hoạt động/i)).toBeInTheDocument()
        expect(screen.getByText('P05')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /Kết thúc buổi thử/i })).toBeInTheDocument()
      })
    })

    it('opens end survey modal and completes session with survey answers', async () => {
      // Seed active session
      await validationRepository.savePilotSession({
        id: 'psess_ui_01',
        participantCode: 'P09',
        consent: 'accepted',
        startedAt: new Date().toISOString()
      })
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.setItem('vuonuom_active_pilot_session_id', 'psess_ui_01')
      }

      render(
        <MemoryRouter>
          <PilotSessionPanel />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByText('P09')).toBeInTheDocument()
      })

      const endBtn = screen.getByRole('button', { name: /Kết thúc buổi thử/i })
      fireEvent.click(endBtn)

      // Survey modal is open
      await waitFor(() => {
        expect(screen.getByText(/Khảo sát kết thúc buổi thử/i)).toBeInTheDocument()
        expect(screen.getByText(/1. Trong buổi thử này người dùng cần trợ giúp bao nhiêu?/i)).toBeInTheDocument()
      })

      // Submit survey
      const submitBtn = screen.getByRole('button', { name: /Lưu & Hoàn thành/i })
      fireEvent.click(submitBtn)

      await waitFor(() => {
        expect(screen.queryByText(/Khảo sát kết thúc buổi thử/i)).not.toBeInTheDocument()
        // Active session ended, back to start form
        expect(screen.getByRole('button', { name: /Bắt đầu buổi thử/i })).toBeInTheDocument()
      })

      const sessionInDb = await validationRepository.getPilotSession('psess_ui_01')
      expect(sessionInDb?.endedAt).toBeDefined()
      expect(sessionInDb?.supportLevel).toBeDefined()
    })
  })

  describe('ValidationReportScreen', () => {
    it('renders report sections with evidence against targets', async () => {
      // Seed completed session and events
      await validationRepository.savePilotSession({
        id: 'psess_rep_01',
        participantCode: 'P01',
        consent: 'accepted',
        startedAt: '2026-10-06T10:00:00.000Z',
        endedAt: '2026-10-06T10:30:00.000Z',
        supportLevel: 'none',
        wouldUseNextWeek: 'yes',
        willingnessToPay: '50_100k',
        mostUsefulArea: 'stock'
      })

      await validationRepository.recordValidationEvent({
        id: 'vevt_rep_01',
        sessionId: 'psess_rep_01',
        participantCode: 'P01',
        mode: 'pilot',
        type: 'action_completed',
        action: 'batch_created',
        createdAt: '2026-10-06T10:05:00.000Z'
      })

      render(
        <MemoryRouter>
          <ValidationReportScreen />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByText('Báo cáo thử nghiệm')).toBeInTheDocument()
        expect(screen.getByText('THỬ NGHIỆM')).toBeInTheDocument()
        expect(screen.getByText('KÍCH HOẠT')).toBeInTheDocument()
        expect(screen.getByText(/BẰNG CHỨNG VALIDATION \(SO VỚI MỤC TIÊU\)/i)).toBeInTheDocument()
      })
    })
  })
})
