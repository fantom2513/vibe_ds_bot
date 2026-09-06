import { useState, useEffect } from 'react'
import {
  Box, Button, Switch,
  Table, TableBody, TableCell, TableHead, TableRow, TableContainer,
  Paper, IconButton, TextField, Typography, Tooltip, Snackbar, Alert,
  FormControl, InputLabel, Select, MenuItem, FormHelperText, useMediaQuery,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { AddOutlined, EditOutlined, DeleteOutlined, AccessTimeOutlined } from '@mui/icons-material'
import cronstrue from 'cronstrue/i18n'
import { getSchedules, createSchedule, updateSchedule, deleteSchedule } from '../api/schedules'
import { getRules } from '../api/rules'
import {
  PageHeader, LoadingState, ErrorState, EmptyState, StatusBadge, FormDrawer, ConfirmDialog,
} from '../components/ui'
import { PageWrapper } from '../styles/motion'

const MONO = { fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.72rem' }

const TIMEZONES = [
  'Europe/Moscow', 'Europe/London', 'Europe/Berlin', 'Europe/Paris',
  'America/New_York', 'America/Chicago', 'America/Los_Angeles',
  'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Kolkata', 'Australia/Sydney',
  'UTC',
]

const ACTION_OPTIONS = [
  { value: 'enable', label: 'Включить правило' },
  { value: 'disable', label: 'Отключить правило' },
]

function actionLabel(value) {
  return ACTION_OPTIONS.find(o => o.value === value)?.label || value
}

// enable is a permissive/positive action (mint success, mirrors "Активно"),
// disable is a restrictive one (amber warning, mirrors ActionChip's "mute").
function actionTone(value) {
  return value === 'enable' ? 'success' : 'warning'
}

function cronDescription(expr) {
  try {
    return cronstrue.toString(expr, { locale: 'ru', throwExceptionOnParseError: true })
  } catch {
    return null
  }
}

function ruleName(ruleId, rules) {
  const rule = rules.find(r => r.id === ruleId)
  return rule ? rule.name : `Правило #${ruleId} (не найдено)`
}

const defaultForm = () => ({
  rule_id: '',
  cron_expr: '',
  timezone: 'Europe/Moscow',
  action: 'enable',
  is_active: true,
})

// Row-level building blocks shared between the mobile ScheduleRecord card
// and the desktop table row so each piece of markup/logic exists once —
// mirrors Rules.jsx's shared-row-helper pattern.
function CronCell({ cronExpr }) {
  const preview = cronDescription(cronExpr)
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography sx={{ ...MONO, color: 'text.primary' }}>{cronExpr}</Typography>
      <Typography sx={{ color: preview ? 'text.secondary' : 'text.disabled', fontSize: '0.72rem' }}>
        {preview || 'Описание недоступно'}
      </Typography>
    </Box>
  )
}

function ScheduleStatusToggle({ schedule, pending, onToggle }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Switch
        checked={schedule.is_active}
        size="small"
        disabled={pending}
        onChange={() => onToggle(schedule)}
        inputProps={{ 'aria-label': `Переключить: расписание #${schedule.id}` }}
      />
      <StatusBadge tone={schedule.is_active ? 'success' : 'neutral'}>
        {schedule.is_active ? 'Активно' : 'Неактивно'}
      </StatusBadge>
    </Box>
  )
}

function ScheduleRowActions({ schedule, pending, onEdit, onDelete }) {
  return (
    <Box sx={{ display: 'flex', gap: 0.5 }}>
      <Tooltip title={`Редактировать: расписание #${schedule.id}`}>
        <IconButton size="small" aria-label={`Редактировать: расписание #${schedule.id}`} onClick={() => onEdit(schedule)}>
          <EditOutlined sx={{ fontSize: 15 }} />
        </IconButton>
      </Tooltip>
      <Tooltip title={`Удалить: расписание #${schedule.id}`}>
        <IconButton size="small" color="error" aria-label={`Удалить: расписание #${schedule.id}`} onClick={() => onDelete(schedule)} disabled={pending}>
          <DeleteOutlined sx={{ fontSize: 15 }} />
        </IconButton>
      </Tooltip>
    </Box>
  )
}

