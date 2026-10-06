import React from 'react'
import { WifiOff } from 'lucide-react'
import { useOnlineStatus } from '../hooks/useOnlineStatus'

export const OfflineBadge: React.FC = () => {
  const isOnline = useOnlineStatus()

  if (isOnline) return null

  return (
    <div
      role="status"
      className="bg-amber-100 border-b border-amber-300 text-amber-900 px-4 py-2 text-xs flex items-center justify-center gap-2"
    >
      <WifiOff className="w-4 h-4 shrink-0 text-amber-700" />
      <span>Đang dùng ngoại tuyến. Dữ liệu đang được lưu trên thiết bị này.</span>
    </div>
  )
}
