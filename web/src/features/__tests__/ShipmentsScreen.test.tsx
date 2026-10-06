import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ShipmentsScreen } from '../shipments/ShipmentsScreen'
import { resetDemoData, clearAllData } from '../../data/seed'
import { shipmentRepository } from '../../data/repositories'
import type { Shipment } from '../../domain/shipment'

describe('ShipmentsScreen', () => {
  beforeEach(async () => {
    await clearAllData()
    await resetDemoData()
  })

  it('renders shipments list from seed data with completed shipment', async () => {
    render(
      <MemoryRouter initialEntries={['/shipments']}>
        <ShipmentsScreen />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Anh Nam')).toBeInTheDocument()
      expect(screen.getByText('Keo lai AH1')).toBeInTheDocument()
    })

    // Quantity display
    expect(screen.getByText('20.000 cây')).toBeInTheDocument()
    // Status badge
    expect(screen.getByText('Đã giao xong')).toBeInTheDocument()
  })

  it('filters planned vs completed shipments via tabs', async () => {
    // Add a planned shipment for test
    const planned: Shipment = {
      id: 'ship_test_planned',
      orderId: 'order_hung_01',
      lines: [
        {
          reservationId: 'res_bv16_hung_own',
          sourceType: 'own_batch',
          batchId: 'batch_bv16_12',
          quantity: 10000
        }
      ],
      plannedQuantity: 10000,
      shippedQuantity: 0,
      plannedDate: '2026-10-15',
      status: 'planned',
      note: 'Xe 5 tấn chở cây',
      createdAt: '2026-10-06'
    }
    await shipmentRepository.save(planned)

    render(
      <MemoryRouter initialEntries={['/shipments']}>
        <ShipmentsScreen />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Anh Nam')).toBeInTheDocument()
      expect(screen.getByText('Anh Hùng')).toBeInTheDocument()
    })

    // Click tab "Chờ giao"
    const plannedTab = screen.getByRole('button', { name: 'Chờ giao' })
    fireEvent.click(plannedTab)

    await waitFor(() => {
      expect(screen.getByText('Anh Hùng')).toBeInTheDocument()
      expect(screen.queryByText('Anh Nam')).not.toBeInTheDocument()
    })

    // Click tab "Đã giao"
    const completedTab = screen.getByRole('button', { name: 'Đã giao' })
    fireEvent.click(completedTab)

    await waitFor(() => {
      expect(screen.getByText('Anh Nam')).toBeInTheDocument()
      expect(screen.queryByText('Anh Hùng')).not.toBeInTheDocument()
    })
  })
})
