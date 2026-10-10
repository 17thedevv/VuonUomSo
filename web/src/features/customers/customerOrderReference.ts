/** Derived labels only. Prefix collisions expand; original IDs remain the link authority. */
export function customerOrderReferences(ids: readonly string[]): Map<string, string> {
  if (new Set(ids).size !== ids.length) throw new Error('Đơn hàng có ID trùng.')
  return new Map(ids.map(id => {
    let length = Math.min(6, id.length)
    while (length < id.length && ids.some(other => other !== id && other.slice(0, length) === id.slice(0, length))) ++length
    return [id, `Đơn · ${id.slice(0, length)}`]
  }))
}
