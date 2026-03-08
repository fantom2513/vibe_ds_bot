import { useState, useEffect } from 'react'
import {
  Box, Button, Switch, FormControlLabel,
  Table, TableBody, TableCell, TableHead, TableRow, TableContainer,
  Paper, IconButton, Drawer, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Typography, Tooltip, Snackbar, Alert,
  FormControl, InputLabel, Select, MenuItem,
} from '@mui/material'
import { AddOutlined, EditOutlined, DeleteOutlined } from '@mui/icons-material'
import cronstrue from 'cronstrue/i18n'
import { getSchedules, createSchedule, updateSchedule, deleteSchedule } from '../api/schedules'
import { getRules } from '../api/rules'
import { PageHeader, LoadingState, ErrorState, EmptyState } from '../components/ui'
import { PageWrapper } from '../styles/motion'

const MONO = { fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.72rem' }

const TIMEZONES = [
  'Europe/Moscow', 'Europe/London', 'Europe/Berlin', 'Europe/Paris',
  'America/New_York', 'America/Chicago', 'America/Los_Angeles',
  'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Kolkata', 'Australia/Sydney',
  'UTC',
]

function cronDescription(expr) {
  try {
    return cronstrue.toString(expr, { locale: 'ru', throwExceptionOnParseError: true })
  } catch {
    return null
  }
}

const defaultForm = () => ({
  rule_id: '',
  cron_expr: '',
  timezone: 'Europe/Moscow',
  action: 'enable',
  is_active: true,
})

export default function Schedules() {
  const [schedules, setSchedules] = useState([])
  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(defaultForm())
  const [cronPreview, setCronPreview] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
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
    setDrawerOpen(true)
  }

  const openEdit = (s) => {
    setEditing(s)
    setForm({
      rule_id: s.rule_id,
      cron_expr: s.cron_expr,
      timezone: s.timezone,
      action: s.action,
      is_active: s.is_active,
    })
    setCronPreview(cronDescription(s.cron_expr) || '')
    setDrawerOpen(true)
  }

  const handleSave = async () => {
    if (!form.rule_id || !form.cron_expr) {
      showSnack('Заполните все обязательные поля', 'error')
      return
    }
    setSaving(true)
    try {
      if (editing) {
        await updateSchedule(editing.id, form)
        showSnack('Расписание обновлено')
      } else {
        await createSchedule(form)
        showSnack('Расписание создано')
      }
      setDrawerOpen(false)
      load()
    } catch (e) {
      showSnack(e.response?.data?.detail || 'Ошибка', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    try {
      await deleteSchedule(deleteTarget.id)
      showSnack('Удалено')
      setDeleteTarget(null)
      load()
    } catch (e) {
      showSnack(e.response?.data?.detail || 'Ошибка', 'error')
    }
  }

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} />

  return (
    <PageWrapper>
      <PageHeader
        title="Schedules"
        subtitle="Cron-расписания включения/отключения правил"
        actions={
          <Button variant="contained" startIcon={<AddOutlined />} onClick={openCreate}>
            Новое расписание
          </Button>
        }
      />

      {schedules.length === 0 ? (
        <EmptyState text="Нет расписаний" icon="🕐" />
      ) : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Rule ID</TableCell>
                <TableCell>Cron</TableCell>
                <TableCell>Timezone</TableCell>
                <TableCell>Action</TableCell>
                <TableCell>Активно</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {schedules.map(s => (
                <TableRow key={s.id}>
                  <TableCell sx={MONO}>{s.id}</TableCell>
                  <TableCell sx={MONO}>{s.rule_id}</TableCell>
                  <TableCell sx={{ ...MONO, color: 'var(--text-mono)' }}>{s.cron_expr}</TableCell>
                  <TableCell sx={{ fontSize: '0.82rem' }}>{s.timezone}</TableCell>
                  <TableCell>
                    <Box component="span" sx={{
                      px: 0.75, py: '2px', borderRadius: '4px', ...MONO,
                      backgroundColor: s.action === 'enable' ? 'rgba(34,211,165,0.10)' : 'rgba(244,63,94,0.10)',
                      color: s.action === 'enable' ? '#22d3a5' : '#f43f5e',
                      border: `1px solid ${s.action === 'enable' ? 'rgba(34,211,165,0.30)' : 'rgba(244,63,94,0.30)'}`,
                    }}>
                      {s.action}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box component="span" sx={{
                      px: 0.75, py: '2px', borderRadius: '4px', ...MONO,
                      backgroundColor: s.is_active ? 'rgba(34,211,165,0.10)' : 'rgba(71,85,105,0.15)',
                      color: s.is_active ? '#22d3a5' : '#475569',
                      border: `1px solid ${s.is_active ? 'rgba(34,211,165,0.30)' : 'rgba(71,85,105,0.30)'}`,
                    }}>
                      {s.is_active ? 'Да' : 'Нет'}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <Tooltip title="Редактировать">
                        <IconButton size="small" onClick={() => openEdit(s)}>
                          <EditOutlined sx={{ fontSize: 15 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Удалить">
                        <IconButton size="small" color="error" onClick={() => setDeleteTarget(s)}>
                          <DeleteOutlined sx={{ fontSize: 15 }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{ sx: { width: 480, p: 3 } }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h6" sx={{ fontSize: '1rem' }}>
            {editing ? 'Редактировать расписание' : 'Новое расписание'}
          </Typography>
          <Button variant="contained" size="small" onClick={handleSave} disabled={saving}>
            {saving ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <FormControl size="small" fullWidth required>
            <InputLabel>Rule *</InputLabel>
            <Select
              value={form.rule_id}
              label="Rule *"
              onChange={e => setForm(f => ({ ...f, rule_id: e.target.value }))}
            >
              {rules.map(r => (
                <MenuItem key={r.id} value={r.id}>
                  #{r.id} — {r.action_type} ({r.target_list || 'all'})
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label="Cron Expression *"
            size="small"
            fullWidth
            value={form.cron_expr}
            onChange={e => {
              const v = e.target.value
              setForm(f => ({ ...f, cron_expr: v }))
              setCronPreview(cronDescription(v) || '')
            }}
            placeholder="0 22 * * *"
            inputProps={{ style: { fontFamily: "'IBM Plex Mono', monospace" } }}
            helperText={cronPreview
              ? <span style={{ color: '#22d3a5' }}>{cronPreview}</span>
              : 'Пример: 0 22 * * * (каждый день в 22:00)'
            }
          />

          <FormControl size="small" fullWidth>
            <InputLabel>Timezone</InputLabel>
            <Select
              value={form.timezone}
              label="Timezone"
              onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))}
            >
              {TIMEZONES.map(tz => (
                <MenuItem key={tz} value={tz}>{tz}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" fullWidth>
            <InputLabel>Action</InputLabel>
            <Select
              value={form.action}
              label="Action"
              onChange={e => setForm(f => ({ ...f, action: e.target.value }))}
            >
              <MenuItem value="enable">enable</MenuItem>
              <MenuItem value="disable">disable</MenuItem>
            </Select>
          </FormControl>

          <FormControlLabel
            control={
              <Switch
                checked={form.is_active}
                onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
              />
            }
            label="Активно"
          />
        </Box>
      </Drawer>

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Удалить расписание?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Расписание #{deleteTarget?.id} ({deleteTarget?.cron_expr}) будет удалено.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Отмена</Button>
          <Button color="error" variant="contained" onClick={handleDelete}>Удалить</Button>
        </DialogActions>
      </Dialog>

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
