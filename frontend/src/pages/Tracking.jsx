import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import { DeleteOutlined, EditOutlined, PersonOutlineOutlined, RefreshOutlined } from '@mui/icons-material'
import {
  createTrackedMember,
  deleteTrackedMember,
  getDailyWorkHours,
  getTrackingSettings,
  listTextChannels,
  listTrackedMembers,
  previewTrackingReport,
  setTrackingSettings,
  updateTrackedMember,
} from '../api/tracking'
import DailyWorkHoursChart from '../components/DailyWorkHoursChart'
import {
  ConfirmDialog,
  EmptyState,
  ErrorState,
  FormDrawer,
  LoadingState,
  MemberAutocomplete,
  MemberCell,
  PageHeader,
  Panel,
  StatusBadge,
} from '../components/ui'
import { useMemberResolver } from '../hooks/useMemberResolver'
import { PageWrapper } from '../styles/motion'

const WEEKDAYS = [
  { value: 0, label: 'Пн' },
  { value: 1, label: 'Вт' },
  { value: 2, label: 'Ср' },
  { value: 3, label: 'Чт' },
  { value: 4, label: 'Пт' },
  { value: 5, label: 'Сб' },
  { value: 6, label: 'Вс' },
]

const TIMEZONES = ['Europe/Moscow', 'Europe/London', 'Europe/Berlin', 'America/New_York', 'Asia/Tokyo', 'UTC']

const defaultSchedule = () => ({
  work_days: [0, 1, 2, 3, 4],
  work_start: '09:00',
  work_end: '18:00',
  timezone: 'Europe/Moscow',
  is_active: true,
})

const normalizeTime = value => String(value || '').slice(0, 5)

const NUMBER_FORMAT = new Intl.NumberFormat('ru-RU')
const numberLabel = value => NUMBER_FORMAT.format(Number(value || 0))

const scheduleFromMember = member => ({
  work_days: [...member.work_days],
  work_start: normalizeTime(member.work_start),
  work_end: normalizeTime(member.work_end),
  timezone: member.timezone,
  is_active: member.is_active,
})

const durationLabel = seconds => {
  const totalMinutes = Math.floor(Number(seconds || 0) / 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours && minutes) return `${numberLabel(hours)} ч ${numberLabel(minutes)} мин`
  if (hours) return `${numberLabel(hours)} ч`
  return `${numberLabel(minutes)} мин`
}

const errorMessage = error => error.response?.data?.detail || error.message || 'Ошибка'

