import { useState, useEffect } from 'react'
import {
  Box,
  Button,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableContainer,
  Paper,
  IconButton,
  TextField,
  Typography,
  Tooltip,
  Snackbar,
  Alert,
  useMediaQuery,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { AddOutlined, EditOutlined, DeleteOutlined, FlashOffOutlined } from '@mui/icons-material'
import {
  getKickTargets,
  createKickTarget,
  updateKickTarget,
  deleteKickTarget,
} from '../api/kickTargets'
import {
  MemberCell,
  MemberAutocomplete,
  PageHeader,
  LoadingState,
  ErrorState,
  EmptyState,
  StatusBadge,
  FormDrawer,
  ConfirmDialog,
} from '../components/ui'
import { useMemberResolver } from '../hooks/useMemberResolver'
import { PageWrapper } from '../styles/motion'

const MONO = { fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.72rem' }

function minutesToSeconds(minutes) {
  return Math.round(Number(minutes) * 60)
}

function secondsToMinutesLabel(seconds) {
  return seconds ? `${Math.round(seconds / 60)} мин` : '—'
}

function targetName(target, memberData) {
  return memberData?.display_name || target.username || target.discord_id
}

const defaultForm = () => ({ discord_id: null, minMinutes: '30', maxMinutes: '' })

// Row-level building blocks shared between the mobile KickTargetRecord card
// and the desktop table row — mirrors Rules.jsx's shared-row-helper pattern.
function KickTargetStatusToggle({ target, name, pending, onToggle }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Switch
        checked={target.is_active}
        size="small"
        disabled={pending}
        onChange={() => onToggle(target)}
        inputProps={{ 'aria-label': `Переключить: ${name}` }}
      />
      <StatusBadge tone={target.is_active ? 'success' : 'neutral'}>
        {target.is_active ? 'Включено' : 'Отключено'}
      </StatusBadge>
    </Box>
  )
}

function KickTargetRowActions({ target, name, pending, onEdit, onDelete }) {
  return (
    <Box sx={{ display: 'flex', gap: 0.5 }}>
      <Tooltip title={`Редактировать: ${name}`}>
        <IconButton
          size="small"
          aria-label={`Редактировать: ${name}`}
          onClick={() => onEdit(target)}
        >
          <EditOutlined sx={{ fontSize: 15 }} />
        </IconButton>
      </Tooltip>
      <Tooltip title={`Удалить: ${name}`}>
        <IconButton
          size="small"
          color="error"
          aria-label={`Удалить: ${name}`}
          onClick={() => onDelete(target)}
          disabled={pending}
        >
          <DeleteOutlined sx={{ fontSize: 15 }} />
        </IconButton>
      </Tooltip>
    </Box>
  )
}

function KickTargetRecord({ target, memberData, pending, onEdit, onDelete, onToggle }) {
  const name = targetName(target, memberData)
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
        <MemberCell id={String(target.discord_id)} memberData={memberData} />
        <KickTargetRowActions
          target={target}
          name={name}
          pending={pending}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, mb: 1 }}>
        <Typography sx={{ ...MONO, color: 'text.secondary' }}>
          Мин.: {secondsToMinutesLabel(target.timeout_sec)}
        </Typography>
        <Typography
          sx={{ ...MONO, color: target.max_timeout_sec ? 'text.secondary' : 'text.disabled' }}
        >
          Макс.: {secondsToMinutesLabel(target.max_timeout_sec)}
        </Typography>
      </Box>
      <KickTargetStatusToggle target={target} name={name} pending={pending} onToggle={onToggle} />
    </Box>
  )
}

