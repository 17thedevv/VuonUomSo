import React from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './useAuth'

export const AuthBoundary: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'initializing') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-xs text-slate-400 font-medium">
        Đang kiểm tra phiên đăng nhập...
      </div>
    )
  }

  if (status === 'unauthenticated') {
    const redirectParam =
      location.pathname !== '/' ? `?redirect=${encodeURIComponent(location.pathname + location.search)}` : ''
    return <Navigate to={`/login${redirectParam}`} replace />
  }

  return children ? <>{children}</> : <Outlet />
}
