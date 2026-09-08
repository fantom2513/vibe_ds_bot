import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import {
  Box,
  Grid,
  Typography,
  Divider,
  Button,
  useMediaQuery,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableContainer,
  Avatar,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import {
  AddOutlined,
  ArrowForwardOutlined,
  ArticleOutlined,
  ListAltOutlined,
  VolumeOffOutlined,
} from '@mui/icons-material'
import { getDashboard } from '../api/dashboard'
import { getStatsOverview } from '../api/stats'
import {
  Panel,
  StatusBadge,
  ActionChip,
  LoadingState,
  ErrorState,
  EmptyState,
  DiscordId,
} from '../components/ui'
import { PageWrapper } from '../styles/motion'
import Timestamp from '../components/Timestamp'
import { cronDescription } from '../utils/cron'

const MONO = { fontFamily: "'IBM Plex Mono', monospace" }

// Scope + schedule as a short human summary (with the raw cron/tz kept
// available as the mono detail line underneath it) — this is what "scope/
// schedule summary" means for the active-rules table/records.
function ruleSummary(rule) {
  const scope = rule.target_list
    ? rule.target_list === 'whitelist'
      ? 'Whitelist'
      : 'Blacklist'
    : Array.isArray(rule.channel_ids) && rule.channel_ids.length
      ? `${rule.channel_ids.length} канал(ов)`
      : 'Все участники'
  const schedule = rule.schedule_cron
    ? cronDescription(rule.schedule_cron) || rule.schedule_cron
    : 'Постоянно'
  return { scope, schedule, tz: rule.schedule_tz || '—' }
}

function Field({ label, children }) {
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        py: 0.6,
        gap: 1.5,
      }}
    >
      <Typography
        sx={{
          fontFamily: "'IBM Plex Sans', sans-serif",
          color: 'text.secondary',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          fontSize: '0.65rem',
          fontWeight: 600,
        }}
      >
        {label}
      </Typography>
      <Box sx={{ textAlign: 'right' }}>{children}</Box>
    </Box>
  )
}

// Compact labelled record used in place of a horizontally-scrolling table row
// on small screens — voice-presence variant (avatar, member, channel, elapsed
// time), mirroring RuleRecord's structure/styling below.
function VoiceRecord({ user }) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.25,
        border: '1px solid var(--color-border)',
        borderRadius: 2,
        p: 1.75,
      }}
    >
      <Avatar src={user.avatar} sx={{ width: 32, height: 32, fontSize: '0.8rem', flexShrink: 0 }}>
        {user.username?.[0]?.toUpperCase()}
      </Avatar>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography sx={{ color: 'text.primary', fontWeight: 600, fontSize: '0.85rem' }}>
          {user.username}
        </Typography>
        <Typography sx={{ color: 'text.secondary', fontSize: '0.78rem' }}>
          {user.channel_name}
        </Typography>
      </Box>
      <Box sx={{ flexShrink: 0 }}>
        <Timestamp iso={user.joined_at} />
      </Box>
    </Box>
  )
}

// Compact labelled record used in place of a horizontally-scrolling table row
// on small screens.
function RuleRecord({ rule }) {
  const { scope, schedule, tz } = ruleSummary(rule)
  return (
    <Box sx={{ border: '1px solid var(--color-border)', borderRadius: 2, p: 1.75 }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 1,
          mb: 0.5,
        }}
      >
        <Typography sx={{ color: 'text.primary', fontWeight: 600, fontSize: '0.85rem' }}>
          {rule.name}
        </Typography>
        <Typography sx={{ ...MONO, color: 'text.secondary', fontSize: '0.7rem', flexShrink: 0 }}>
          #{rule.id}
        </Typography>
      </Box>
      <Field label="Действие">
        <ActionChip type={rule.action_type} isDryRun={rule.is_dry_run} />
      </Field>
      <Field label="Область и расписание">
        <Typography sx={{ fontSize: '0.78rem', color: 'text.primary' }}>{scope}</Typography>
        <Typography sx={{ ...MONO, fontSize: '0.68rem', color: 'text.secondary' }}>
          {schedule} · {tz}
        </Typography>
      </Field>
      <Field label="Приоритет">
        <Typography sx={MONO}>{rule.priority}</Typography>
      </Field>
      <Field label="Режим">
        <StatusBadge tone={rule.is_dry_run ? 'warning' : 'success'}>
          {rule.is_dry_run ? 'DRY-RUN' : 'Боевой'}
        </StatusBadge>
      </Field>
    </Box>
  )
}

