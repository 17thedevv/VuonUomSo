import { useEffect, useId, useRef, type ReactNode } from 'react'

export function OrderActionDialog({ title, children, footer, busy, onClose }: {
  title: string; children: ReactNode; footer: ReactNode; busy: boolean; onClose: () => void
}) {
  const titleId = useId()
  const container = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  const pending = useRef(busy)
  useEffect(() => { close.current = onClose; pending.current = busy }, [onClose, busy])
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    container.current?.querySelector<HTMLElement>('input, textarea, button')?.focus()
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !pending.current) { event.preventDefault(); close.current(); return }
      if (event.key !== 'Tab') return
      const elements = Array.from(container.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]'
      ) ?? [])
      const first = elements[0]
      const last = elements[elements.length - 1]
      if (!first) { event.preventDefault(); return }
      if (!container.current?.contains(document.activeElement)) { event.preventDefault(); first.focus(); return }
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = overflow
      previous?.focus()
    }
  }, [])
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-2 sm:p-4">
      <div ref={container} role="dialog" aria-modal="true" aria-labelledby={titleId}
        className="bg-white w-full max-w-lg max-h-[92dvh] rounded-2xl shadow-xl flex flex-col text-base">
        <div className="flex items-center justify-between gap-2 p-4 border-b border-slate-200 shrink-0">
          <h2 id={titleId} className="font-bold text-lg text-slate-900">{title}</h2>
          <button type="button" onClick={onClose} disabled={busy} className="min-h-11 px-3 rounded-xl border border-slate-300 font-semibold">Đóng</button>
        </div>
        <div className="overflow-y-auto p-4 space-y-4 min-h-0">{children}</div>
        <div className="p-4 border-t border-slate-200 bg-white rounded-b-2xl shrink-0">{footer}</div>
      </div>
    </div>
  )
}
