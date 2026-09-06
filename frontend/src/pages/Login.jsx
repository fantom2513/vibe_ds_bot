import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Button, Typography } from '@mui/material'
import { useAuth } from '../contexts/AuthContext'
import { GlowCard } from '../components/ui'
import BrandMark from '../components/BrandMark'

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
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
          <BrandMark size={32} />
        </Box>
        <Typography variant="h5" sx={{ mb: 1 }}>
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
