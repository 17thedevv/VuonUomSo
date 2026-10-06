import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AppShell } from '../AppShell'
import { DesktopNav } from '../DesktopNav'
import { BottomNav } from '../BottomNav'
import { NAV_ITEMS } from '../../navigation'

describe('Responsive Navigation & AppShell', () => {
  it('NAV_ITEMS contains canonical navigation items', () => {
    expect(NAV_ITEMS).toHaveLength(4)
    expect(NAV_ITEMS.map((item) => item.label)).toEqual([
      'Hôm nay',
      'Lô cây',
      'Đơn hàng',
      'Thêm'
    ])
    expect(NAV_ITEMS.map((item) => item.to)).toEqual([
      '/today',
      '/batches',
      '/orders',
      '/more'
    ])
  })

  it('DesktopNav renders all 4 canonical items with brand header and source link', () => {
    render(
      <MemoryRouter initialEntries={['/batches']}>
        <DesktopNav />
      </MemoryRouter>
    )

    // Brand header
    expect(screen.getByText('VƯỜN ƯƠM')).toBeInTheDocument()
    expect(screen.getByText('Sổ cây giống')).toBeInTheDocument()

    // Nav items
    for (const item of NAV_ITEMS) {
      const link = screen.getByRole('link', { name: new RegExp(item.label, 'i') })
      expect(link).toBeInTheDocument()
      expect(link).toHaveAttribute('href', item.to)
    }

    // Active item on /batches
    const activeLink = screen.getByRole('link', { name: /Lô cây/i })
    expect(activeLink.className).toContain('bg-emerald-50')
    expect(activeLink.className).toContain('text-emerald-800')

    // Open source link
    expect(screen.getByText(/AGPL-3.0/)).toBeInTheDocument()
    expect(screen.getByText(/Mã nguồn dự án/)).toBeInTheDocument()
  })

  it('BottomNav renders all 4 canonical items with proper accessibility', () => {
    render(
      <MemoryRouter initialEntries={['/today']}>
        <BottomNav />
      </MemoryRouter>
    )

    const nav = screen.getByRole('navigation', { name: 'Điều hướng chính' })
    expect(nav).toBeInTheDocument()
    expect(nav.className).toContain('lg:hidden')

    for (const item of NAV_ITEMS) {
      const link = screen.getByRole('link', { name: new RegExp(item.label, 'i') })
      expect(link).toBeInTheDocument()
      expect(link).toHaveAttribute('href', item.to)
    }

    // Active item on /today
    const activeLink = screen.getByRole('link', { name: /Hôm nay/i })
    expect(activeLink.className).toContain('text-emerald-700')
  })

  it('AppShell renders sidebar on desktop, bottom nav on mobile, and main content', () => {
    render(
      <MemoryRouter initialEntries={['/today']}>
        <AppShell>
          <div data-testid="page-content">Trang chủ vườn ươm</div>
        </AppShell>
      </MemoryRouter>
    )

    // Main content rendered
    expect(screen.getByTestId('page-content')).toBeInTheDocument()
    expect(screen.getByRole('main')).toBeInTheDocument()

    // Both desktop and mobile navigations are present in DOM for responsive CSS media queries
    expect(screen.getByRole('complementary', { name: 'Thanh điều hướng bên' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Điều hướng chính' })).toBeInTheDocument()
  })

  it('AppShell respects hideBottomNav by hiding both desktop and mobile navigation', () => {
    render(
      <MemoryRouter initialEntries={['/onboarding']}>
        <AppShell hideBottomNav>
          <div data-testid="onboarding-content">Mở sổ vườn</div>
        </AppShell>
      </MemoryRouter>
    )

    expect(screen.getByTestId('onboarding-content')).toBeInTheDocument()
    expect(screen.queryByRole('complementary', { name: 'Thanh điều hướng bên' })).not.toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Điều hướng chính' })).not.toBeInTheDocument()
  })

  it('AppShell respects hideMobileNavOnly by hiding only mobile bottom nav while keeping desktop sidebar', () => {
    render(
      <MemoryRouter initialEntries={['/orders/new']}>
        <AppShell hideMobileNavOnly>
          <div data-testid="form-content">Tạo đơn mới</div>
        </AppShell>
      </MemoryRouter>
    )

    expect(screen.getByTestId('form-content')).toBeInTheDocument()
    // Desktop sidebar is preserved
    expect(screen.getByRole('complementary', { name: 'Thanh điều hướng bên' })).toBeInTheDocument()
    // Mobile bottom navigation is hidden
    expect(screen.queryByRole('navigation', { name: 'Điều hướng chính' })).not.toBeInTheDocument()
  })
})
