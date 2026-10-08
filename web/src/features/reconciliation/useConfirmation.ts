import { useRef, useState } from 'react'

type Failure = { success: false; code: string; error: string; conflict?: {
  shipmentIds?: string[]; plannedQuantity?: number; newOutstanding?: number
} }
/** One visible preview owns one retry identity; form edits invalidate it synchronously. */
export function useConfirmation<P, R>(preview: (plan: P) => Promise<{ success: true; projection: R; fingerprint: string } | Failure>,
  commit: (input: P & { operationId: string; expectedFingerprint: string }) => Promise<{ success: true; projection: R } | Failure>,
  refresh: () => Promise<void>, success: (projection: R) => Promise<void>) {
  const [snapshot, setSnapshot] = useState<{ plan: P; projection: R; fingerprint: string; operationId: string } | null>(null)
  const [error, setError] = useState<Failure | null>(null)
  const [busy, setBusy] = useState(false)
  const pending = useRef(false)
  const generation = useRef(0)
  const invalidate = () => { generation.current++; setSnapshot(null); setError(null) }
  const loadPreview = async (plan: P) => {
    const version = generation.current
    const result = await preview(plan)
    if (generation.current !== version) return false
    if (result.success) setSnapshot({ plan, projection: result.projection, fingerprint: result.fingerprint, operationId: crypto.randomUUID() })
    else { setSnapshot(null); setError(result) }
    return result.success
  }
  const showPreview = async (plan: P) => {
    if (pending.current) return
    pending.current = true; setBusy(true); setError(null); setSnapshot(null)
    try { await refresh(); await loadPreview(plan) }
    catch { setError({ success: false, code: 'STORAGE_ERROR', error: 'Chưa tải được số mới. Hãy thử xem trước lại.' }) }
    finally { pending.current = false; setBusy(false) }
  }
  const confirm = async () => {
    if (pending.current || !snapshot) return
    pending.current = true; setBusy(true); setError(null)
    try {
      const result = await commit({ ...snapshot.plan, operationId: snapshot.operationId, expectedFingerprint: snapshot.fingerprint })
      if (result.success) { setSnapshot(null); await success(result.projection) }
      else {
        setError(result)
        if (result.code !== 'STORAGE_ERROR') {
          setSnapshot(null); await refresh()
          if (result.code === 'PREVIEW_CHANGED') {
            if (await loadPreview(snapshot.plan)) setError(result) // Fresh projection requires a separate confirmation; keep any new allocation conflict.
          }
        }
      }
    } catch { setError({ success: false, code: 'STORAGE_ERROR', error: 'Chưa nhận được kết quả. Hãy thử lại cùng thao tác.' }) }
    finally { pending.current = false; setBusy(false) }
  }
  return { snapshot, error, busy, invalidate, showPreview, confirm }
}