export default function KickTargets() {
  const theme = useTheme()
  const isCompact = useMediaQuery(theme.breakpoints.down('sm'))

  const [targets, setTargets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(defaultForm())
  const [errors, setErrors] = useState({})
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [pendingTargetIds, setPendingTargetIds] = useState(() => new Set())
  const [snack, setSnack] = useState(null)
  const { get, resolveMany } = useMemberResolver()

  const load = async () => {
    try {
      const data = await getKickTargets()
      setTargets(data)
      resolveMany(data.map(t => String(t.discord_id)))
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

  const openEdit = t => {
    setEditing(t)
    setForm({
      discord_id: String(t.discord_id),
      minMinutes: String(Math.round(t.timeout_sec / 60)),
      maxMinutes: t.max_timeout_sec != null ? String(Math.round(t.max_timeout_sec / 60)) : '',
    })
    setErrors({})
    setDrawerOpen(true)
  }

  const closeDrawer = () => setDrawerOpen(false)

  const handleSave = async () => {
    const nextErrors = {}
    if (!form.discord_id) nextErrors.discord_id = 'Выберите участника'
    const minMinutes = Number(form.minMinutes)
    if (!form.minMinutes || !(minMinutes > 0)) {
      nextErrors.minMinutes = 'Минимальное время должно быть больше нуля'
    }
    if (form.maxMinutes !== '') {
      const maxMinutes = Number(form.maxMinutes)
      if (Number.isNaN(maxMinutes)) {
        nextErrors.maxMinutes = 'Максимальное время должно быть числом'
      } else if (minMinutes > 0 && maxMinutes < minMinutes) {
        nextErrors.maxMinutes = 'Максимальное время не может быть меньше минимального'
      }
    }
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors)
      return
    }
    setErrors({})

    const memberData = get(form.discord_id)
    const payload = {
      discord_id: form.discord_id,
      username: memberData?.username || null,
      timeout_sec: minutesToSeconds(form.minMinutes),
      max_timeout_sec: form.maxMinutes !== '' ? minutesToSeconds(form.maxMinutes) : null,
    }
    setSaving(true)
    try {
      if (editing) {
        await updateKickTarget(editing.discord_id, payload)
        showSnack('Цель обновлена')
      } else {
        await createKickTarget(payload)
        showSnack('Цель добавлена')
      }
      setDrawerOpen(false)
      load()
    } catch (e) {
      showSnack(e.response?.data?.detail || 'Ошибка сохранения', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async t => {
    const id = t.discord_id
    if (pendingTargetIds.has(id)) return
    setPendingTargetIds(prev => new Set(prev).add(id))
    try {
      await updateKickTarget(id, { is_active: !t.is_active })
      await load()
    } catch (e) {
      showSnack(e.response?.data?.detail || 'Ошибка', 'error')
    } finally {
      setPendingTargetIds(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteKickTarget(deleteTarget.discord_id)
      showSnack('Цель удалена')
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
        title="Кик-цели"
        subtitle="Автоматический кик участников по истечении таймаута в голосовом канале"
        actions={
          <Button variant="contained" startIcon={<AddOutlined />} onClick={openCreate}>
            Добавить
          </Button>
        }
      />

      {targets.length === 0 ? (
        <EmptyState
          text="Нет целей для автоматического кика. Добавьте цель через кнопку выше."
          icon={FlashOffOutlined}
        />
      ) : isCompact ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {targets.map(t => (
            <KickTargetRecord
              key={t.discord_id}
              target={t}
              memberData={get(String(t.discord_id))}
              pending={pendingTargetIds.has(t.discord_id)}
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
                <TableCell>Участник</TableCell>
                <TableCell>Минимальное время</TableCell>
                <TableCell>Максимальное время</TableCell>
                <TableCell>Статус</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {targets.map(t => {
                const pending = pendingTargetIds.has(t.discord_id)
                const memberData = get(String(t.discord_id))
                const name = targetName(t, memberData)
                return (
                  <TableRow key={t.discord_id}>
                    <TableCell sx={{ minWidth: 200 }}>
                      <MemberCell id={String(t.discord_id)} memberData={memberData} />
                    </TableCell>
                    <TableCell sx={MONO}>{secondsToMinutesLabel(t.timeout_sec)}</TableCell>
                    <TableCell
                      sx={{ ...MONO, color: t.max_timeout_sec ? 'text.primary' : 'text.disabled' }}
                    >
                      {secondsToMinutesLabel(t.max_timeout_sec)}
                    </TableCell>
                    <TableCell>
                      <KickTargetStatusToggle
                        target={t}
                        name={name}
                        pending={pending}
                        onToggle={handleToggle}
                      />
                    </TableCell>
                    <TableCell>
                      <KickTargetRowActions
                        target={t}
                        name={name}
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
        title={editing ? 'Редактировать кик-цель' : 'Новая кик-цель'}
        onClose={closeDrawer}
        onSubmit={handleSave}
        submitting={saving}
        submitLabel="Сохранить"
        width={420}
      >
        <MemberAutocomplete
          label="Участник"
          value={form.discord_id}
          onChange={id => setForm(f => ({ ...f, discord_id: id }))}
          error={!!errors.discord_id}
          helperText={errors.discord_id}
          disabled={!!editing}
        />
        <TextField
          label="Минимальное время"
          fullWidth
          type="number"
          value={form.minMinutes}
          onChange={e => setForm(f => ({ ...f, minMinutes: e.target.value }))}
          error={!!errors.minMinutes}
          helperText={errors.minMinutes || 'В минутах, до кика'}
        />
        <TextField
          label="Максимальное время"
          fullWidth
          type="number"
          value={form.maxMinutes}
          onChange={e => setForm(f => ({ ...f, maxMinutes: e.target.value }))}
          error={!!errors.maxMinutes}
          helperText={
            errors.maxMinutes || 'В минутах, необязательно — рандомизирует таймаут в диапазоне'
          }
        />
      </FormDrawer>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Удалить цель кика?"
        description={`Цель «${targetName(deleteTarget || {}, get(String(deleteTarget?.discord_id)))}» будет удалена из списка автокика.`}
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
