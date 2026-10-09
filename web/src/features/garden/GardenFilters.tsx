export function GardenFilters({ search, view, onSearch, onView }: {
  search: string
  view: 'available' | 'all'
  onSearch: (value: string) => void
  onView: (value: 'available' | 'all') => void
}) {
  return (
    <div className="space-y-3">
      <label htmlFor="garden-search" className="block font-semibold">Tìm giống cây hoặc mã lô</label>
      <div className="flex gap-2">
        <input id="garden-search" type="search" value={search} onChange={(e) => onSearch(e.target.value)}
          placeholder="Tìm giống cây hoặc mã lô..." className="w-full min-w-0 min-h-12 border border-slate-300 bg-white rounded-xl px-3 focus:outline-2 focus:outline-emerald-700" />
        {search && <button type="button" aria-label="Xóa tìm kiếm" onClick={() => onSearch('')} className="min-h-12 min-w-12 px-3 rounded-xl border border-slate-300 bg-white font-semibold">Xóa</button>}
      </div>
      <div role="group" aria-label="Bộ lọc vườn" className="flex flex-wrap gap-2">
        {([['available', 'Cây còn bán'], ['all', 'Tất cả']] as const).map(([key, label]) => (
          <button key={key} type="button" aria-pressed={view === key} onClick={() => onView(key)}
            className={`min-h-11 px-4 py-2 rounded-full font-semibold ${view === key ? 'bg-emerald-700 text-white' : 'bg-white border border-slate-300 text-slate-700'}`}>
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
