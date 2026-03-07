import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Spin } from 'antd'

export default function ProtectedRoute() {
  const { user } = useAuth()

  if (user === undefined) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center',
                    alignItems: 'center', height: '100vh' }}>
        <Spin size="large" />
      </div>
    )
  }

  return user ? <Outlet /> : <Navigate to="/login" replace />
}
