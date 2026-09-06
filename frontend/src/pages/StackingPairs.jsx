import { useState, useEffect } from 'react'
import {
  Box, Button, Switch,
  Table, TableBody, TableCell, TableHead, TableRow, TableContainer,
  Paper, IconButton, TextField, Typography, Tooltip, Snackbar, Alert,
  useMediaQuery,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { AddOutlined, DeleteOutlined, PeopleOutlineOutlined } from '@mui/icons-material'
import { getStackingPairs, createStackingPair, toggleStackingPair, deleteStackingPair } from '../api/stackingPairs'
import {
  MemberCell, MemberAutocomplete, PageHeader, LoadingState, ErrorState, EmptyState,
  StatusBadge, FormDrawer, ConfirmDialog,
} from '../components/ui'
import { useMemberResolver } from '../hooks/useMemberResolver'
import { PageWrapper } from '../styles/motion'
import Timestamp from '../components/Timestamp'

const MONO = { fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.72rem' }

const defaultForm = () => ({ user_id_1: null, user_id_2: null, target_channel_id: '' })

// Compact composition rendering both members of a pair — reused by the
// mobile card and (as two adjacent cells) implied by the desktop table row,
// mirroring Rules.jsx's shared-row-helper pattern.
function PairMembersRow({ pair, getMember }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
      <MemberCell id={String(pair.user_id_1)} memberData={getMember(String(pair.user_id_1))} />
      <MemberCell id={String(pair.user_id_2)} memberData={getMember(String(pair.user_id_2))} />
    </Box>
  )
}

function PairStatusToggle({ pair, pending, onToggle }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Switch
        checked={pair.is_active}
        size="small"
        disabled={pending}
        onChange={() => onToggle(pair)}
        inputProps={{ 'aria-label': `Переключить пару: #${pair.id}` }}
      />
      <StatusBadge tone={pair.is_active ? 'success' : 'neutral'}>
        {pair.is_active ? 'Включено' : 'Отключено'}
      </StatusBadge>
    </Box>
  )
}

function PairRowActions({ pair, pending, onDelete }) {
  return (
    <Tooltip title={`Удалить: пара #${pair.id}`}>
      <IconButton size="small" color="error" aria-label={`Удалить: пара #${pair.id}`} onClick={() => onDelete(pair)} disabled={pending}>
        <DeleteOutlined sx={{ fontSize: 15 }} />
      </IconButton>
    </Tooltip>
  )
}

function PairRecord({ pair, getMember, pending, onDelete, onToggle }) {
  return (
    <Box sx={{ border: '1px solid var(--color-border)', borderRadius: 2, p: 1.75 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1, mb: 1 }}>
        <PairMembersRow pair={pair} getMember={getMember} />
        <PairRowActions pair={pair} pending={pending} onDelete={onDelete} />
      </Box>
      <Typography sx={{ ...MONO, color: 'text.secondary', mb: 1 }}>
        Канал: {pair.target_channel_id}
      </Typography>
      <PairStatusToggle pair={pair} pending={pending} onToggle={onToggle} />
    </Box>
  )
}

