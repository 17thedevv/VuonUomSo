import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CheckCircle2, AlertCircle, Loader2, ArrowRight } from 'lucide-react'
import { getSupabaseClient } from '../../lib/supabase/client'

type CallbackState = 'processing' | 'success' | 'error'

function sanitizeCallbackError(err: unknown, isRecovery: boolean): string {
  if (isRecovery) {
    return 'Không thể khôi phục mật khẩu. Hãy yêu cầu liên kết mới.'
  }
  const str = err instanceof Error ? err.message.toLowerCase() : String(err || '').toLowerCase()
  if (
    str.includes('expired') ||
    str.includes('invalid') ||
    str.includes('otp') ||
    str.includes('token') ||
    str.includes('pkce')
  ) {
    return 'Liên kết không hợp lệ hoặc đã hết hạn.'
  }
  return 'Không thể xác nhận tài khoản. Vui lòng thử lại.'
}

export const AuthCallbackScreen: React.FC = () => {
  const navigate = useNavigate()
  const [state, setState] = useState<CallbackState>('processing')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    const processAuthCallback = async () => {
      const hash = typeof window !== 'undefined' ? window.location.hash : ''
      const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams()
      const isRecovery = hash.includes('type=recovery') || params.get('type') === 'recovery'

      try {
        const supabase = getSupabaseClient()

        // Check for error in query params or URL hash
        if (params.get('error') || hash.includes('error=')) {
          const rawDesc =
            params.get('error_description') ||
            new URLSearchParams(hash.replace(/^#/, '')).get('error_description') ||
            'invalid'
          throw new Error(rawDesc)
        }

        // Wait for Supabase client to process tokens in URL and establish session
        const { data, error } = await supabase.auth.getSession()

        if (error) {
          throw error
        }

        if (data.session) {
          if (isMounted) {
            setState('success')
            setTimeout(() => {
              if (isMounted) {
                // Distinguish recovery from normal email confirmation
                if (isRecovery) {
                  navigate('/reset-password', { replace: true })
                } else {
                  navigate('/', { replace: true })
                }
              }
            }, 800)
          }
        } else {
          if (isMounted) {
            setState('error')
            setErrorMsg(
              isRecovery
                ? 'Không thể khôi phục mật khẩu. Hãy yêu cầu liên kết mới.'
                : 'Liên kết không hợp lệ hoặc đã hết hạn.'
            )
          }
        }
      } catch (err: unknown) {
        if (isMounted) {
          setState('error')
          setErrorMsg(sanitizeCallbackError(err, isRecovery))
        }
      }
    }

    processAuthCallback()

    return () => {
      isMounted = false
    }
  }, [navigate])

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center px-4 py-8 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-5 shadow-sm rounded-2xl border border-slate-100 sm:px-10 text-center">
          {state === 'processing' && (
            <div className="space-y-4">
              <div className="w-12 h-12 bg-emerald-50 text-emerald-700 rounded-full flex items-center justify-center mx-auto">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
              <h2 className="text-base font-bold text-slate-800">Đang xác nhận...</h2>
              <p className="text-xs text-slate-500">Vui lòng đợi trong giây lát.</p>
            </div>
          )}

          {state === 'success' && (
            <div className="space-y-4">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h2 className="text-base font-bold text-slate-900">Xác nhận thành công</h2>
              <p className="text-xs text-slate-500">Đang tự động chuyển hướng...</p>
            </div>
          )}

          {state === 'error' && (
            <div className="space-y-4">
              <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h2 className="text-base font-bold text-slate-900">Không thể xác nhận</h2>
              <p className="text-xs text-slate-600">
                {errorMsg || 'Liên kết không hợp lệ hoặc đã hết hạn.'}
              </p>
              <div className="pt-2">
                <Link
                  to="/login"
                  className="w-full min-h-[48px] px-4 py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
                >
                  <span>Quay về trang Đăng nhập</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