function ScheduleRecord({ schedule, rules, pending, onEdit, onDelete, onToggle }) {
  return (
    <Box sx={{ border: '1px solid var(--color-border)', borderRadius: 2, p: 1.75 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1, mb: 1 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ color: 'text.primary', fontWeight: 600, fontSize: '0.85rem' }}>
            {ruleName(schedule.rule_id, rules)}
          </Typography>
          <Typography sx={{ ...MONO, color: 'text.secondary', fontSize: '0.68rem' }}>#{schedule.id}</Typography>
        </Box>
        <ScheduleRowActions schedule={schedule} pending={pending} onEdit={onEdit} onDelete={onDelete} />
      </Box>
      <Box sx={{ mb: 1 }}>
        <CronCell cronExpr={schedule.cron_expr} />
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>
        <StatusBadge tone={actionTone(schedule.action)}>{actionLabel(schedule.action)}</StatusBadge>
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography sx={{ ...MONO, color: 'text.secondary' }}>{schedule.timezone}</Typography>
        <ScheduleStatusToggle schedule={schedule} pending={pending} onToggle={onToggle} />
      </Box>
    </Box>
  )
}

export default function Schedules() {
  const theme = useTheme()
  const isCompact = useMediaQuery(theme.breakpoints.down('sm'))

  const [schedules, setSchedules] = useState([])
  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [form, setForm] = useState(defaultForm())
  const [errors, setErrors] = useState({})
  const [cronPreview, setCronPreview] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [pendingScheduleIds, setPendingScheduleIds] = useState(() => new Set())
  const [snack, setSnack] = useState(null)

  const load = async () => {
    try {
      const [s, r] = await Promise.all([getSchedules(), getRules()])
      setSchedules(s)
      setRules(r)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const showSnack = (msg, severity = 'success') => setSnack({ msg, severity })

  const openCreate = () => {
    setEditing(null)
    setForm(defaultForm())
    setCronPreview('')
    setErrors({})
    setSaveError(null)
    setDrawerOpen(true)
  }

  const openEdit = (schedule) => {
    setEditing(schedule)
    setForm({
      rule_id: schedule.rule_id,
      cron_expr: schedule.cron_expr,
      timezone: schedule.timezone,
      action: schedule.action,
      is_active: schedule.is_active,
    })
    setCronPreview(cronDescription(schedule.cron_expr) || '')
    setErrors({})
    setSaveError(null)
    setDrawerOpen(true)
  }

  const closeDrawer = () => setDrawerOpen(false)

  const handleCronChange = (value) => {
    setForm(f => ({ ...f, cron_expr: value }))
    setCronPreview(cronDescription(value) || '')
  }

  const handleSave = async () => {
    const nextErrors = {}
    if (!form.rule_id) nextErrors.rule_id = 'Выберите правило'
    const trimmedCron = form.cron_expr.trim()
    if (!trimmedCron) {
      nextErrors.cron_expr = 'Введите cron-выражение'
    } else if (!cronDescription(trimmedCron)) {
      nextErrors.cron_expr = 'Невалидное cron-выражение'
    }
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors)
      return
    }
    setErrors({})
    setSaveError(null)

    const payload = {
      rule_id: form.rule_id,
      cron_expr: trimmedCron,
      timezone: form.timezone,
      action: form.action,
      is_active: form.is_active,
    }

    setSaving(true)
    try {
      if (editing) {
        await updateSchedule(editing.id, payload)
        showSnack('Расписание обновлено')
      } else {
        await createSchedule(payload)
        showSnack('Расписание создано')
      }
      setDrawerOpen(false)
      load()
    } catch (e) {
      setSaveError(e.response?.data?.detail || 'Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async (schedule) => {
    if (pendingScheduleIds.has(schedule.id)) return
    setPendingScheduleIds(prev => new Set(prev).add(schedule.id))
    try {
      await updateSchedule(schedule.id, { is_active: !schedule.is_active })
      await load()
    } catch (e) {
      showSnack(e.response?.data?.detail || 'Ошибка', 'error')
    } finally {
      setPendingScheduleIds(prev => {
        const next = new Set(prev)
        next.delete(schedule.id)
        return next
      })
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteSchedule(deleteTarget.id)
      showSnack('Расписание удалено')
      setDeleteTarget(null)
      load()
    } catch (e) {
      showSnack(e.response?.data?.detail || 'Ошибка удаления', 'error')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} />

  return (
    <PageWrapper>
      <PageHeader
        title="Расписания"
        subtitle="Cron-расписания включения/отключения правил"
        actions={
          <Button variant="contained" startIcon={<AddOutlined />} onClick={openCreate}>
            Новое расписание
          </Button>
        }
      />

      {schedules.length === 0 ? (
        <EmptyState text="Нет расписаний. Добавьте расписание через кнопку выше." icon={AccessTimeOutlined} />
      ) : isCompact ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {schedules.map(s => (
            <ScheduleRecord
              key={s.id}
              schedule={s}
              rules={rules}
              pending={pendingScheduleIds.has(s.id)}
              onEdit={openEdit}
              onDelete={setDeleteTarget}
              onToggle={handleToggle}
            />
          ))}
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Правило</TableCell>
                <TableCell>Cron</TableCell>
                <TableCell>Часовой пояс</TableCell>
                <TableCell>Действие</TableCell>
                <TableCell>Статус</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {schedules.map(s => {
                const pending = pendingScheduleIds.has(s.id)
                return (
                  <TableRow key={s.id}>
                    <TableCell sx={MONO}>{s.id}</TableCell>
                    <TableCell sx={{ color: 'text.primary' }}>{ruleName(s.rule_id, rules)}</TableCell>
                    <TableCell sx={{ minWidth: 200 }}><CronCell cronExpr={s.cron_expr} /></TableCell>
                    <TableCell sx={{ fontSize: '0.82rem', color: 'text.secondary' }}>{s.timezone}</TableCell>
                    <TableCell><StatusBadge tone={actionTone(s.action)}>{actionLabel(s.action)}</StatusBadge></TableCell>
                    <TableCell>
                      <ScheduleStatusToggle schedule={s} pending={pending} onToggle={handleToggle} />
                    </TableCell>
                    <TableCell>
                      <ScheduleRowActions schedule={s} pending={pending} onEdit={openEdit} onDelete={setDeleteTarget} />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <FormDrawer
        open={drawerOpen}
        title={editing ? 'Редактировать расписание' : 'Новое расписание'}
        onClose={closeDrawer}
        onSubmit={handleSave}
        submitting={saving}
        submitLabel="Сохранить"
        width={460}
      >
        {saveError && (
          <Alert severity="error" onClose={() => setSaveError(null)}>{saveError}</Alert>
        )}

        <FormControl fullWidth required error={!!errors.rule_id}>
          <InputLabel id="schedule-rule-label">Правило</InputLabel>
          <Select
            labelId="schedule-rule-label"
            label="Правило"
            value={form.rule_id}
            onChange={e => setForm(f => ({ ...f, rule_id: e.target.value }))}
          >
            {rules.map(r => (
              <MenuItem key={r.id} value={r.id}>{r.name} · #{r.id}</MenuItem>
            ))}
          </Select>
          {errors.rule_id && <FormHelperText>{errors.rule_id}</FormHelperText>}
        </FormControl>

        <TextField
          label="Cron-выражение"
          fullWidth
          value={form.cron_expr}
          onChange={e => handleCronChange(e.target.value)}
          placeholder="0 22 * * *"
          error={!!errors.cron_expr}
          helperText={errors.cron_expr || cronPreview || 'Например: 0 22 * * * (каждый день в 22:00)'}
          inputProps={{ style: { fontFamily: "'IBM Plex Mono', monospace" } }}
        />

        <FormControl fullWidth>
          <InputLabel id="schedule-timezone-label">Часовой пояс</InputLabel>
          <Select
            labelId="schedule-timezone-label"
            label="Часовой пояс"
            value={form.timezone}
            onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))}
          >
            {TIMEZONES.map(tz => (
              <MenuItem key={tz} value={tz}>{tz}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl fullWidth>
          <InputLabel id="schedule-action-label">Действие</InputLabel>
          <Select
            labelId="schedule-action-label"
            label="Действие"
            value={form.action}
            onChange={e => setForm(f => ({ ...f, action: e.target.value }))}
          >
            {ACTION_OPTIONS.map(o => (
              <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </FormDrawer>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Удалить расписание?"
        description={`Расписание «${deleteTarget ? ruleName(deleteTarget.rule_id, rules) : ''}» (#${deleteTarget?.id}) будет удалено.`}
        confirmLabel="Удалить"
        busyLabel="Удаление…"
        busy={deleting}
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
          {snack?.msg}
        </Alert>
      </Snackbar>
    </PageWrapper>
  )
}
