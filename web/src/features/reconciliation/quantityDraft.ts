export type QuantityDraft = { raw: string; value: number | null; unit: 'cay' | 'van' }
export const quantityDraft = (value: number): QuantityDraft => ({ raw: String(value), value, unit: 'cay' })
