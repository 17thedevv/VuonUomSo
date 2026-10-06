import type { ValidationRoute } from './validation.types'

/**
 * Maps browser pathnames to canonical validation screen names.
 * Strips away all dynamic entity IDs, query parameters, and hash fragments to prevent ID leakage.
 */
export function canonicalizeRoute(pathname: string): ValidationRoute | null {
  if (!pathname) return null
  const clean = pathname.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/'

  if (clean === '/' || clean === '/today') return 'today'
  if (clean === '/onboarding') return 'onboarding'
  if (clean === '/batches') return 'batches'
  if (clean === '/batches/new') return 'batch_new'
  if (/^\/dossiers\/[^/]+$/.test(clean) || /^\/batches\/[^/]+\/dossier$/.test(clean)) return 'dossier'
  if (/^\/batches\/[^/]+$/.test(clean)) return 'batch_detail'

  if (clean === '/orders') return 'orders'
  if (clean === '/orders/new') return 'order_new'
  if (/^\/orders\/[^/]+\/reserve$/.test(clean)) return 'order_reserve'
  if (/^\/orders\/[^/]+$/.test(clean)) return 'order_detail'

  if (clean === '/shipments') return 'shipments'
  if (clean === '/shipments/new') return 'shipment_new'
  if (/^\/shipments\/[^/]+$/.test(clean)) return 'shipment_detail'

  if (clean === '/more') return 'more'
  if (clean === '/pilot-tools') return 'pilot_tools'
  if (clean === '/validation') return 'validation_report'

  return null
}
