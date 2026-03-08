import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Box, LinearProgress } from '@mui/material'

export default function ProtectedRoute() {
  const { user } = useAuth()

  if (user === undefined) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <LinearProgress sx={{ width: 200, borderRadius: 2 }} />
      </Box>
    )
  }

  return user ? <Outlet /> : <Navigate to="/login" replace />
}