export default function Tracking() {
  const [members, setMembers] = useState([])
  const [channels, setChannels] = useState([])
  const [reportChannelId, setReportChannelId] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [selectedMember, setSelectedMember] = useState(null)
  const [period, setPeriod] = useState('today')
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState(null)
  const [pendingAction, setPendingAction] = useState(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [schedule, setSchedule] = useState(defaultSchedule())
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [snack, setSnack] = useState(null)
  const [dailyWorkHours, setDailyWorkHours] = useState(null)
  const previewRequestId = useRef(0)
  const periodRef = useRef('today')
  const { get, resolveMany } = useMemberResolver()
  const busy = pendingAction !== null

  const showSnack = (message, severity = 'success') => setSnack({ message, severity })

  const loadPreview = useCallback(async selectedPeriod => {
    const requestId = ++previewRequestId.current
    setPreviewLoading(true)
    setPreviewError(null)
    try {
      const data = await previewTrackingReport(selectedPeriod)
      if (requestId === previewRequestId.current && selectedPeriod === periodRef.current) setPreview(data)
    } catch (requestError) {
      if (requestId === previewRequestId.current && selectedPeriod === periodRef.current) {
        setPreviewError(errorMessage(requestError))
      }
    } finally {
      if (requestId === previewRequestId.current) setPreviewLoading(false)
    }
  }, [])

  const loadMembers = useCallback(async () => {
    const data = await listTrackedMembers()
    setMembers(data)
    resolveMany(data.map(member => String(member.discord_id)))
    return data
  }, [resolveMany])

  useEffect(() => {
    const load = async () => {
      try {
        const [memberData, settings, channelData] = await Promise.all([
          listTrackedMembers(),
          getTrackingSettings(),
          listTextChannels(),
        ])
        setMembers(memberData)
        resolveMany(memberData.map(member => String(member.discord_id)))
        setReportChannelId(settings.report_channel_id || '')
        setChannels(channelData)
      } catch (requestError) {
        setError(errorMessage(requestError))
      } finally {
        setLoading(false)
      }
    }
    load()
    loadPreview('today')
    getDailyWorkHours(14).then(setDailyWorkHours).catch(() => setDailyWorkHours(null))
  }, [loadPreview, resolveMany])

  const handlePeriodChange = event => {
    const nextPeriod = event.target.value
    periodRef.current = nextPeriod
    setPeriod(nextPeriod)
    loadPreview(nextPeriod)
  }

  const refreshCurrentPreview = () => loadPreview(periodRef.current)

  const handleAdd = async () => {
    if (!selectedId) {
      showSnack('Выберите пользователя', 'error')
      return
    }
    setPendingAction('add')
    try {
      const created = await createTrackedMember({
        discord_id: selectedId,
        username: selectedMember?.display_name || selectedMember?.username || null,
        ...defaultSchedule(),
      })
      setSelectedId(null)
      setSelectedMember(null)
      setEditing(created)
      setSchedule(scheduleFromMember(created))
      setDrawerOpen(true)
      await loadMembers()
      showSnack('Участник добавлен')
    } catch (requestError) {
      showSnack(errorMessage(requestError), 'error')
    } finally {
      setPendingAction(null)
    }
  }

  const openSchedule = member => {
    setEditing(member)
    setSchedule(scheduleFromMember(member))
    setDrawerOpen(true)
  }

  const handleScheduleSave = async () => {
    if (schedule.work_days.length === 0) {
      showSnack('Выберите хотя бы один рабочий день', 'error')
      return
    }
    setPendingAction('schedule')
    try {
      await updateTrackedMember(String(editing.discord_id), schedule)
      setDrawerOpen(false)
      await Promise.all([loadMembers(), refreshCurrentPreview()])
      showSnack('Расписание сохранено')
    } catch (requestError) {
      showSnack(errorMessage(requestError), 'error')
    } finally {
      setPendingAction(null)
    }
  }

  const handleChannelSave = async () => {
    setPendingAction('channel')
    try {
      const settings = await setTrackingSettings({ report_channel_id: reportChannelId || null })
      setReportChannelId(settings.report_channel_id || '')
      showSnack('Канал отчётов сохранён')
    } catch (requestError) {
      showSnack(errorMessage(requestError), 'error')
    } finally {
      setPendingAction(null)
    }
  }

  const handleDelete = async () => {
    setPendingAction('delete')
    try {
      await deleteTrackedMember(String(deleteTarget.discord_id))
      setDeleteTarget(null)
      await Promise.all([loadMembers(), refreshCurrentPreview()])
      showSnack('Участник удалён')
    } catch (requestError) {
      showSnack(errorMessage(requestError), 'error')
    } finally {
      setPendingAction(null)
    }
  }

  const toggleWeekday = day => {
    setSchedule(current => ({
      ...current,
      work_days: current.work_days.includes(day)
        ? current.work_days.filter(value => value !== day)
        : [...current.work_days, day].sort(),
    }))
  }

  const previewNames = useMemo(() => {
    const names = Object.fromEntries(members.map(member => [String(member.discord_id), member.username || String(member.discord_id)]))
    preview?.members?.forEach(member => { names[String(member.discord_id)] = member.username || names[String(member.discord_id)] })
    return names
  }, [members, preview])

  if (loading) return <LoadingState text="Загрузка настроек отслеживания…" />
  if (error) return <ErrorState message={error} />

  return (
    <PageWrapper>
      <PageHeader
        title="Отслеживание"
        subtitle="Графики участников, канал публикации и ручной предпросмотр отчёта"
      />

      <Panel title="Канал отчётов" sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1.5, alignItems: { sm: 'flex-start' } }}>
          <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 280 } }}>
            <InputLabel id="tracking-channel-label">Канал отчётов</InputLabel>
            <Select
              labelId="tracking-channel-label"
              label="Канал отчётов"
              value={reportChannelId}
              disabled={busy}
              onChange={event => setReportChannelId(event.target.value)}
            >
              <MenuItem value=""><em>Не выбран</em></MenuItem>
              {channels.map(channel => (
                <MenuItem key={channel.id} value={String(channel.id)}>#{channel.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button variant="contained" onClick={handleChannelSave} disabled={busy}>
            {pendingAction === 'channel' ? 'Сохранение…' : 'Сохранить канал'}
          </Button>
        </Box>
      </Panel>

      <Panel title="Отслеживаемые участники" sx={{ mb: 3 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'minmax(260px, 420px) auto' }, gap: 1.5, alignItems: 'start', mb: 2 }}>
          <MemberAutocomplete
            label="Пользователь"
            value={selectedId}
            onChange={(id, member) => {
              setSelectedId(id)
              setSelectedMember(member)
            }}
            disabled={busy}
          />
          <Button variant="contained" onClick={handleAdd} disabled={busy || !selectedId}>
            {pendingAction === 'add' ? 'Добавление…' : 'Добавить'}
          </Button>
        </Box>

        {members.length === 0 ? (
          <EmptyState text="Нет отслеживаемых участников" icon={PersonOutlineOutlined} />
        ) : (
          <TableContainer sx={{ border: '1px solid var(--color-border)', borderRadius: 1.5 }}>
            <Table size="small" aria-label="Отслеживаемые участники">
              <TableHead>
                <TableRow>
                  <TableCell>Участник</TableCell>
                  <TableCell>Рабочие дни</TableCell>
                  <TableCell>Время</TableCell>
                  <TableCell>Часовой пояс</TableCell>
                  <TableCell>Статус</TableCell>
                  <TableCell align="right">Действия</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {members.map(member => {
                  const id = String(member.discord_id)
                  const name = member.username || id
                  return (
                    <TableRow key={id}>
                      <TableCell sx={{ minWidth: 190 }}>
                        <MemberCell id={id} memberData={get(id)} />
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        {member.work_days.map(day => WEEKDAYS.find(item => item.value === day)?.label).join(', ')}
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        {normalizeTime(member.work_start)}–{normalizeTime(member.work_end)}
                      </TableCell>
                      <TableCell>{member.timezone}</TableCell>
                      <TableCell>
                        <StatusBadge tone={member.is_active ? 'success' : 'neutral'}>
                          {member.is_active ? 'Активен' : 'Отключён'}
                        </StatusBadge>
                      </TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                        <Tooltip title="Редактировать график">
                          <IconButton size="small" aria-label={`Редактировать график: ${name}`} onClick={() => openSchedule(member)} disabled={busy}>
                            <EditOutlined sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Удалить">
                          <IconButton size="small" color="error" aria-label={`Удалить: ${name}`} onClick={() => setDeleteTarget(member)} disabled={busy}>
                            <DeleteOutlined sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Panel>

      <Panel
        title="Предпросмотр отчёта"
        sx={{ mb: 3 }}
        action={
          <Box sx={{ display: 'flex', gap: 1 }}>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel id="tracking-period-label">Период</InputLabel>
              <Select labelId="tracking-period-label" label="Период" value={period} onChange={handlePeriodChange}>
                <MenuItem value="today">Сегодня</MenuItem>
                <MenuItem value="week">Неделя</MenuItem>
                <MenuItem value="month">Месяц</MenuItem>
              </Select>
            </FormControl>
            <Tooltip title="Обновить предпросмотр">
              <span>
                <IconButton aria-label="Обновить предпросмотр" onClick={refreshCurrentPreview} disabled={previewLoading}>
                  <RefreshOutlined />
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        }
      >
        {previewError && <Alert severity="error" sx={{ mb: 2 }}>{previewError}</Alert>}
        {previewLoading ? (
          <LoadingState text="Расчёт отчёта…" />
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 3fr) minmax(320px, 2fr)' }, gap: 2 }}>
            <Box>
              <Typography variant="body2" component="h3" sx={{ color: 'text.secondary', mb: 1 }}>Личная статистика</Typography>
              {preview?.members?.length ? (
                <TableContainer sx={{ border: '1px solid var(--color-border)', borderRadius: 1.5 }}>
                  <Table size="small" aria-label="Личная статистика">
                    <TableHead>
                      <TableRow>
                        <TableCell>Участник</TableCell>
                        <TableCell>Всего</TableCell>
                        <TableCell>Сессии</TableCell>
                        <TableCell>В рабочее время</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {preview.members.map(member => (
                        <TableRow key={member.discord_id}>
                          <TableCell>{member.username || member.discord_id}</TableCell>
                          <TableCell>{durationLabel(member.total_seconds)}</TableCell>
                          <TableCell>{numberLabel(member.session_count)}</TableCell>
                          <TableCell>{durationLabel(member.work_seconds)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : <EmptyState text="Нет личной статистики за период" />}
            </Box>

            <Box>
              <Typography variant="body2" component="h3" sx={{ color: 'text.secondary', mb: 1 }}>Стаки</Typography>
              {preview?.overlaps?.length ? (
                <TableContainer sx={{ border: '1px solid var(--color-border)', borderRadius: 1.5 }}>
                  <Table size="small" aria-label="Стаки участников">
                    <TableHead>
                      <TableRow>
                        <TableCell>Пара</TableCell>
                        <TableCell>Вместе</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {preview.overlaps.map(overlap => (
                        <TableRow key={overlap.member_ids.join('-')}>
                          <TableCell>{overlap.member_ids.map(id => previewNames[String(id)] || id).join(' + ')}</TableCell>
                          <TableCell>{durationLabel(overlap.seconds)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600 }}>Все вместе</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>{durationLabel(preview.all_together_seconds)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : <EmptyState text="Нет пересечений за период" />}
            </Box>
          </Box>
        )}
      </Panel>

      {dailyWorkHours?.days?.length > 0 && (
        <Panel title="Рабочие часы — последние 14 дней" sx={{ mb: 3 }}>
          <DailyWorkHoursChart data={dailyWorkHours} />
        </Panel>
      )}

      <FormDrawer
        open={drawerOpen}
        title="Рабочий график"
        onClose={() => setDrawerOpen(false)}
        onSubmit={handleScheduleSave}
        submitting={busy}
        submitLabel="Сохранить"
      >
        <Typography variant="caption" sx={{ display: 'block', overflowWrap: 'anywhere', color: 'text.secondary' }}>
          {editing?.username || editing?.discord_id}
        </Typography>

        <Box role="group" aria-labelledby="tracking-workdays-label">
          <Typography id="tracking-workdays-label" variant="body2" sx={{ mb: 1 }}>Рабочие дни</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 0.5 }}>
            {WEEKDAYS.map(day => {
              const selected = schedule.work_days.includes(day.value)
              return (
                <Button
                  key={day.value}
                  variant={selected ? 'contained' : 'outlined'}
                  size="small"
                  aria-pressed={selected}
                  onClick={() => toggleWeekday(day.value)}
                  disabled={busy}
                  sx={{ minWidth: 0, px: 0.5 }}
                >
                  {day.label}
                </Button>
              )
            })}
          </Box>
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
          <TextField
            label="Начало рабочего дня"
            type="time"
            value={schedule.work_start}
            disabled={busy}
            onChange={event => setSchedule(current => ({ ...current, work_start: event.target.value }))}
            inputProps={{ step: 60 }}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="Конец рабочего дня"
            type="time"
            value={schedule.work_end}
            disabled={busy}
            onChange={event => setSchedule(current => ({ ...current, work_end: event.target.value }))}
            inputProps={{ step: 60 }}
            InputLabelProps={{ shrink: true }}
          />
        </Box>

        <FormControl size="small" fullWidth>
          <InputLabel id="tracking-timezone-label">Часовой пояс</InputLabel>
          <Select
            labelId="tracking-timezone-label"
            label="Часовой пояс"
            value={schedule.timezone}
            disabled={busy}
            onChange={event => setSchedule(current => ({ ...current, timezone: event.target.value }))}
          >
            {(TIMEZONES.includes(schedule.timezone) ? TIMEZONES : [schedule.timezone, ...TIMEZONES]).map(timezone => (
              <MenuItem key={timezone} value={timezone}>{timezone}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControlLabel
          control={
            <Switch
              checked={schedule.is_active}
              disabled={busy}
              onChange={event => setSchedule(current => ({ ...current, is_active: event.target.checked }))}
              inputProps={{ 'aria-label': 'Активно' }}
            />
          }
          label="Активно"
        />
      </FormDrawer>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Удалить участника?"
        description={`${deleteTarget?.username || deleteTarget?.discord_id} больше не будет участвовать в отчётах.`}
        confirmLabel="Удалить"
        busyLabel="Удаление…"
        busy={pendingAction === 'delete'}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />

      <Snackbar
        open={!!snack}
        autoHideDuration={3000}
        onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={snack?.severity || 'success'} onClose={() => setSnack(null)}>
          {snack?.message}
        </Alert>
      </Snackbar>
    </PageWrapper>
  )
}
