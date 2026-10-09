/** Only owner-local Garden presentation context may override the legacy batch back path. */
export function gardenReturnPath(value: unknown): string | undefined {
  if (typeof value !== 'string' || !/^\/garden(?:\?|$)/.test(value)) return undefined
  const url = new URL(value, 'https://vuonuom.local')
  if (url.pathname !== '/garden' || url.origin !== 'https://vuonuom.local') return undefined
  const params = new URLSearchParams()
  const search = url.searchParams.get('q')
  const open = url.searchParams.get('open')
  if (search) params.set('q', search)
  params.set('view', url.searchParams.get('view') === 'all' ? 'all' : 'available')
  if (open) params.set('open', open)
  return `/garden?${params}`
}
