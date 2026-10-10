import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent, cleanup, act } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { MoreScreen } from '../more/MoreScreen'
import { resetDemoData, clearAllData } from '../../data/seed'
import * as backupModule from '../../data/backup'
import * as seedModule from '../../data/seed'
import { db } from '../../data/db'

describe('MoreScreen', () => {
  afterEach(() => { cleanup(); vi.restoreAllMocks() })
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

  const snapshot = () => db.transaction('r', db.tables, async () =>
    Object.fromEntries(await Promise.all(db.tables.map(async table => [table.name, await table.toArray()]))))
  const renderResetScreen = () => render(<MemoryRouter initialEntries={['/more']}><Routes>
    <Route path="/more" element={<MoreScreen />} />
    <Route path="/today" element={<div>TODAY TEST</div>} />
    <Route path="/onboarding" element={<div>ONBOARDING TEST</div>} />
  </Routes></MemoryRouter>)

  it('RST-17: cancelling either reset preserves every store and warns of replacement', async () => {
    const before = await snapshot()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const demo = vi.spyOn(seedModule, 'resetDemoData')
    const factory = vi.spyOn(seedModule, 'clearAllData')
    renderResetScreen()
    await screen.findByText('Vườn Hồng Anh')
    fireEvent.click(screen.getByRole('button', { name: /Cài lại dữ liệu mẫu/ }))
    fireEvent.click(screen.getByRole('button', { name: /Xóa dữ liệu & Bắt đầu lại/ }))
    expect(confirm.mock.calls[0][0]).toContain('Dữ liệu hiện tại sẽ được thay thế')
    expect(demo).not.toHaveBeenCalled()
    expect(factory).not.toHaveBeenCalled()
    expect(await snapshot()).toEqual(before)
    expect(screen.queryByText('TODAY TEST')).not.toBeInTheDocument()
  })

  it('RST-17: native reset error keeps original records, shows alert and explicit retry succeeds', async () => {
    await db.organizations.put({ id: 'org_hong_anh', name: 'Original TEST ONLY', capabilities: ['produce'] })
    const before = await snapshot()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const injected: object[] = []
    const invalidClone = (_key: unknown, obj: object) => {
      injected.push(obj)
      Object.assign(obj, { nonCloneable: () => 'native clone failure' })
    }
    db.batches.hook('creating', invalidClone)
    renderResetScreen()
    await screen.findByText('Original TEST ONLY')
    try {
      fireEvent.click(screen.getByRole('button', { name: /Cài lại dữ liệu mẫu/ }))
      expect(await screen.findByRole('alert')).toHaveTextContent('Dữ liệu hiện tại được giữ nguyên')
    } finally {
      db.batches.hook('creating').unsubscribe(invalidClone)
      for (const obj of injected) delete (obj as Record<string, unknown>).nonCloneable
    }
    expect(await snapshot()).toEqual(before)
    expect(screen.queryByText(/thành công/)).not.toBeInTheDocument()
    expect(screen.queryByText('TODAY TEST')).not.toBeInTheDocument()
    expect(screen.getByText('Original TEST ONLY')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Cài lại dữ liệu mẫu/ }))
    expect(await screen.findByText('Đã khôi phục dữ liệu mẫu thành công.')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(await screen.findByText('TODAY TEST')).toBeInTheDocument()
  })

  it('RST-08/17: no success or navigation before reset resolves; double submit/cross-reset blocked', async () => {
    const before = await snapshot()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const actualReset = seedModule.resetDemoData
    let release!: () => Promise<void>
    const demo = vi.spyOn(seedModule, 'resetDemoData').mockImplementationOnce(() => new Promise<void>((resolve, reject) => {
      release = () => actualReset().then(resolve, reject)
    }))
    const factory = vi.spyOn(seedModule, 'clearAllData')
    renderResetScreen()
    await screen.findByText('Vườn Hồng Anh')
    const button = screen.getByRole('button', { name: /Cài lại dữ liệu mẫu/ })
    fireEvent.click(button)
    fireEvent.click(button)
    fireEvent.click(screen.getByRole('button', { name: /Xóa dữ liệu & Bắt đầu lại/ }))
    expect(demo).toHaveBeenCalledTimes(1)
    expect(factory).not.toHaveBeenCalled()
    expect(button).toBeDisabled()
    expect(screen.queryByText(/thành công/)).not.toBeInTheDocument()
    expect(screen.queryByText('TODAY TEST')).not.toBeInTheDocument()
    expect(await snapshot()).toEqual(before)
    await act(async () => { await release() })
    expect(await screen.findByText('Đã khôi phục dữ liệu mẫu thành công.')).toBeInTheDocument()
    expect(button).toBeDisabled()
    expect(await screen.findByText('TODAY TEST')).toBeInTheDocument()
  })

  it('RST-17: failed factory reset stays on More and preserves the workspace', async () => {
    const before = await snapshot()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(db.validationEvents, 'clear').mockRejectedValueOnce(new Error('late telemetry clear failure'))
    renderResetScreen()
    await screen.findByText('Vườn Hồng Anh')
    fireEvent.click(screen.getByRole('button', { name: /Xóa dữ liệu & Bắt đầu lại/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Không thể xóa dữ liệu')
    expect(screen.queryByText('ONBOARDING TEST')).not.toBeInTheDocument()
    expect(await snapshot()).toEqual(before)
    expect(screen.getByRole('button', { name: /Xóa dữ liệu & Bắt đầu lại/ })).toBeEnabled()
  })
})
