import { useState, useEffect } from 'react'
import {
  Box,
  Button,
  Select,
  MenuItem,
  TextField,
  Switch,
  FormControlLabel,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableContainer,
  Paper,
  IconButton,
  Snackbar,
  Alert,
  Tooltip,
  Typography,
  FormControl,
  InputLabel,
  FormHelperText,
  useMediaQuery,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { AddOutlined, EditOutlined, DeleteOutlined, ListAltOutlined } from '@mui/icons-material'
import { getRules, createRule, updateRule, deleteRule, toggleRule } from '../api/rules'
import {
  ActionChip,
  PageHeader,
  LoadingState,
  ErrorState,
  EmptyState,
  StatusBadge,
  FormDrawer,
  ConfirmDialog,
} from '../components/ui'
import { PageWrapper } from '../styles/motion'

const MONO = { fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.72rem' }

const TARGET_LIST_OPTIONS = [
  { value: '', label: 'Все участники' },
  { value: 'whitelist', label: 'Белый список' },
  { value: 'blacklist', label: 'Чёрный список' },
]

const ACTION_TYPE_OPTIONS = [
  { value: 'mute', label: 'Заглушить' },
  { value: 'unmute', label: 'Снять заглушение' },
  { value: 'move', label: 'Переместить' },
  { value: 'kick', label: 'Кикнуть' },
]

function targetListLabel(value) {
  return TARGET_LIST_OPTIONS.find(o => o.value === value)?.label
}

function formatChannelIds(channelIds) {
  return Array.isArray(channelIds) && channelIds.length ? channelIds.join(', ') : 'Все'
}

function formatMaxTime(seconds) {
  return seconds ? `${Math.round(seconds / 60)} мин` : '—'
}

// Row-level building blocks shared between the mobile RuleRecord card and
// the desktop table row so each piece of markup/logic exists once.
function TargetListBadge({ targetList }) {
  return targetList ? (
    <StatusBadge tone={targetList === 'whitelist' ? 'success' : 'danger'}>
      {targetListLabel(targetList)}
    </StatusBadge>
  ) : (
    <Typography sx={{ color: 'text.disabled', fontSize: '0.72rem' }}>Все участники</Typography>
  )
}

function RuleStatusToggle({ rule, pending, onToggle }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Switch
        checked={rule.is_active}
        size="small"
        disabled={pending}
        onChange={() => onToggle(rule)}
        inputProps={{ 'aria-label': `Переключить: ${rule.name}` }}
      />
      <StatusBadge tone={rule.is_active ? 'success' : 'neutral'}>
        {rule.is_active ? 'Активно' : 'Неактивно'}
      </StatusBadge>
    </Box>
  )
}

function RuleRowActions({ rule, pending, onEdit, onDelete }) {
  return (
    <Box sx={{ display: 'flex', gap: 0.5 }}>
      <Tooltip title={`Редактировать: ${rule.name}`}>
        <IconButton
          size="small"
          aria-label={`Редактировать: ${rule.name}`}
          onClick={() => onEdit(rule)}
        >
          <EditOutlined sx={{ fontSize: 15 }} />
        </IconButton>
      </Tooltip>
      <Tooltip title={`Удалить: ${rule.name}`}>
        <IconButton
          size="small"
          color="error"
          aria-label={`Удалить: ${rule.name}`}
          onClick={() => onDelete(rule)}
          disabled={pending}
        >
          <DeleteOutlined sx={{ fontSize: 15 }} />
        </IconButton>
      </Tooltip>
    </Box>
  )
}

const defaultForm = () => ({
  name: '',
  description: '',
  target_list: '',
  channel_ids: '',
  max_time_sec: '',
  action_type: '',
  action_params: '{}',
  priority: 0,
  is_active: true,
  is_dry_run: false,
})

// Compact labelled record used in place of a horizontally-scrolling table
// row on small screens — mirrors Dashboard.jsx's RuleRecord composition.
function RuleRecord({ rule, pending, onEdit, onDelete, onToggle }) {
  const hasChannels = Array.isArray(rule.channel_ids) && rule.channel_ids.length > 0
  return (
    <Box sx={{ border: '1px solid var(--color-border)', borderRadius: 2, p: 1.75 }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 1,
          mb: 1,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ color: 'text.primary', fontWeight: 600, fontSize: '0.85rem' }}>
            {rule.name}
          </Typography>
          <Typography sx={{ ...MONO, color: 'text.secondary', fontSize: '0.68rem' }}>
            #{rule.id}
          </Typography>
        </Box>
        <RuleRowActions rule={rule} pending={pending} onEdit={onEdit} onDelete={onDelete} />
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>
        <ActionChip type={rule.action_type} isDryRun={rule.is_dry_run} />
        <TargetListBadge targetList={rule.target_list} />
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, mb: 1 }}>
        <Typography sx={{ ...MONO, color: hasChannels ? 'text.secondary' : 'text.disabled' }}>
          Каналы: {formatChannelIds(rule.channel_ids)}
        </Typography>
        <Typography sx={{ ...MONO, color: rule.max_time_sec ? 'text.secondary' : 'text.disabled' }}>
          Макс. время: {formatMaxTime(rule.max_time_sec)}
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography sx={{ ...MONO, color: 'text.secondary' }}>
          Приоритет: {rule.priority}
        </Typography>
        <RuleStatusToggle rule={rule} pending={pending} onToggle={onToggle} />
      </Box>
    </Box>
  )
}

