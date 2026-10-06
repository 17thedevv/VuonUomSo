export interface SupplierCatalogEntry {
  supplierName: string
  phone?: string
  variety: string
  estimatedQuantity: number
}

/**
 * Deterministic default catalog for external suppliers in prototype.
 * Provides reference quantities for external suppliers when variety matches.
 */
export const DEFAULT_SUPPLIER_CATALOG: SupplierCatalogEntry[] = [
  {
    supplierName: 'Vườn Thảo',
    phone: '0977 123 456',
    variety: 'Keo lai BV16',
    estimatedQuantity: 35000
  },
  {
    supplierName: 'Vườn Hồng',
    phone: '0966 234 567',
    variety: 'Keo lai BV16',
    estimatedQuantity: 22000
  },
  {
    supplierName: 'Vườn An',
    phone: '0955 345 678',
    variety: 'Keo lai BV16',
    estimatedQuantity: 48000
  },
  {
    supplierName: 'Vườn Thảo',
    phone: '0977 123 456',
    variety: 'Keo lai AH1',
    estimatedQuantity: 25000
  },
  {
    supplierName: 'Vườn An',
    phone: '0955 345 678',
    variety: 'Keo lai BV523',
    estimatedQuantity: 30000
  }
]
