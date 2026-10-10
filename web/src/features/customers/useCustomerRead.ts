import { useCallback, useEffect, useRef, useState } from 'react'
import { undoService } from '../../services/undoService'

/** One current snapshot per screen; a failed refresh removes the old numbers. */
export function useCustomerRead<T>(read: () => Promise<T>) {
  const [state, setState] = useState<{ status: 'loading' } | { status: 'error' } | { status: 'ready'; data: T }>({ status: 'loading' })
  const sequence = useRef(0)
  const reload = useCallback(async () => {
    const ticket = ++sequence.current
    setState({ status: 'loading' })
    try {
      const data = await read()
      if (ticket === sequence.current) setState({ status: 'ready', data })
    } catch {
      if (ticket === sequence.current) setState({ status: 'error' })
    }
  }, [read])
  useEffect(() => {
    const requests = sequence
    void reload()
    const unsubscribe = undoService.subscribe(() => { void reload() })
    const focus = () => { void reload() }
    const visibility = () => { if (document.visibilityState === 'visible') void reload() }
    window.addEventListener('focus', focus)
    document.addEventListener('visibilitychange', visibility)
    return () => {
      ++requests.current; unsubscribe()
      window.removeEventListener('focus', focus)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [reload])
  return { state, reload }
}