export default function StackingPairs() {
  const theme = useTheme()
  const isCompact = useMediaQuery(theme.breakpoints.down('sm'))

  const [pairs, setPairs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(defaultForm())
  const [errors, setErrors] = useState({})
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [pendingPairIds, setPendingPairIds] = useState(() => new Set())
  const [snack, setSnack] = useState(null)
  const { get, resolveMany } = useMemberResolver()

  const load = async () => {
    try {
      const data = await getStackingPairs()
      setPairs(data)
      const ids = data.flatMap(p => [String(p.user_id_1), String(p.user_id_2)])
      resolveMany(ids)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const showSnack = (msg, severity = 'success') => setSnack({ msg, severity })

  const sameUserError = form.user_id_1 && form.user_id_2 && form.user_id_1 === form.user_id_2

  const openCreate = () => {
    setForm(defaultForm())
    setErrors({})
    setDrawerOpen(true)
  }

  const closeDrawer = () => setDrawerOpen(false)

  const handleSave = async () => {
    const nextErrors = {}
    if (!form.user_id_1) nextErrors.user_id_1 = 'Выберите участника'
    if (!form.user_id_2) nextErrors.user_id_2 = 'Выберите участника'
    if (!form.target_channel_id.trim()) nextErrors.target_channel_id = 'Укажите ID канала'
    if (form.user_id_1 && form.user_id_2 && form.user_id_1 === form.user_id_2) {
      nextErrors.user_id_2 = 'Выберите двух разных участников'
    }
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors)
      return
    }
    setErrors({})

    const payload = {
      user_id_1: form.user_id_1,
      user_id_2: form.user_id_2,
      target_channel_id: form.target_channel_id,
    }
    setSaving(true)
    try {
      await createStackingPair(payload)
      showSnack('Пара добавлена')
      setDrawerOpen(false)
      setForm(defaultForm())
      load()
    } catch (e) {
      showSnack(e.response?.data?.detail || 'Ошибка сохранения', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async (pair) => {
    if (pendingPairIds.has(pair.id)) return
    setPendingPairIds(prev => new Set(prev).add(pair.id))
    try {
      await toggleStackingPair(pair.id)
      await load()
    } catch (e) {
      showSnack(e.response?.data?.detail || 'Ошибка', 'error')
    } finally {
      setPendingPairIds(prev => {
        const next = new Set(prev)
        next.delete(pair.id)
        return next
      })
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteStackingPair(deleteTarget.id)
      showSnack('Пара удалена')
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
        title="Стаки"
        subtitle="Пары участников, которых бот перемещает вместе при встрече в одном голосовом канале"
        actions={
          <Button variant="contained" startIcon={<AddOutlined />} onClick={openCreate}>
            Добавить пару
          </Button>
        }
      />

      {pairs.length === 0 ? (
        <EmptyState text="Нет пар стакинга. Добавьте пару через кнопку выше." icon={PeopleOutlineOutlined} />
      ) : isCompact ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {pairs.map(p => (
            <PairRecord
              key={p.id}
              pair={p}
              getMember={get}
              pending={pendingPairIds.has(p.id)}
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
                <TableCell>Первый участник</TableCell>
                <TableCell>Второй участник</TableCell>
                <TableCell>Канал</TableCell>
                <TableCell>Создана</TableCell>
                <TableCell>Статус</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {pairs.map(p => {
                const pending = pendingPairIds.has(p.id)
                return (
                  <TableRow key={p.id}>
                    <TableCell sx={MONO}>{p.id}</TableCell>
                    <TableCell sx={{ minWidth: 180 }}>
                      <MemberCell id={String(p.user_id_1)} memberData={get(String(p.user_id_1))} />
                    </TableCell>
                    <TableCell sx={{ minWidth: 180 }}>
                      <MemberCell id={String(p.user_id_2)} memberData={get(String(p.user_id_2))} />
                    </TableCell>
                    <TableCell sx={MONO}>{p.target_channel_id}</TableCell>
                    <TableCell><Timestamp iso={p.created_at} /></TableCell>
                    <TableCell>
                      <PairStatusToggle pair={p} pending={pending} onToggle={handleToggle} />
                    </TableCell>
                    <TableCell>
                      <PairRowActions pair={p} pending={pending} onDelete={setDeleteTarget} />
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
        title="Новая пара"
        onClose={closeDrawer}
        onSubmit={handleSave}
        submitting={saving}
        submitLabel="Сохранить"
        width={420}
      >
        <MemberAutocomplete
          label="Первый участник"
          value={form.user_id_1}
          onChange={id => setForm(f => ({ ...f, user_id_1: id }))}
          error={!!errors.user_id_1 || !!sameUserError}
          helperText={errors.user_id_1}
        />
        <MemberAutocomplete
          label="Второй участник"
          value={form.user_id_2}
          onChange={id => setForm(f => ({ ...f, user_id_2: id }))}
          error={!!errors.user_id_2 || !!sameUserError}
          helperText={errors.user_id_2 || (sameUserError ? 'Выберите двух разных участников' : undefined)}
        />
        <TextField
          label="Целевой голосовой канал"
          fullWidth
          value={form.target_channel_id}
          onChange={e => setForm(f => ({ ...f, target_channel_id: e.target.value }))}
          error={!!errors.target_channel_id}
          helperText={errors.target_channel_id || 'Канал, куда бот переместит обоих участников'}
          inputProps={{ style: { fontFamily: "'IBM Plex Mono', monospace" } }}
          placeholder="111222333444555666"
        />
      </FormDrawer>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Удалить пару?"
        description={`Пара #${deleteTarget?.id} будет удалена.`}
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
