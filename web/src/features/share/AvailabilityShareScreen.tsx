import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { getGardenAvailability, type GardenAvailabilityView } from '../../services/gardenQueryService'
import { organizationRepository } from '../../data/repositories/organization.repository'
import { formatQuantity } from '../../domain/quantity'
import { PageHeader } from '../../shared/components/PageHeader'
import { gardenReturnPath } from '../garden/gardenNavigation'
import { eligibleBatchIds, reconcileSelection, selectedAvailable, selectedShareGroups, toggleGroup, type ShareGroup } from './shareSelection'
import { formatShareText } from './shareFormatter'

type ShareSnapshot = Readonly<{ generatedAt: string; text: string }>
const button = 'min-h-12 px-4 py-3 rounded-xl font-semibold disabled:opacity-50'

function createSnapshot(organizationName: string, groups: ShareGroup[], includeBatchCodes: boolean): ShareSnapshot {
  const generatedAt = new Date().toISOString()
  return Object.freeze({ generatedAt, text: formatShareText({ organizationName, groups, includeBatchCodes, generatedAt }) })
}

export function AvailabilityShareScreen() {
  const location = useLocation()
  const backTo = gardenReturnPath(location.state?.gardenReturnTo) ?? '/garden'
  const [view, setView] = useState<GardenAvailabilityView | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [includeCodes, setIncludeCodes] = useState(false)
  const [snapshot, setSnapshot] = useState<ShareSnapshot | null>(null)
  const [busy, setBusy] = useState<'load' | 'generate' | null>('load')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [platformMessage, setPlatformMessage] = useState('')
  const [platformBusy, setPlatformBusy] = useState(false)
  const sequence = useRef(0)
  const initialized = useRef(false)
  const selectionRef = useRef(selected)
  const snapshotRef = useRef(snapshot)
  const platformSequence = useRef(0)
  const platformPending = useRef(false)
  const preview = useRef<HTMLTextAreaElement>(null)

  const replaceSnapshot = (value: ShareSnapshot | null) => {
    snapshotRef.current = value
    setSnapshot(value)
    ++platformSequence.current
    platformPending.current = false
    setPlatformBusy(false)
    setPlatformMessage('')
  }
  const changeSelection = (value: Set<string>) => {
    selectionRef.current = value
    setSelected(value)
    replaceSnapshot(null)
  }

  const load = useCallback(async () => {
    const ticket = ++sequence.current
    snapshotRef.current = null
    setSnapshot(null)
    ++platformSequence.current
    platformPending.current = false
    setPlatformBusy(false)
    setPlatformMessage('')
    setBusy('load')
    setError('')
    setNotice('')
    try {
      const next = await getGardenAvailability({ view: 'all' })
      if (ticket !== sequence.current) return
      const ids = initialized.current ? reconcileSelection(next, selectionRef.current) : eligibleBatchIds(next)
      if (initialized.current && ids.size !== selectionRef.current.size) setNotice('Dữ liệu đã thay đổi. Các lô không còn cây bán đã được bỏ khỏi lựa chọn; hãy kiểm tra rồi tạo bảng mới.')
      initialized.current = true
      selectionRef.current = ids
      setSelected(ids)
      setView(next)
    } catch {
      if (ticket === sequence.current) {
        setView(null)
        setError('Chưa đọc được dữ liệu vườn. Hãy đọc lại; dữ liệu trên thiết bị có thể cần kiểm tra.')
      }
    } finally {
      if (ticket === sequence.current) setBusy(null)
    }
  }, [])

  useEffect(() => {
    const requests = sequence
    const platformRequests = platformSequence
    void load()
    return () => { ++requests.current; ++platformRequests.current }
  }, [load])

  const generate = async () => {
    if (busy || error || !selected.size) return
    const ticket = ++sequence.current
    const ids = new Set(selected)
    const codes = includeCodes
    replaceSnapshot(null)
    setBusy('generate')
    setNotice('')
    try {
      const fresh = await getGardenAvailability({ view: 'all' })
      if (ticket !== sequence.current) return
      const groups = selectedShareGroups(fresh, ids)
      const org = await organizationRepository.getCurrent()
      if (ticket !== sequence.current) return
      if (!org) throw new Error('Chưa có tên vườn hợp lệ.')
      const nextSnapshot = createSnapshot(org.name, groups, codes)
      setView(fresh)
      replaceSnapshot(nextSnapshot)
    } catch (reason) {
      if (ticket === sequence.current) setError(reason instanceof Error && reason.message.startsWith('Dữ liệu đã thay đổi')
        ? reason.message : 'Chưa tạo được bảng hàng. Hãy kiểm tra tên vườn và dữ liệu cây, rồi đọc lại để thử lại.')
    } finally {
      if (ticket === sequence.current) setBusy(null)
    }
  }

  const copyOrShare = async (action: 'copy' | 'share') => {
    const frozen = snapshotRef.current
    if (!frozen || platformPending.current) return
    const ticket = ++platformSequence.current
    platformPending.current = true
    setPlatformBusy(true)
    setPlatformMessage('')
    try {
      if (action === 'copy') {
        if (typeof navigator.clipboard?.writeText !== 'function') throw new Error('clipboard unavailable')
        await navigator.clipboard.writeText(frozen.text)
      } else {
        if (typeof navigator.share !== 'function') throw new Error('share unavailable')
        await navigator.share({ text: frozen.text })
      }
      if (ticket === platformSequence.current && frozen === snapshotRef.current) setPlatformMessage(action === 'copy'
        ? 'Đã sao chép bảng hàng.' : 'Đã chuyển nội dung tới chức năng chia sẻ của thiết bị.')
    } catch (reason) {
      if (ticket === platformSequence.current && frozen === snapshotRef.current) setPlatformMessage(action === 'share' && typeof reason === 'object' && reason !== null && 'name' in reason && reason.name === 'AbortError'
        ? 'Đã hủy chia sẻ. Bạn vẫn có thể sao chép bảng hàng.'
        : action === 'copy' ? 'Chưa sao chép được. Chọn văn bản bên dưới rồi sao chép thủ công.' : 'Chưa mở được chức năng chia sẻ. Hãy sao chép bảng hàng hoặc chọn văn bản để sao chép thủ công.')
    } finally {
      if (ticket === platformSequence.current) {
        platformPending.current = false
        setPlatformBusy(false)
      }
    }
  }

  let shareSupported = typeof navigator.share === 'function'
  if (shareSupported && snapshot && typeof navigator.canShare === 'function') {
    try { shareSupported = navigator.canShare({ text: snapshot.text }) } catch { shareSupported = false }
  }
  const locked = !!busy || !!error
  return (
    <div className="flex-1 flex flex-col bg-slate-50 text-base min-w-0">
      <PageHeader title="Bảng hàng" showBack backTo={backTo} rightAction={
        <button type="button" onClick={() => { void load() }} className="min-h-11 px-3 rounded-xl bg-emerald-50 text-emerald-800 font-semibold">Đọc lại</button>
      } />
      <div className="p-4 sm:p-6 w-full max-w-3xl mx-auto space-y-5 min-w-0">
        <p className="text-slate-600">Bảng từ dữ liệu đang lưu trên thiết bị. Bạn tự gửi cho khách; số lượng có thể thay đổi.</p>
        {busy && <p role="status">{busy === 'generate' ? 'Đang tạo bảng hàng từ dữ liệu mới...' : 'Đang đọc dữ liệu vườn...'}</p>}
        {error && <div role="alert" className="bg-amber-50 text-amber-900 border border-amber-200 p-4 rounded-xl space-y-3">
          <p>{error}</p><button type="button" onClick={() => { void load() }} className={`${button} bg-emerald-700 text-white`}>Thử lại</button>
        </div>}
        {notice && <p role="status" className="bg-amber-50 text-amber-900 p-4 rounded-xl">{notice}</p>}
        {snapshot ? (
          <section aria-label="Xem trước bảng hàng" className="space-y-4">
            <h2 className="text-xl font-bold">Xem trước</h2>
            <p>Bảng đã tạo giữ nguyên nội dung này. Để lấy số mới, hãy đọc lại và tạo bảng mới.</p>
            <textarea ref={preview} aria-label="Nội dung bảng hàng" readOnly value={snapshot.text} rows={16}
              className="w-full min-w-0 min-h-64 p-4 rounded-xl border border-slate-300 bg-white text-base resize-y whitespace-pre-wrap break-words" />
            <div className="flex flex-col sm:flex-row gap-3">
              <button type="button" disabled={platformBusy} onClick={() => { void copyOrShare('copy') }} className={`${button} bg-emerald-700 text-white flex-1`}>Sao chép bảng hàng</button>
              {shareSupported && <button type="button" disabled={platformBusy} onClick={() => { void copyOrShare('share') }} className={`${button} border border-emerald-700 text-emerald-800 flex-1`}>Chia sẻ qua thiết bị</button>}
            </div>
            {platformMessage && <p role="status" className="text-emerald-900">{platformMessage}</p>}
            <p className="text-slate-600">Nếu không sao chép được, chọn văn bản rồi dùng chức năng sao chép của thiết bị.</p>
            <button type="button" onClick={() => { preview.current?.focus(); preview.current?.select() }} className={`${button} bg-white border border-slate-300`}>Chọn văn bản</button>
            <button type="button" onClick={() => { void load() }} className={`${button} block w-full bg-slate-100 text-slate-800`}>Chọn lại / Tạo bảng mới</button>
          </section>
        ) : view && !busy && (
          <>
            <h2 className="text-xl font-bold">Chọn cây muốn chia sẻ</h2>
            {!eligibleBatchIds(view).size ? <p className="bg-white border border-slate-200 p-5 rounded-xl">{view.groups.length ? 'Chưa có cây còn bán để tạo bảng hàng.' : 'Chưa có lô cây nào để chia sẻ.'}</p> : (
              <div className="space-y-4">
                {view.groups.map(group => {
                  const eligible = group.batches.filter(batch => batch.available > 0)
                  const count = eligible.filter(batch => selected.has(batch.id)).length
                  const partial = count > 0 && count < eligible.length
                  return <fieldset key={group.key} disabled={locked} className="bg-white border border-slate-200 rounded-2xl p-4 min-w-0">
                    <legend className="sr-only">Giống {group.label}</legend>
                    <label className="flex items-start gap-3 min-h-11 py-2 cursor-pointer">
                      <input type="checkbox" aria-label={`Chọn giống ${group.label}`} checked={eligible.length > 0 && count === eligible.length} disabled={locked || !eligible.length}
                        ref={node => { if (node) node.indeterminate = partial }} onChange={() => changeSelection(toggleGroup(group, selected))} className="w-5 h-5 mt-1 shrink-0 accent-emerald-700" />
                      <span className="min-w-0 break-words"><strong className="text-lg">{group.label}</strong><span className="block">Đã chọn: {formatQuantity(selectedAvailable(group, selected))} cây{partial ? ' · Chọn một phần' : ''}</span></span>
                    </label>
                    <div className="space-y-1 mt-2">
                      {group.batches.map(batch => <label key={batch.id} className="flex items-start gap-3 min-h-11 py-2 pl-3 cursor-pointer">
                        <input type="checkbox" aria-label={`Chọn lô ${batch.code}`} checked={selected.has(batch.id)} disabled={locked || batch.available <= 0}
                          onChange={() => { const next = new Set(selected); if (next.has(batch.id)) next.delete(batch.id); else next.add(batch.id); changeSelection(next) }} className="w-5 h-5 mt-1 shrink-0 accent-emerald-700" />
                        <span className="min-w-0 break-all"><strong>{batch.code}</strong><span className="block">{batch.available > 0 ? `${formatQuantity(batch.available)} cây còn bán` : 'Chưa có cây còn bán'}</span></span>
                      </label>)}
                    </div>
                  </fieldset>
                })}
              </div>
            )}
            <label className="flex items-center gap-3 min-h-11 py-2"><input type="checkbox" checked={includeCodes} disabled={locked} onChange={event => { setIncludeCodes(event.target.checked); replaceSnapshot(null) }} className="w-5 h-5 accent-emerald-700" />Kèm mã lô</label>
            <button type="button" disabled={locked || !selected.size} onClick={() => { void generate() }} className={`${button} w-full bg-emerald-700 text-white`}>Tạo bảng hàng</button>
          </>
        )}
      </div>
    </div>
  )
}
