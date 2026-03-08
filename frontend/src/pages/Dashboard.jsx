import { useState, useEffect, useCallback } from 'react'
import {
  Grid, Typography,
  Table, TableBody, TableCell, TableHead, TableRow, TableContainer,
  Avatar, Paper,
} from '@mui/material'
import {
  ListAltOutlined,
  GroupOutlined,
  BoltOutlined,
  HistoryOutlined,
} from '@mui/icons-material'
import { getDashboard } from '../api/dashboard'
import { getStatsOverview } from '../api/stats'
import { StatCard, ActionChip, PageHeader, LoadingState, ErrorState, EmptyState, DiscordId } from '../components/ui'
import { PageWrapper } from '../styles/motion'
import Timestamp from '../components/Timestamp'

export default function Dashboard() {
  const [dashboard, setDashboard] = useState(null)
  const [stats, setStats] = useState(null)
  const [recentLogs, setRecentLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchData = useCallback(async () => {
    try {
      const [dash, st] = await Promise.all([getDashboard(), getStatsOverview()])
      setDashboard(dash)
      setStats(st)
      setRecentLogs(dash.recent_logs || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    const es = new EventSource('/api/dashboard/stream')
    es.onmessage = (e) => {
      const event = JSON.parse(e.data)
      if (event.type === 'ping') return
      if (event.type === 'voice_update') fetchData()
      if (event.type === 'action_log') {
        setRecentLogs(prev => [
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
        ].slice(0, 20))
      }
    }
    es.onerror = () => { console.warn('SSE disconnected') }
    return () => es.close()
  }, [fetchData])

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} />

  const onlineUsers = dashboard?.online_users || []
  const todayActions = stats?.total_actions || 0

  return (
    <PageWrapper>
      <PageHeader
        title="Dashboard"
        subtitle="Обзор активности бота в реальном времени"
      />

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard title="Активных правил" value={dashboard?.active_rules?.length ?? 0}
            icon={ListAltOutlined} color="#5865F2" glowColor="accent" index={0} />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard title="В голосе сейчас" value={dashboard?.voice_online_count ?? 0}
            icon={GroupOutlined} color="#22d3a5" glowColor="green" index={1} />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard title="Действий всего" value={todayActions}
            icon={BoltOutlined} color="#fbbf24" glowColor="accent" index={2} />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard title="Последних событий" value={recentLogs.length}
            icon={HistoryOutlined} color="#38bdf8" glowColor="accent" index={3} />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} lg={6}>
          <Typography variant="h6" sx={{ mb: 1.5, fontSize: '0.9rem' }}>
            Сейчас в голосе
          </Typography>
          {onlineUsers.length === 0 ? (
            <EmptyState text="Никого нет в голосовых каналах" icon="🔇" />
          ) : (
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ width: 40 }} />
                    <TableCell>Пользователь</TableCell>
                    <TableCell>Канал</TableCell>
                    <TableCell>Время в канале</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {onlineUsers.map(u => (
                    <TableRow key={u.user_id}>
                      <TableCell><Avatar src={u.avatar} sx={{ width: 24, height: 24 }} /></TableCell>
                      <TableCell>{u.username}</TableCell>
                      <TableCell>{u.channel_name}</TableCell>
                      <TableCell><Timestamp iso={u.joined_at} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Grid>

        <Grid item xs={12} lg={6}>
          <Typography variant="h6" sx={{ mb: 1.5, fontSize: '0.9rem' }}>
            Последние события
          </Typography>
          {recentLogs.length === 0 ? (
            <EmptyState text="Нет событий" icon="📋" />
          ) : (
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Время</TableCell>
                    <TableCell>Discord ID</TableCell>
                    <TableCell>Действие</TableCell>
                    <TableCell>Rule</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {recentLogs.map(log => (
                    <TableRow key={log.id}>
                      <TableCell><Timestamp iso={log.executed_at} /></TableCell>
                      <TableCell><DiscordId id={log.discord_id} /></TableCell>
                      <TableCell><ActionChip type={log.action_type} isDryRun={log.is_dry_run} /></TableCell>
                      <TableCell sx={{ color: 'text.disabled', fontFamily: "'IBM Plex Mono'", fontSize: '0.72rem' }}>
                        {log.rule_id ?? '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Grid>
      </Grid>
    </PageWrapper>
  )
}