export default function Dashboard() {
  const theme = useTheme()
  const navigate = useNavigate()
  const isCompact = useMediaQuery(theme.breakpoints.down('sm'))

  const [dashboard, setDashboard] = useState(null)
  const [stats, setStats] = useState(null)
  const [recentLogs, setRecentLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [live, setLive] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const [dash, st] = await Promise.all([getDashboard(), getStatsOverview()])
      setDashboard(dash)
      setStats(st)
      setRecentLogs(dash.recent_logs || [])
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  // Retry is a distinct entry point from the passive initial/SSE-triggered
  // fetches: it must clear the stale error and show loading immediately,
  // rather than leaving the old error alert on screen until the request
  // resolves.
  const handleRetry = useCallback(() => {
    setError(null)
    setLoading(true)
    fetchData()
  }, [fetchData])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    const es = new EventSource('/api/dashboard/stream')
    es.onopen = () => setLive(true)
    es.onmessage = e => {
      let event
      try {
        event = JSON.parse(e.data)
      } catch (err) {
        console.warn('Dashboard SSE: malformed payload, ignoring', err)
        return
      }
      if (event.type === 'ping') return
      if (event.type === 'voice_update') fetchData()
      if (event.type === 'action_log') {
        setRecentLogs(prev =>
          [
            {
              id: Date.now(),
              executed_at: event.timestamp,
              discord_id: event.discord_id,
              action_type: event.action_type,
              rule_id: event.rule_id,
              is_dry_run: event.is_dry_run,
              channel_id: null,
            },
            ...prev,
          ].slice(0, 20)
        )
      }
    }
    es.onerror = () => {
      setLive(false)
      console.warn('SSE disconnected')
    }
    return () => es.close()
  }, [fetchData])

  const activeRules = dashboard?.active_rules || []
  const onlineUsers = dashboard?.online_users || []
  const voiceCount = dashboard?.voice_online_count ?? onlineUsers.length
  const totalActions = stats?.total_actions ?? 0
  const latestEvent = recentLogs[0]

  const ruleNameById = useMemo(() => {
    const map = new Map()
    activeRules.forEach(r => map.set(r.id, r.name))
    return map
  }, [activeRules])

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={handleRetry} />

  const metrics = [
    { label: 'В голосе сейчас', value: voiceCount },
    { label: 'Активные правила', value: activeRules.length },
    { label: 'Действий всего', value: totalActions },
    {
      label: 'Последнее событие',
      value: latestEvent ? <Timestamp iso={latestEvent.executed_at} /> : '—',
    },
  ]

  return (
    <PageWrapper>
      {/* 1. Page header: Unbounded heading, live-status badge, primary CTA. */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'stretch', sm: 'center' },
          gap: 1.5,
          mb: 2.5,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
          <Typography
            variant="h3"
            sx={{ fontSize: { xs: '1.35rem', sm: '1.6rem' }, color: 'text.primary' }}
          >
            Обзор сервера
          </Typography>
          <StatusBadge tone={live ? 'success' : 'neutral'} dot>
            {live ? 'В сети' : 'Нет соединения'}
          </StatusBadge>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddOutlined />}
          onClick={() => navigate('/rules')}
          sx={{ alignSelf: { xs: 'stretch', sm: 'auto' } }}
        >
          Создать правило
        </Button>
      </Box>
      <Divider sx={{ mb: 3 }} />

      {/* 2. Compact metric strip, led by people in voice and active rules. */}
      <Box
        component="ul"
        role="list"
        aria-label="Ключевые показатели"
        sx={{
          listStyle: 'none',
          m: 0,
          p: 0,
          mb: 3,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 3,
        }}
      >
        {metrics.map(m => (
          <Box component="li" role="listitem" key={m.label} sx={{ minWidth: 130 }}>
            <Typography variant="overline" sx={{ color: 'text.secondary', display: 'block' }}>
              {m.label}
            </Typography>
            <Typography
              sx={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: '1.35rem',
                fontWeight: 600,
                lineHeight: 1.3,
                color: 'text.primary',
              }}
            >
              {m.value}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* 3. Two-column operational area: voice presence (wider) + activity stream. */}
      <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
        <Grid item xs={12} lg={7}>
          <Panel
            title="Сейчас в голосе"
            description={`${onlineUsers.length} участник(ов) в голосовых каналах`}
          >
            {onlineUsers.length === 0 ? (
              // `dashboard.online_users` isn't wired up on the backend yet
              // (DashboardResponse only carries voice_online_count), so this
              // panel is always empty in production today — the copy must
              // not claim "nobody is in voice" when the truth is "this data
              // isn't available yet". Tracked as backend tech debt.
              <EmptyState
                text="Данные о присутствии в голосе временно недоступны"
                icon={VolumeOffOutlined}
              />
            ) : isCompact ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {onlineUsers.map(u => (
                  <VoiceRecord key={u.user_id} user={u} />
                ))}
              </Box>
            ) : (
              <TableContainer>
                <Table size="small" aria-label="Сейчас в голосе">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ width: 40 }} />
                      <TableCell>Участник</TableCell>
                      <TableCell>Канал</TableCell>
                      <TableCell>В канале</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {onlineUsers.map(u => (
                      <TableRow key={u.user_id}>
                        <TableCell>
                          <Avatar
                            src={u.avatar}
                            sx={{ width: 24, height: 24, fontSize: '0.65rem' }}
                          >
                            {u.username?.[0]?.toUpperCase()}
                          </Avatar>
                        </TableCell>
                        <TableCell sx={{ color: 'text.primary' }}>{u.username}</TableCell>
                        <TableCell sx={{ color: 'text.secondary' }}>{u.channel_name}</TableCell>
                        <TableCell>
                          <Timestamp iso={u.joined_at} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Panel>
        </Grid>

        <Grid item xs={12} lg={5}>
          <Panel title="Что происходит" description="Последние действия бота">
            {recentLogs.length === 0 ? (
              <EmptyState text="Нет событий" icon={ArticleOutlined} />
            ) : (
              <Box
                component="ul"
                role="list"
                aria-label="Что происходит"
                sx={{ listStyle: 'none', m: 0, p: 0 }}
              >
                {recentLogs.map(log => (
                  <Box
                    component="li"
                    role="listitem"
                    key={log.id}
                    sx={{
                      py: 1.1,
                      borderBottom: '1px solid var(--color-border)',
                      '&:last-of-type': { borderBottom: 'none' },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <ActionChip type={log.action_type} isDryRun={log.is_dry_run} />
                      <Typography sx={{ fontSize: '0.78rem', color: 'text.primary' }}>
                        {ruleNameById.get(log.rule_id) ||
                          (log.rule_id != null ? `Правило #${log.rule_id}` : 'Без правила')}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mt: 0.5 }}>
                      <DiscordId id={log.discord_id} />
                      <Timestamp iso={log.executed_at} />
                    </Box>
                  </Box>
                ))}
              </Box>
            )}
          </Panel>
        </Grid>
      </Grid>

      {/* 4. Full-width active-rules table (compact records on small screens). */}
      <Panel
        title="Активные правила"
        description={`${activeRules.length} правил(о) сейчас применяется`}
        action={
          <Button
            component={RouterLink}
            to="/rules"
            variant="text"
            size="small"
            endIcon={<ArrowForwardOutlined sx={{ fontSize: 16 }} />}
            // Named nav control (not a dense inline row action), so it gets
            // the 44px touch-target minimum explicitly — the theme's
            // MuiButton.sizeSmall is deliberately excluded from that fix
            // (see theme.js) since most size="small" controls are dense
            // table-row actions that should stay compact.
            sx={{ minHeight: 44 }}
          >
            Все правила
          </Button>
        }
      >
        {activeRules.length === 0 ? (
          <EmptyState text="Нет активных правил" icon={ListAltOutlined} />
        ) : isCompact ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {activeRules.map(rule => (
              <RuleRecord key={rule.id} rule={rule} />
            ))}
          </Box>
        ) : (
          <TableContainer>
            <Table size="small" aria-label="Активные правила">
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>Название</TableCell>
                  <TableCell>Действие</TableCell>
                  <TableCell>Область и расписание</TableCell>
                  <TableCell>Приоритет</TableCell>
                  <TableCell>Режим</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {activeRules.map(rule => {
                  const { scope, schedule, tz } = ruleSummary(rule)
                  return (
                    <TableRow key={rule.id}>
                      <TableCell sx={MONO}>#{rule.id}</TableCell>
                      <TableCell sx={{ color: 'text.primary' }}>{rule.name}</TableCell>
                      <TableCell>
                        <ActionChip type={rule.action_type} isDryRun={rule.is_dry_run} />
                      </TableCell>
                      <TableCell>
                        <Typography sx={{ fontSize: '0.8rem', color: 'text.primary' }}>
                          {scope}
                        </Typography>
                        <Typography sx={{ ...MONO, fontSize: '0.7rem', color: 'text.secondary' }}>
                          {schedule} · {tz}
                        </Typography>
                      </TableCell>
                      <TableCell sx={MONO}>{rule.priority}</TableCell>
                      <TableCell>
                        <StatusBadge tone={rule.is_dry_run ? 'warning' : 'success'}>
                          {rule.is_dry_run ? 'DRY-RUN' : 'Боевой'}
                        </StatusBadge>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Panel>
    </PageWrapper>
  )
}
