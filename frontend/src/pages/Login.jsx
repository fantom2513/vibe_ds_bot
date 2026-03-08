import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Button, Typography } from '@mui/material'
import { useAuth } from '../contexts/AuthContext'
import { GlowCard } from '../components/ui'

export default function Login() {
  const { user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (user) navigate('/')
  }, [user, navigate])

  return (
    <Box sx={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
    }}>
      <GlowCard glowColor="accent" sx={{ width: 360, p: 4, textAlign: 'center' }}>
        <Box sx={{
          width: 56, height: 56, borderRadius: '14px', mx: 'auto', mb: 3,
          background: 'linear-gradient(135deg, #5865F2, #8b5cf6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '24px',
          boxShadow: '0 0 32px rgba(88,101,242,0.40)',
        }}>
          🤖
        </Box>
        <Typography variant="h5" sx={{ mb: 1, fontFamily: "'Syne', sans-serif" }}>
          Bot Dashboard
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
          Войдите через Discord чтобы получить доступ
        </Typography>
        <Button
          variant="contained"
          fullWidth
          size="large"
          onClick={() => { window.location.href = '/auth/discord/login' }}
          sx={{ py: 1.2 }}
        >
          Войти через Discord
        </Button>
      </GlowCard>
    </Box>
  )
}
