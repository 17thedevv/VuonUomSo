import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { db } from '../../../data/db'
import { clearAllData } from '../../../data/seed'
import { customerFixture } from './customerFixtures'

afterEach(() => cleanup())
it('B201/B202 real router guards customer routes, permits owner list/detail and remount reads current facts', async () => {
  await clearAllData()
  window.history.replaceState({ idx: 0 }, '', '/customers/customer-a')
  const { AppRouter } = await import('../../../app/router')
  render(<AppRouter />)
  await waitFor(() => expect(window.location.pathname).toBe('/onboarding'))
  expect(screen.queryByRole('region', { name: 'Thông tin khách' })).not.toBeInTheDocument()
  cleanup()
  await customerFixture()
  await db.organizations.put({ id: 'org', name: 'Vườn route', capabilities: ['sell'] })
  await db.settings.put({ key: 'onboarding_completed', value: 'true' })
  for (const [idx, path] of [[1, '/customers'], [2, '/customers/customer-a']] as const) {
    window.history.pushState({ idx }, '', path)
    window.dispatchEvent(new PopStateEvent('popstate', { state: { idx } }))
    render(<AppRouter />)
    await screen.findByRole('region', { name: idx === 1 ? 'Danh sách khách' : 'Thông tin khách' })
    expect(within(screen.getByRole('navigation', { name: 'Điều hướng chính' })).getAllByRole('link')).toHaveLength(4)
    cleanup()
  }
  await db.contacts.update('customer-a', { name: 'Khách sau reload' })
  render(<AppRouter />)
  await screen.findByRole('heading', { name: 'Khách sau reload' })
})
