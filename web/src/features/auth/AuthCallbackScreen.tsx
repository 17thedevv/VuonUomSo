import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CheckCircle2, AlertCircle, Loader2, ArrowRight } from 'lucide-react'
import { getSupabaseClient } from '../../lib/supabase/client'

type CallbackState = 'processing' | 'success' | 'error'

export const AuthCallbackScreen: React.FC = () => {
  const navigate = useNavigate()
  const [state, setState] = useState<CallbackState>('processing')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    const processAuthCallback = async () => {
      try {
        const supabase = getSupabaseClient()
        // Check if there is an error in URL hash or query params
        const hash = window.location.hash
        const params = new URLSearchParams(window.location.search)

        if (params.get('error') || hash.includes('error=')) {
          const desc =
            params.get('error_description') ||
            new URLSearchParams(hash.replace(/^#/, '')).get('error_description') ||
            'Liên kết không hợp lệ hoặc đã hết hạn.'
          throw new Error(desc)
        }

        // Wait for Supabase client to process tokens in URL and establish session
        const { data, error } = await supabase.auth.getSession()

        if (error) {
          throw error
        }

        if (data.session) {
          if (isMounted) {
            setState('success')
            // Redirect after brief confirmation feedback
            setTimeout(() => {
              if (isMounted) {
                navigate('/', { replace: true })
              }
            }, 1200)
          }
        } else {
          // If no session found in URL and no active session
          if (isMounted) {
            setState('error')
            setErrorMsg('Liên kết không hợp lệ hoặc đã hết hạn.')
          }
        }
      } catch (err: unknown) {
        if (isMounted) {
          setState('error')
          const raw = err instanceof Error ? err.message : String(err)
          setErrorMsg(raw || 'Liên kết không hợp lệ hoặc đã hết hạn.')
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
