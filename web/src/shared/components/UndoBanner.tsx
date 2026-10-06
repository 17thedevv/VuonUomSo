import React, { useState, useEffect } from 'react'
import { undoService, type ReversibleMutation } from '../../services/undoService'
import { RotateCcw, X, Check } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'

export const UndoBanner: React.FC = () => {
  const [mutation, setMutation] = useState<ReversibleMutation | null>(undoService.getLastMutation())
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [isUndoing, setIsUndoing] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    const unsubscribe = undoService.subscribe(() => {
      setMutation(undoService.getLastMutation())
    })
    return unsubscribe
  }, [])

  if (!mutation && !statusMessage) {
    return null
  }

  const handleUndo = async () => {
    if (isUndoing || !mutation) return
    setIsUndoing(true)
    const currentMutation = mutation
    const result = await undoService.undoLastMutation()
    setIsUndoing(false)

    if (result.success) {
      setStatusMessage(result.message)
      setTimeout(() => {
        setStatusMessage(null)
      }, 3500)

      // If user is currently looking at the deleted batch or order, navigate back to list
      if (currentMutation.type === 'create_batch' && location.pathname.includes(`/batches/${currentMutation.batchId}`)) {
        navigate('/batches', { replace: true })
      } else if (currentMutation.type === 'create_order' && location.pathname.includes(`/orders/${currentMutation.orderId}`)) {
        navigate('/orders', { replace: true })
      }
    } else {
      setStatusMessage(result.message)
      setTimeout(() => {
        setStatusMessage(null)
      }, 3000)
    }
  }

  const handleDismiss = () => {
    undoService.clearLastMutation()
    setStatusMessage(null)
  }

  return (
    <div
      role="region"
      aria-label="Thông báo hoàn tác"
      className="fixed bottom-20 left-4 right-4 z-40 max-w-[420px] mx-auto animate-in fade-in slide-in-from-bottom-3 duration-200"
    >
      <div className="bg-slate-900/95 backdrop-blur-xs text-white p-3.5 rounded-2xl shadow-xl border border-slate-700/80 flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <Check className="w-3.5 h-3.5 stroke-[3]" />
          </div>
          <span className="truncate font-medium text-slate-100">
            {statusMessage || mutation?.description}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!statusMessage && mutation && (
            <button
              type="button"
              onClick={handleUndo}
              disabled={isUndoing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold transition-all disabled:opacity-50 min-h-[36px]"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{isUndoing ? 'Đang hoàn tác...' : 'Hoàn tác'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Đóng thông báo"
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
