/**
 * Maps raw Supabase / network auth errors into clear, friendly Vietnamese copy.
 * Prevents technical English exceptions from confusing the user.
 */
export function formatAuthError(err: unknown): string {
  if (!err) return 'Đã có lỗi xảy ra.'
  const msg = err instanceof Error ? err.message : String(err)

  if (msg.includes('Invalid login credentials') || msg.includes('invalid_credentials')) {
    return 'Email hoặc mật khẩu không chính xác.'
  }
  if (msg.includes('User already registered') || msg.includes('user_already_exists')) {
    return 'Email này đã được đăng ký tài khoản. Vui lòng đăng nhập hoặc khôi phục mật khẩu.'
  }
  if (msg.includes('Password should be at least')) {
    return 'Mật khẩu phải có ít nhất 6 ký tự.'
  }
  if (msg.includes('rate limit') || msg.includes('too many requests') || msg.includes('over_email_send_rate_limit')) {
    return 'Bạn đã gửi yêu cầu quá nhiều lần. Vui lòng chờ vài phút rồi thử lại.'
  }
  if (msg.includes('Email not confirmed')) {
    return 'Tài khoản chưa được kích hoạt. Vui lòng kiểm tra hộp thư email để xác nhận.'
  }
  if (msg.includes('Network') || msg.includes('fetch') || msg.includes('Failed to fetch')) {
    return 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra lại kết nối mạng.'
  }

  return msg || 'Đã có lỗi xảy ra. Vui lòng thử lại.'
}
