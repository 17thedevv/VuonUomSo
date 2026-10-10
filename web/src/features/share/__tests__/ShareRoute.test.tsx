import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { db } from '../../../data/db'
import { clearAllData } from '../../../data/seed'

afterEach(() => cleanup())

it('B101 real router guards /garden/share, then renders the owner screen inside the four-tab AppShell', async () => {
  await clearAllData()
  window.history.replaceState({ idx: 0 }, '', '/garden/share')
  const { AppRouter } = await import('../../../app/router')
  render(<AppRouter />)
  await waitFor(() => expect(window.location.pathname).toBe('/onboarding'))
  expect(screen.queryByRole('heading', { name: 'Bảng hàng' })).not.toBeInTheDocument()
  cleanup()
  await db.organizations.put({ id: 'route-org', name: 'Vườn route', capabilities: ['sell'] })
  await db.settings.put({ key: 'onboarding_completed', value: 'true' })
  window.history.pushState({ idx: 1 }, '', '/garden/share')
  window.dispatchEvent(new PopStateEvent('popstate', { state: { idx: 1 } }))
  render(<AppRouter />)
  await screen.findByRole('heading', { name: 'Bảng hàng' })
  await screen.findByText('Chưa có lô cây nào để chia sẻ.')
  expect(within(screen.getByRole('navigation', { name: 'Điều hướng chính' })).getAllByRole('link')).toHaveLength(4)
})
