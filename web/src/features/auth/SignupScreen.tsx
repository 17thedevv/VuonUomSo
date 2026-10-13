import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertCircle, CheckCircle2, Lock, Mail, Loader2, ArrowRight } from 'lucide-react'
import { useAuth } from '../../auth/useAuth'
import { formatAuthError } from './authHelpers'

export const SignupScreen: React.FC = () => {
  const { signUp, status } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [signupSuccessEmail, setSignupSuccessEmail] = useState<string | null>(null)

  // Redirect if already authenticated
  React.useEffect(() => {
    if (status === 'authenticated') {
      navigate('/', { replace: true })
    }
  }, [status, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return

    const trimmedEmail = email.trim()
    if (!trimmedEmail || !password || !confirmPassword) {
      setErrorMsg('Vui lòng điền đầy đủ các thông tin.')
      return
    }

    if (password.length < 6) {
      setErrorMsg('Mật khẩu phải có độ dài tối thiểu từ 6 ký tự.')
      return
    }

    if (password !== confirmPassword) {
      setErrorMsg('Mật khẩu xác nhận không khớp.')
      return
    }

    setSubmitting(true)
    setErrorMsg(null)

    try {
      const result = await signUp(trimmedEmail, password)
      if (result.requiresEmailConfirmation) {
        setSignupSuccessEmail(trimmedEmail)
      } else {
        // In rare dev instances where confirm email is off, automatically goes to app
        navigate('/', { replace: true })
      }
    } catch (err: unknown) {
      setErrorMsg(formatAuthError(err))
    } finally {
      setSubmitting(false)
    }
  }

  // Confirmation instructions state
  if (signupSuccessEmail) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-5 shadow-sm rounded-2xl border border-slate-100 sm:px-10 text-center">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <h2 className="text-xl font-bold text-slate-900 mb-2">Đăng ký thành công!</h2>

            <div className="text-xs text-slate-600 leading-relaxed space-y-3 mb-6">
              <p>
                Chúng tôi đã gửi thư xác nhận đến địa chỉ:
                <br />
                <span className="font-semibold text-slate-900 break-all">{signupSuccessEmail}</span>
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-amber-900 text-left">
                <p className="font-medium mb-1">Lưu ý quan trọng:</p>
                <p>
                  Vui lòng kiểm tra hộp thư (bao gồm cả mục <strong>Thư rác / Spam</strong>) và bấm vào liên kết xác nhận để kích hoạt tài khoản trước khi đăng nhập.
                </p>
              </div>
            </div>

            <Link
              to="/login"
              className="w-full min-h-[48px] px-4 py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2 shadow-sm"
            >
              <span>Về màn hình đăng nhập</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
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
          <h2 className="mt-4 text-lg font-semibold text-slate-800">Tạo tài khoản mới</h2>
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

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label htmlFor="signup-email" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Địa chỉ Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="signup-email"
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

            <div>
              <label htmlFor="signup-password" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Mật khẩu (tối thiểu 6 ký tự)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="signup-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Tạo mật khẩu"
                  disabled={submitting}
                  className="block w-full pl-10 pr-3.5 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent transition-all min-h-[48px] text-slate-900 placeholder:text-slate-400"
                />
              </div>
            </div>

            <div>
              <label htmlFor="signup-confirm-password" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Xác nhận lại mật khẩu
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="signup-confirm-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Nhập lại mật khẩu"
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
                    <span>Đang tạo tài khoản...</span>
                  </>
                ) : (
                  <>
                    <span>Đăng ký tài khoản</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Login link */}
          <div className="mt-6 pt-5 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-600">
              Đã có tài khoản?{' '}
              <Link
                to="/login"
                className="font-semibold text-emerald-700 hover:text-emerald-800 transition-colors"
              >
                Đăng nhập
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
