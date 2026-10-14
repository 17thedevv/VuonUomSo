import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertCircle, CheckCircle2, Lock, Loader2, ArrowRight } from 'lucide-react'
import { useAuth } from '../../auth/useAuth'
import { formatAuthError } from './authHelpers'

export const ResetPasswordScreen: React.FC = () => {
  const { updatePassword, session, isPasswordRecovery } = useAuth()
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isSuccess, setIsSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return

    if (!password || !confirmPassword) {
      setErrorMsg('Vui lòng nhập mật khẩu mới và xác nhận mật khẩu.')
      return
    }

    if (password.length < 6) {
      setErrorMsg('Mật khẩu mới phải có ít nhất 6 ký tự.')
      return
    }

    if (password !== confirmPassword) {
      setErrorMsg('Mật khẩu xác nhận không khớp.')
      return
    }

    setSubmitting(true)
    setErrorMsg(null)

    try {
      await updatePassword(password)
      setIsSuccess(true)
    } catch (err: unknown) {
      setErrorMsg(formatAuthError(err))
    } finally {
      setSubmitting(false)
    }
  }

  // If user navigates to reset-password without active recovery session
  if ((!session || !isPasswordRecovery) && !isSuccess) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-5 shadow-sm rounded-2xl border border-slate-100 sm:px-10 text-center">
            <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h2 className="text-base font-bold text-slate-900 mb-2">Liên kết không hợp lệ hoặc đã hết hạn</h2>
            <p className="text-xs text-slate-600 leading-relaxed mb-6">
              Phiên khôi phục mật khẩu không còn hiệu lực. Vui lòng yêu cầu một liên kết khôi phục mới.
            </p>
            <Link
              to="/forgot-password"
              className="w-full min-h-[48px] px-4 py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
            >
              <span>Yêu cầu liên kết mới</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-5 shadow-sm rounded-2xl border border-slate-100 sm:px-10 text-center">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <h2 className="text-xl font-bold text-slate-900 mb-2">Đặt lại mật khẩu thành công!</h2>
            <p className="text-xs text-slate-600 leading-relaxed mb-6">
              Mật khẩu mới của bạn đã được cập nhật. Bạn có thể tiếp tục sử dụng ứng dụng hoặc đăng nhập lại.
            </p>

            <button
              type="button"
              onClick={() => navigate('/login', { replace: true })}
              className="w-full min-h-[48px] px-4 py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2 shadow-sm"
            >
              <span>Về trang Đăng nhập</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center px-4 py-8 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Branding */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-700 text-white shadow-sm mb-3">
            <span className="text-2xl font-bold">🌱</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Vườn Ươm</h1>
          <p className="mt-1 text-xs text-slate-500 font-medium">Sổ cây giống trên điện thoại</p>
          <h2 className="mt-4 text-lg font-semibold text-slate-800">Đặt mật khẩu mới</h2>
        </div>

        {/* Card */}
        <div className="mt-6 bg-white py-8 px-5 shadow-sm rounded-2xl border border-slate-100 sm:px-10">
          {errorMsg && (
            <div
              role="alert"
              className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 text-red-700 text-xs leading-relaxed"
            >
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <p className="text-xs text-slate-600 mb-5 leading-relaxed">
            Vui lòng nhập mật khẩu mới cho tài khoản của bạn.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label htmlFor="new-password" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Mật khẩu mới (tối thiểu 6 ký tự)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nhập mật khẩu mới"
                  disabled={submitting}
                  className="block w-full pl-10 pr-3.5 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent transition-all min-h-[48px] text-slate-900 placeholder:text-slate-400"
                />
              </div>
            </div>

            <div>
              <label htmlFor="confirm-new-password" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Xác nhận lại mật khẩu mới
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="confirm-new-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Nhập lại mật khẩu mới"
                  disabled={submitting}
                  className="block w-full pl-10 pr-3.5 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent transition-all min-h-[48px] text-slate-900 placeholder:text-slate-400"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full min-h-[48px] px-4 py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Đang lưu mật khẩu...</span>
                  </>
                ) : (
                  <>
                    <span>Cập nhật mật khẩu mới</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
