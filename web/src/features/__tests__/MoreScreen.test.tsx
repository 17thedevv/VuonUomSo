import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { MoreScreen } from '../more/MoreScreen'
import { resetDemoData, clearAllData } from '../../data/seed'
import * as backupModule from '../../data/backup'

describe('MoreScreen', () => {
  beforeEach(async () => {
    await clearAllData()
    await resetDemoData()
  })

  it('renders more screen with organization info and backup/restore sections', async () => {
    render(
      <MemoryRouter initialEntries={['/more']}>
        <Routes>
          <Route path="/more" element={<MoreScreen />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Vườn Hồng Anh')).toBeInTheDocument()
      expect(screen.getByText('Sao lưu dữ liệu')).toBeInTheDocument()
      expect(screen.getByText('Khôi phục dữ liệu')).toBeInTheDocument()
      expect(screen.getByText(/File sao lưu có thể chứa tên và số điện thoại/)).toBeInTheDocument()
    })
  })

  it('handles backup export download', async () => {
    const downloadSpy = vi.spyOn(backupModule, 'downloadBackupFile').mockImplementation(() => {})

    render(
      <MemoryRouter initialEntries={['/more']}>
        <Routes>
          <Route path="/more" element={<MoreScreen />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Vườn Hồng Anh')).toBeInTheDocument()
    })

    const exportBtn = screen.getByRole('button', { name: /Tải tệp sao lưu JSON/i })
    fireEvent.click(exportBtn)

    await waitFor(() => {
      expect(downloadSpy).toHaveBeenCalled()
      expect(screen.getByText(/Đã tải tệp sao lưu về máy/)).toBeInTheDocument()
    })

    downloadSpy.mockRestore()
  })

  it('shows preview card when a valid backup file is chosen, and can cancel preview', async () => {
    const { jsonString } = await backupModule.exportWorkspaceBackup()

    const { container } = render(
      <MemoryRouter initialEntries={['/more']}>
        <Routes>
          <Route path="/more" element={<MoreScreen />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Khôi phục dữ liệu')).toBeInTheDocument()
    })

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    expect(fileInput).toBeInTheDocument()

    const testFile = new File([jsonString], 'vuon-uom-test.json', { type: 'application/json' })
    fireEvent.change(fileInput, { target: { files: [testFile] } })

    await waitFor(() => {
      expect(screen.getByText('Xem trước bản sao lưu')).toBeInTheDocument()
      expect(screen.getByText('vuon-uom-test.json')).toBeInTheDocument()
      expect(screen.getByText('Cảnh báo:')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Khôi phục dữ liệu/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Hủy bỏ/i })).toBeInTheDocument()
    })

    // Click cancel
    const cancelBtn = screen.getByRole('button', { name: /Hủy bỏ/i })
    fireEvent.click(cancelBtn)

    await waitFor(() => {
      expect(screen.queryByText('Xem trước bản sao lưu')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Chọn tệp sao lưu JSON/i })).toBeInTheDocument()
    })
  })

  it('shows error when invalid JSON file is selected', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/more']}>
        <Routes>
          <Route path="/more" element={<MoreScreen />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Khôi phục dữ liệu')).toBeInTheDocument()
    })

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    const invalidFile = new File(['not valid json {{{'], 'bad.json', { type: 'application/json' })

    fireEvent.change(fileInput, { target: { files: [invalidFile] } })

    await waitFor(() => {
      expect(screen.getByText(/Không thể đọc tệp sao lưu:/)).toBeInTheDocument()
      expect(screen.getByText(/File sao lưu không đúng định dạng JSON/)).toBeInTheDocument()
    })
  })

  it('executes atomic restore when confirmed in preview card', async () => {
    const { jsonString } = await backupModule.exportWorkspaceBackup()

    const { container } = render(
      <MemoryRouter initialEntries={['/more']}>
        <Routes>
          <Route path="/more" element={<MoreScreen />} />
        </Routes>
      </MemoryRouter>
    )

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    const testFile = new File([jsonString], 'vuon-uom-restore.json', { type: 'application/json' })
    fireEvent.change(fileInput, { target: { files: [testFile] } })

    await waitFor(() => {
      expect(screen.getByText('Xem trước bản sao lưu')).toBeInTheDocument()
    })

    const restoreConfirmBtn = screen.getByRole('button', { name: /Khôi phục dữ liệu/i })
    fireEvent.click(restoreConfirmBtn)

    await waitFor(() => {
      expect(screen.getByText(/Đã khôi phục dữ liệu thành công!/)).toBeInTheDocument()
    })
  })
})
