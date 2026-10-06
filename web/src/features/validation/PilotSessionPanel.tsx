import React, { useState, useEffect } from 'react'
import type { PilotSession } from '../../validation/validation.types'
import {
  startPilotSession,
  getActivePilotSession
} from '../../validation/validationSession'
import { PilotEndSurveyModal } from './PilotEndSurveyModal'
import { PrimaryButton } from '../../shared/components/PrimaryButton'
import { SecondaryButton } from '../../shared/components/SecondaryButton'
import { UserCheck, Play, Square, ShieldCheck, AlertCircle } from 'lucide-react'

export interface PilotSessionPanelProps {
  onSessionChange?: () => void
}

export const PilotSessionPanel: React.FC<PilotSessionPanelProps> = ({ onSessionChange }) => {
  const [activeSession, setActiveSession] = useState<PilotSession | null>(null)
  const [participantCode, setParticipantCode] = useState('P01')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showSurveyModal, setShowSurveyModal] = useState(false)
  const [isStarting, setIsStarting] = useState(false)

  const refreshActiveSession = async () => {
    try {
      const current = await getActivePilotSession()
      setActiveSession(current || null)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refreshActiveSession()
  }, [])

  const handleStart = async () => {
    if (isStarting) return
    setIsStarting(true)
    setError(null)

    try {
      const session = await startPilotSession(participantCode, 'accepted')
      setActiveSession(session)
      onSessionChange?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể bắt đầu buổi thử.')
    } finally {
      setIsStarting(false)
    }
  }

  const handleSurveyCompleted = () => {
    setActiveSession(null)
    onSessionChange?.()
    refreshActiveSession()
  }

  if (loading) {
    return (
      <div className="p-4 text-xs text-slate-400 bg-white rounded-xl border border-slate-200">
        Đang kiểm tra trạng thái buổi thử...
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
          <UserCheck className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-900">Buổi thử nghiệm tại vườn (Pilot)</h3>
          <p className="text-xs text-slate-500">Ghi lại thao tác phục vụ đánh giá mức độ sử dụng</p>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {activeSession ? (
        <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
              Buổi thử đang hoạt động
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-200 text-emerald-900 animate-pulse">
              Đang ghi nhận
            </span>
          </div>

          <div className="text-sm font-bold text-slate-900">
            Người thử: <span className="text-emerald-700">{activeSession.participantCode}</span>
          </div>
          <div className="text-xs text-slate-600">
            Bắt đầu lúc: {new Date(activeSession.startedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
          </div>

          <div className="pt-2">
            <SecondaryButton fullWidth onClick={() => setShowSurveyModal(true)}>
              <Square className="w-4 h-4 text-rose-600 fill-rose-600 mr-1.5" />
              Kết thúc buổi thử
            </SecondaryButton>
          </div>

          {showSurveyModal && (
            <PilotEndSurveyModal
              session={activeSession}
              isOpen={showSurveyModal}
              onClose={() => setShowSurveyModal(false)}
              onSuccess={handleSurveyCompleted}
            />
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
            <div className="flex items-start gap-2 text-xs text-slate-600">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                Vườn Ươm sẽ ghi lại loại thao tác trên thiết bị này để đánh giá bản thử nghiệm.
                <span className="font-semibold block text-slate-800 mt-1">
                  Không ghi tên/số điện thoại trong dữ liệu đo lường. Không gửi dữ liệu lên mạng.
                </span>
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="participant-code" className="block text-xs font-bold text-slate-800">
              Mã người thử (ví dụ: P01, P02, P03)
            </label>
            <input
              id="participant-code"
              type="text"
              value={participantCode}
              onChange={(e) => setParticipantCode(e.target.value.toUpperCase())}
              placeholder="P01"
              maxLength={20}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <div className="flex gap-2">
            <SecondaryButton
              onClick={() => {
                setParticipantCode('')
                setError(null)
              }}
              disabled={isStarting}
            >
              Không ghi
            </SecondaryButton>
            <PrimaryButton fullWidth onClick={handleStart} disabled={isStarting}>
              <Play className="w-4 h-4 fill-white mr-1.5" />
              {isStarting ? 'Đang mở...' : 'Bắt đầu buổi thử'}
            </PrimaryButton>
          </div>
        </div>
      )}
    </div>
  )
}