export default function Rules() {
  const theme = useTheme()
  const isCompact = useMediaQuery(theme.breakpoints.down('sm'))

  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(defaultForm())
  const [errors, setErrors] = useState({})
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [pendingRuleIds, setPendingRuleIds] = useState(() => new Set())
  const [snack, setSnack] = useState(null)

  const load = async () => {
    try {
      setRules(await getRules())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const showSnack = (msg, severity = 'success') => setSnack({ msg, severity })

  const openCreate = () => {
    setEditing(null)
    setForm(defaultForm())
    setErrors({})
    setDrawerOpen(true)
  }

  const openEdit = rule => {
    setEditing(rule)
    setForm({
      name: rule.name || '',
      description: rule.description || '',
      target_list: rule.target_list || '',
      channel_ids: (rule.channel_ids || []).join(', '),
      max_time_sec: rule.max_time_sec ?? '',
      action_type: rule.action_type || '',
      action_params:
        typeof rule.action_params === 'object'
          ? JSON.stringify(rule.action_params, null, 2)
          : rule.action_params || '{}',
      priority: rule.priority ?? 0,
      is_active: rule.is_active,
      is_dry_run: rule.is_dry_run,
    })
    setErrors({})
    setDrawerOpen(true)
  }

  const closeDrawer = () => setDrawerOpen(false)

  const handleSave = async () => {
    const nextErrors = {}
    if (!form.name.trim()) nextErrors.name = 'Название обязательно'
    if (!form.action_type) nextErrors.action_type = 'Действие обязательно'
    const channelIdTokens = form.channel_ids
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
    if (channelIdTokens.some(token => Number.isNaN(Number(token)))) {
      nextErrors.channel_ids = 'Каналы должны быть числовыми ID через запятую'
    }
    let action_params
    try {
      action_params = JSON.parse(form.action_params || '{}')
    } catch {
      nextErrors.action_params = 'Невалидный JSON'
    }
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors)
      return
    }
    setErrors({})

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() ? form.description.trim() : null,
      target_list: form.target_list || null,
      channel_ids: channelIdTokens.map(Number),
      max_time_sec: form.max_time_sec !== '' ? Number(form.max_time_sec) : null,
      action_type: form.action_type,
      action_params,
      priority: Number(form.priority) || 0,
      is_active: form.is_active,
      is_dry_run: form.is_dry_run,
    }

    setSaving(true)
    try {
      if (editing) {
        await updateRule(editing.id, payload)
        showSnack('Правило обновлено')
      } else {
        await createRule(payload)
        showSnack('Правило создано')
      }
      setDrawerOpen(false)
      load()
    } catch (e) {
      showSnack(e.response?.data?.detail || 'Ошибка сохранения', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteRule(deleteTarget.id)
      showSnack('Правило удалено')
      setDeleteTarget(null)
      load()
    } catch (e) {
      showSnack(e.response?.data?.detail || 'Ошибка удаления', 'error')
    } finally {
      setDeleting(false)
    }
  }

  const handleToggle = async rule => {
    if (pendingRuleIds.has(rule.id)) return
    setPendingRuleIds(prev => new Set(prev).add(rule.id))
    try {
      await toggleRule(rule.id)
      await load()
    } catch (e) {
      showSnack(e.response?.data?.detail || 'Ошибка', 'error')
    } finally {
      setPendingRuleIds(prev => {
        const next = new Set(prev)
        next.delete(rule.id)
        return next
      })
    }
  }

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} />

  return (
    <PageWrapper>
      <PageHeader
        title="Правила"
        subtitle="Управление правилами обработки голосовых событий"
        actions={
          <Button variant="contained" startIcon={<AddOutlined />} onClick={openCreate}>
            Создать правило
          </Button>
        }
      />

      {rules.length === 0 ? (
        <EmptyState text="Нет правил" icon={ListAltOutlined} />
      ) : isCompact ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {rules.map(r => (
            <RuleRecord
              key={r.id}
              rule={r}
              pending={pendingRuleIds.has(r.id)}
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
                <TableCell>Название</TableCell>
                <TableCell>Список</TableCell>
                <TableCell>Каналы</TableCell>
                <TableCell>Макс. время</TableCell>
                <TableCell>Действие</TableCell>
                <TableCell>Приоритет</TableCell>
                <TableCell>Статус</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {rules.map(r => {
                const pending = pendingRuleIds.has(r.id)
                return (
                  <TableRow key={r.id}>
                    <TableCell sx={MONO}>{r.id}</TableCell>
                    <TableCell sx={{ color: 'text.primary' }}>{r.name}</TableCell>
                    <TableCell>
                      <TargetListBadge targetList={r.target_list} />
                    </TableCell>
                    <TableCell
                      sx={{
                        color:
                          Array.isArray(r.channel_ids) && r.channel_ids.length
                            ? 'text.primary'
                            : 'text.disabled',
                        ...MONO,
                      }}
                    >
                      {formatChannelIds(r.channel_ids)}
                    </TableCell>
                    <TableCell sx={MONO}>
                      {r.max_time_sec ? (
                        formatMaxTime(r.max_time_sec)
                      ) : (
                        <Typography sx={{ color: 'text.disabled', fontSize: '0.72rem' }}>
                          —
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <ActionChip type={r.action_type} isDryRun={r.is_dry_run} />
                    </TableCell>
                    <TableCell sx={MONO}>{r.priority}</TableCell>
                    <TableCell>
                      <RuleStatusToggle rule={r} pending={pending} onToggle={handleToggle} />
                    </TableCell>
                    <TableCell>
                      <RuleRowActions
                        rule={r}
                        pending={pending}
                        onEdit={openEdit}
                        onDelete={setDeleteTarget}
                      />
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
        title={editing ? 'Редактировать правило' : 'Новое правило'}
        onClose={closeDrawer}
        onSubmit={handleSave}
        submitting={saving}
        submitLabel="Сохранить"
      >
        <TextField
          label="Название"
          fullWidth
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          error={!!errors.name}
          helperText={errors.name}
          required
        />

        <TextField
          label="Описание"
          fullWidth
          multiline
          rows={2}
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
        />

        <FormControl fullWidth>
          <InputLabel id="rule-target-list-label">Список</InputLabel>
          <Select
            labelId="rule-target-list-label"
            value={form.target_list}
            label="Список"
            onChange={e => setForm(f => ({ ...f, target_list: e.target.value }))}
          >
            {TARGET_LIST_OPTIONS.map(o => (
              <MenuItem key={o.value || 'all'} value={o.value}>
                {o.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <TextField
          label="Каналы (ID через запятую, пусто = все)"
          fullWidth
          value={form.channel_ids}
          onChange={e => setForm(f => ({ ...f, channel_ids: e.target.value }))}
          placeholder="123456789, 987654321"
          error={!!errors.channel_ids}
          helperText={errors.channel_ids}
          inputProps={{ style: { fontFamily: "'IBM Plex Mono', monospace" } }}
        />

        <TextField
          label="Макс. время (секунды)"
          fullWidth
          type="number"
          value={form.max_time_sec}
          onChange={e => setForm(f => ({ ...f, max_time_sec: e.target.value }))}
          placeholder="например 3600"
        />

        <FormControl fullWidth required error={!!errors.action_type}>
          <InputLabel id="rule-action-type-label">Действие</InputLabel>
          <Select
            labelId="rule-action-type-label"
            value={form.action_type}
            label="Действие"
            onChange={e => setForm(f => ({ ...f, action_type: e.target.value }))}
          >
            {ACTION_TYPE_OPTIONS.map(o => (
              <MenuItem key={o.value} value={o.value}>
                {o.label}
              </MenuItem>
            ))}
          </Select>
          {errors.action_type && <FormHelperText>{errors.action_type}</FormHelperText>}
        </FormControl>

        <TextField
          label="Параметры действия (JSON)"
          fullWidth
          multiline
          rows={3}
          value={form.action_params}
          onChange={e => setForm(f => ({ ...f, action_params: e.target.value }))}
          error={!!errors.action_params}
          helperText={errors.action_params}
          inputProps={{ style: { fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.75rem' } }}
        />

        <TextField
          label="Приоритет"
          fullWidth
          type="number"
          value={form.priority}
          onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
        />

        <FormControlLabel
          control={
            <Switch
              checked={form.is_active}
              onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
            />
          }
          label="Активно"
        />

        <FormControlLabel
          control={
            <Switch
              checked={form.is_dry_run}
              onChange={e => setForm(f => ({ ...f, is_dry_run: e.target.checked }))}
            />
          }
          label="Пробный запуск (dry run)"
        />
      </FormDrawer>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Удалить правило?"
        description={`Правило «${deleteTarget?.name}» будет удалено.`}
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
