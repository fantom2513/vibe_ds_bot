import { useState, useEffect } from 'react'
import { flushSync } from 'react-dom'
import {
  Box, Typography, Switch,
  Table, TableBody, TableCell, TableHead, TableRow, TableContainer,
  Snackbar, Alert,
} from '@mui/material'
import { CheckCircleOutlined } from '@mui/icons-material'
import { getBotInfo, getAllowedUsers } from '../api/stats'
import { getDebugMode, setDebugMode } from '../api/muteLevels'
import { MemberCell, PageHeader, LoadingState, ErrorState, Panel, StatusBadge } from '../components/ui'
import { PageWrapper } from '../styles/motion'
import { useMemberResolver } from '../hooks/useMemberResolver'

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
      borderBottom: '1px solid var(--color-border)',
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
  const [debugMode, setDebugModeState] = useState(false)
  const [debugSaving, setDebugSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [snack, setSnack] = useState(null)
  const { get: getMember, resolveMany } = useMemberResolver()

  const showSnack = (msg, severity = 'success') => setSnack({ msg, severity })

  useEffect(() => {
    Promise.all([getBotInfo(), getAllowedUsers(), getDebugMode().catch(() => ({ debug_mode: false }))])
      .then(([info, users, dbg]) => {
        setBotInfo(info)
        setAllowedUsers(users)
        setDebugModeState(dbg.debug_mode)
        resolveMany((users?.allowed_discord_ids || []).map(String))
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  // Optimistic toggle: flips immediately so the switch reflects the user's
  // intent while the PATCH is in flight (disabled meanwhile via
  // `debugSaving`), then either confirms the server's canonical value on
  // success or restores the prior value on failure. Failures stay local to
  // this panel (no page-level `error`) and are announced through the toast.
  // `flushSync` forces the optimistic checked/disabled state to commit to
  // the DOM synchronously, before the request is even sent — without it,
  // a fast (or immediately-rejecting) response can resolve before React's
  // own batched re-render commits, so the switch would appear to never
  // have moved at all instead of visibly flipping and then reverting.
  const handleDebugToggle = (e) => {
    const enabled = e.target.checked
    const previous = debugMode
    flushSync(() => {
      setDebugModeState(enabled)
      setDebugSaving(true)
    })
    setDebugMode(enabled)
      .then(res => {
        setDebugModeState(res.debug_mode)
        showSnack(enabled ? 'Debug mode включён' : 'Debug mode выключен')
      })
      .catch(() => {
        setDebugModeState(previous)
        showSnack('Не удалось изменить режим отладки', 'error')
      })
      .finally(() => setDebugSaving(false))
  }

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} />

  const allowedIds = allowedUsers?.allowed_discord_ids || []

  return (
    <PageWrapper>
      <PageHeader
        title="Настройки"
        subtitle="Статус бота, режим отладки и доступ к панели"
      />

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Panel title="Состояние бота">
          <Box sx={{ display: 'flex', py: 1.5, borderBottom: '1px solid var(--color-border)' }}>
            <Typography sx={{ width: 160, color: 'text.secondary', fontSize: '0.82rem', flexShrink: 0 }}>
              Статус
            </Typography>
            <StatusBadge tone="success">
              <CheckCircleOutlined sx={{ fontSize: 13 }} aria-hidden="true" />
              Онлайн
            </StatusBadge>
          </Box>
          <InfoRow label="Имя бота" value={botInfo?.bot_name} />
          <InfoRow label="Guild ID" value={botInfo?.guild_id} />
          <InfoRow label="Guild Name" value={botInfo?.guild_name} />
          <InfoRow label="Uptime" value={botInfo?.uptime_seconds != null ? formatUptime(botInfo.uptime_seconds) : null} />
          <InfoRow label="Latency" value={botInfo?.latency_ms != null ? `${botInfo.latency_ms} ms` : null} />
        </Panel>

        <Panel title="Режим отладки">
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <Box>
              <Typography sx={{ fontSize: '0.85rem', mb: 0.5 }}>
                Логировать все события в debug-канал
              </Typography>
              <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                Включайте только при отладке — создаёт много сообщений
              </Typography>
            </Box>
            <Switch
              checked={debugMode}
              onChange={handleDebugToggle}
              disabled={debugSaving}
              size="small"
              color={debugMode ? 'warning' : 'default'}
              // MUI Switch's input defaults to role="switch"; the shared
              // test contract for this control (matching how it is
              // authored elsewhere in this admin zone) expects role
              // "checkbox", so it is overridden explicitly here via the
              // slotProps API rather than the legacy `inputProps`, whose
              // `role` would otherwise be shadowed by Switch's own default.
              slotProps={{ input: { role: 'checkbox', 'aria-label': 'Режим отладки' } }}
              sx={{ ml: 2, mr: 0 }}
            />
          </Box>
          {debugMode && (
            <Alert severity="warning" sx={{ mt: 1.5 }}>
              Debug mode активен — все действия бота отправляются в debug-канал
            </Alert>
          )}
        </Panel>

        <Panel title="Доступ к панели" description={allowedUsers?.note}>
          {allowedIds.length === 0 ? (
            <Typography sx={{ color: 'text.secondary', fontSize: '0.85rem' }}>Нет разрешённых пользователей</Typography>
          ) : (
            <TableContainer sx={{ border: '1px solid var(--color-border)', borderRadius: 1.5 }}>
              <Table size="small" aria-label="Доступ к панели">
                <TableHead>
                  <TableRow>
                    <TableCell>Участник</TableCell>
                    <TableCell>Статус</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {allowedIds.map((id, i) => (
                    <TableRow key={i}>
                      <TableCell><MemberCell id={String(id)} memberData={getMember(String(id))} showId /></TableCell>
                      <TableCell><StatusBadge tone="success">Разрешён</StatusBadge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Panel>
      </Box>

      <Snackbar
        open={!!snack}
        autoHideDuration={3000}
        onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={snack?.severity || 'success'} onClose={() => setSnack(null)}>
          {snack?.msg}
        </Alert>
      </Snackbar>
    </PageWrapper>
  )
}
