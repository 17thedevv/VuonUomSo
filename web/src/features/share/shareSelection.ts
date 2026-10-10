import type { GardenAvailabilityView, GardenVarietyGroup } from '../../services/gardenQueryService'

export interface ShareGroup {
  variety: string
  available: number
  batches: { code: string; available: number }[]
}

export function eligibleBatchIds(view: GardenAvailabilityView): Set<string> {
  return new Set(view.groups.flatMap(group => group.batches.filter(batch => batch.available > 0).map(batch => batch.id)))
}

export function reconcileSelection(view: GardenAvailabilityView, selected: ReadonlySet<string>): Set<string> {
  const eligible = eligibleBatchIds(view)
  return new Set([...selected].filter(id => eligible.has(id)))
}

export function toggleGroup(group: GardenVarietyGroup, selected: ReadonlySet<string>): Set<string> {
  const eligible = group.batches.filter(batch => batch.available > 0)
  const remove = eligible.every(batch => selected.has(batch.id))
  const next = new Set(selected)
  for (const batch of group.batches) {
    if (remove || batch.available <= 0) next.delete(batch.id)
    else next.add(batch.id)
  }
  return next
}

export function selectedAvailable(group: GardenVarietyGroup, selected: ReadonlySet<string>): number {
  return group.batches.filter(batch => selected.has(batch.id)).reduce((sum, batch) => sum + batch.available, 0)
}

/** Public projection of A1 facts; search metadata never determines selected totals. */
export function selectedShareGroups(view: GardenAvailabilityView, selected: ReadonlySet<string>): ShareGroup[] {
  if (!selected.size) throw new Error('Chọn ít nhất một lô còn cây bán để tạo bảng.')
  const eligible = eligibleBatchIds(view)
  if ([...selected].some(id => !eligible.has(id))) {
    throw new Error('Dữ liệu đã thay đổi: lô đã chọn không còn tồn tại hoặc không còn cây bán. Hãy đọc lại và chọn lại.')
  }
  const seen = new Set<string>()
  const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0
  return [...view.groups].sort((a, b) => compare(a.key, b.key)).flatMap(group => {
    const batches = [...group.batches].sort((a, b) => compare(a.id, b.id)).filter(batch => selected.has(batch.id))
    if (!batches.length) return []
    let available = 0
    for (const batch of batches) {
      if (seen.has(batch.id) || !Number.isSafeInteger(batch.available) || batch.available <= 0 || batch.available > Number.MAX_SAFE_INTEGER - available) {
        throw new Error('Chưa tạo được bảng: dữ liệu cây còn bán cần kiểm tra.')
      }
      seen.add(batch.id)
      available += batch.available
    }
    return [{ variety: group.label, available, batches: batches.map(batch => ({ code: batch.code, available: batch.available })) }]
  })
}
