import { useState, useEffect } from 'react'
import {
  Box, Typography,
  Table, TableBody, TableCell, TableHead, TableRow, TableContainer,
  Paper,
} from '@mui/material'
import { CheckCircleOutlined } from '@mui/icons-material'
import { getBotInfo, getAllowedUsers } from '../api/stats'
import { DiscordId, PageHeader, LoadingState, ErrorState } from '../components/ui'
import { GlowCard } from '../components/ui'
import { PageWrapper } from '../styles/motion'

const MONO = { fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.82rem' }

function formatUptime(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${h}ч ${m}м ${s}с`
}

function InfoRow({ label, value }) {
  return (
    <Box sx={{
      display: 'flex',
      py: 1.5,
      borderBottom: '1px solid rgba(255,255,255,0.05)',
      '&:last-child': { borderBottom: 'none' },
    }}>
      <Typography sx={{ width: 160, color: 'text.secondary', fontSize: '0.82rem', flexShrink: 0 }}>
        {label}
      </Typography>
      <Typography sx={{ ...MONO, color: 'text.primary' }}>{value || '—'}</Typography>
    </Box>
  )
}

export default function Settings() {
  const [botInfo, setBotInfo] = useState(null)
  const [allowedUsers, setAllowedUsers] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    Promise.all([getBotInfo(), getAllowedUsers()])
      .then(([info, users]) => { setBotInfo(info); setAllowedUsers(users) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} />

  const allowedIds = allowedUsers?.allowed_discord_ids || []

  return (
    <PageWrapper>
      <PageHeader
        title="Settings"
        subtitle="Информация о боте и доступ к дашборду"
      />

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Box>
          <Typography variant="h6" sx={{ mb: 1.5, fontSize: '0.9rem' }}>Bot Info</Typography>
          <GlowCard glowColor="accent" sx={{ p: 0 }}>
            <Box sx={{ px: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1.5, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <Typography sx={{ width: 160, color: 'text.secondary', fontSize: '0.82rem', flexShrink: 0 }}>
                  Статус
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <CheckCircleOutlined sx={{ fontSize: 14, color: 'var(--green)' }} />
                  <Typography sx={{ ...MONO, color: 'var(--green)' }}>Online</Typography>
                </Box>
              </Box>
              <InfoRow label="Имя бота" value={botInfo?.bot_name} />
              <InfoRow label="Guild ID" value={botInfo?.guild_id} />
              <InfoRow label="Guild Name" value={botInfo?.guild_name} />
              <InfoRow label="Uptime" value={botInfo?.uptime_seconds != null ? formatUptime(botInfo.uptime_seconds) : null} />
              <InfoRow label="Latency" value={botInfo?.latency_ms != null ? `${botInfo.latency_ms} ms` : null} />
            </Box>
          </GlowCard>
        </Box>

        <Box>
          <Typography variant="h6" sx={{ mb: 0.5, fontSize: '0.9rem' }}>Dashboard Access</Typography>
          {allowedUsers?.note && (
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
              {allowedUsers.note}
            </Typography>
          )}
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Discord ID</TableCell>
                  <TableCell>Статус</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {allowedIds.map((id, i) => (
                  <TableRow key={i}>
                    <TableCell><DiscordId id={id} /></TableCell>
                    <TableCell>
                      <Box component="span" sx={{
                        px: 0.75, py: '2px', borderRadius: '4px',
                        fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.70rem',
                        backgroundColor: 'rgba(34,211,165,0.10)',
                        color: '#22d3a5',
                        border: '1px solid rgba(34,211,165,0.30)',
                      }}>
                        Allowed
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      </Box>
    </PageWrapper>
  )
}
