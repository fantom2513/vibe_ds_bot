import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, Typography } from 'antd'
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const { user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (user) navigate('/')
  }, [user, navigate])

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: 'var(--bg-base)',
      }}
    >
      <Card
        style={{
          width: 360,
          textAlign: 'center',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-base)',
        }}
      >
        <Typography.Title
          level={3}
          style={{ color: 'var(--text-primary)', fontFamily: 'Syne, sans-serif' }}
        >
          Bot Dashboard
        </Typography.Title>
        <Typography.Paragraph style={{ color: 'var(--text-secondary)' }}>
          Войдите через Discord чтобы получить доступ
        </Typography.Paragraph>
        <Button
          type="primary"
          size="large"
          block
          onClick={() => (window.location.href = '/auth/discord/login')}
        >
          Войти через Discord
        </Button>
      </Card>
    </div>
  )
}
