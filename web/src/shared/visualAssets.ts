import mark from '../assets/visual/brand/mark.svg'
import inventory from '../assets/visual/onboarding/inventory.svg'
import catalog from '../assets/visual/illustrations/empty-catalog.svg'
import orders from '../assets/visual/illustrations/empty-orders.svg'
import noResults from '../assets/visual/illustrations/empty-no-results.svg'
import availability from '../assets/visual/illustrations/empty-availability.svg'

export const brandAssets = { mark, inventory } as const

export const emptyStateIllustrations = {
  catalog,
  orders,
  noResults,
  availability
} as const

export type EmptyStateIllustration = keyof typeof emptyStateIllustrations
