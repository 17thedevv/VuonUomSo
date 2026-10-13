import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, CheckCircle2, Mail, Loader2, ArrowLeft, ArrowRight } from 'lucide-react'
import { useAuth } from '../../auth/useAuth'
import { formatAuthError } from './authHelpers'

export const ForgotPasswordScreen: React.FC = () => {
  const { requestPasswordReset } = useAuth()

  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successEmail, setSuccessEmail] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return

    const trimmedEmail = email.trim()
    if (!trimmedEmail) {
      setErrorMsg('Vui lòng nhập địa chỉ email.')
      return
    }

    setSubmitting(true)
    setErrorMsg(null)

    try {
      await requestPasswordReset(trimmedEmail)
      setSuccessEmail(trimmedEmail)
    } catch (err: unknown) {
      setErrorMsg(formatAuthError(err))
    } finally {
      setSubmitting(false)
    }
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
          <h2 className="mt-4 text-lg font-semibold text-slate-800">Khôi phục mật khẩu</h2>
        </div>

        {/* Card */}
        <div className="mt-6 bg-white py-8 px-5 shadow-sm rounded-2xl border border-slate-100 sm:px-10">
          {successEmail ? (
            <div className="text-center space-y-4">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>

              <div className="text-xs text-slate-600 leading-relaxed space-y-2">
                <p className="text-sm font-semibold text-slate-900">Đã gửi email khôi phục</p>
                <p>
                  Liên kết đặt lại mật khẩu đã được gửi tới:
                  <br />
                  <span className="font-semibold text-slate-900 break-all">{successEmail}</span>
                </p>
                <p className="text-slate-500">
                  Vui lòng kiểm tra hộp thư (kể cả mục Spam) và làm theo hướng dẫn trong email.
                </p>
              </div>

              <div className="pt-3">
                <Link
                  to="/login"
                  className="w-full min-h-[48px] px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm transition-colors flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Quay lại trang Đăng nhập</span>
                </Link>
              </div>
            </div>
          ) : (
            <>
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
                Nhập địa chỉ email đã đăng ký. Chúng tôi sẽ gửi đường dẫn an toàn để bạn thiết lập lại mật khẩu.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <div>
                  <label htmlFor="recovery-email" className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Địa chỉ Email
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      id="recovery-email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="vidu@email.com"
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
                        <span>Đang gửi yêu cầu...</span>
                      </>
                    ) : (
                      <>
                        <span>Gửi liên kết khôi phục</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </form>

              <div className="mt-6 pt-5 border-t border-slate-100 text-center">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800 transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Quay lại trang Đăng nhập</span>
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
