import { useState, useEffect } from 'react'
import {
  Box, Button, Switch,
  Table, TableBody, TableCell, TableHead, TableRow, TableContainer,
  Paper, IconButton, Drawer, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Typography, Tooltip, Snackbar, Alert,
} from '@mui/material'
import { AddOutlined, EditOutlined, DeleteOutlined } from '@mui/icons-material'
import { getKickTargets, createKickTarget, updateKickTarget, deleteKickTarget } from '../api/kickTargets'
import { MemberCell, MemberAutocomplete, PageHeader, LoadingState, ErrorState, EmptyState } from '../components/ui'
import { useMemberResolver } from '../hooks/useMemberResolver'
import { PageWrapper } from '../styles/motion'

const MONO = { fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.72rem' }

const defaultForm = () => ({ discord_id: null, timeout_sec: '1800', max_timeout_sec: '' })

export default function KickTargets() {
  const [targets, setTargets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(defaultForm())
  const [deleteTarget, setDeleteTarget] = useState(null)
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

  useEffect(() => { load() }, [])

  const showSnack = (msg, severity = 'success') => setSnack({ msg, severity })

  const openCreate = () => {
    setEditing(null)
    setForm(defaultForm())
    setDrawerOpen(true)
  }

  const openEdit = (t) => {
    setEditing(t)
    setForm({
      discord_id: String(t.discord_id),
      timeout_sec: String(t.timeout_sec),
      max_timeout_sec: t.max_timeout_sec != null ? String(t.max_timeout_sec) : '',
    })
    setDrawerOpen(true)
  }

  const handleSave = async () => {
    if (!form.discord_id) {
      showSnack('Выберите пользователя', 'error')
      return
    }
    const memberData = get(form.discord_id)
    const payload = {
      discord_id: form.discord_id,
      username: memberData?.username || null,
      timeout_sec: Number(form.timeout_sec) || 1800,
      max_timeout_sec: form.max_timeout_sec ? Number(form.max_timeout_sec) : null,
    }
    setSaving(true)
    try {
      if (editing) {
        await updateKickTarget(editing.discord_id, payload)
        showSnack('Обновлено')
      } else {
        await createKickTarget(payload)
        showSnack('Добавлен')
      }
      setDrawerOpen(false)
      load()
    } catch (e) {
      showSnack(e.response?.data?.detail || 'Ошибка', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async (t) => {
    try {
      await updateKickTarget(t.discord_id, { is_active: !t.is_active })
      load()
    } catch (e) {
      showSnack(e.response?.data?.detail || 'Ошибка', 'error')
    }
  }

  const handleDelete = async () => {
    try {
      await deleteKickTarget(deleteTarget.discord_id)
      showSnack('Удалён')
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
        title="Kick Targets"
        subtitle="Пользователи с автоматическим таймаутом кика из голосового канала"
        actions={
          <Button variant="contained" startIcon={<AddOutlined />} onClick={openCreate}>
            Добавить
          </Button>
        }
      />

      {targets.length === 0 ? (
        <EmptyState text="Нет целей для кика" icon="⚡" />
      ) : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Участник</TableCell>
                <TableCell>Timeout</TableCell>
                <TableCell>Max Timeout</TableCell>
                <TableCell>Активно</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {targets.map(t => (
                <TableRow key={t.discord_id}>
                  <TableCell sx={{ minWidth: 200 }}>
                    <MemberCell id={String(t.discord_id)} memberData={get(String(t.discord_id))} />
                  </TableCell>
                  <TableCell sx={MONO}>{Math.round(t.timeout_sec / 60)} мин</TableCell>
                  <TableCell sx={{ ...MONO, color: t.max_timeout_sec ? 'text.primary' : 'text.disabled' }}>
                    {t.max_timeout_sec ? `${Math.round(t.max_timeout_sec / 60)} мин` : '—'}
                  </TableCell>
                  <TableCell>
                    <Switch checked={t.is_active} size="small" onChange={() => handleToggle(t)} />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <Tooltip title="Редактировать">
                        <IconButton size="small" onClick={() => openEdit(t)}>
                          <EditOutlined sx={{ fontSize: 15 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Удалить">
                        <IconButton size="small" color="error" onClick={() => setDeleteTarget(t)}>
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
        PaperProps={{ sx: { width: 420, p: 3 } }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h6" sx={{ fontSize: '1rem' }}>
            {editing ? 'Редактировать' : 'Добавить цель кика'}
          </Typography>
          <Button variant="contained" size="small" onClick={handleSave} disabled={saving}>
            {saving ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <MemberAutocomplete
            label="Пользователь"
            value={form.discord_id}
            onChange={id => setForm(f => ({ ...f, discord_id: id }))}
            disabled={!!editing}
          />
          <TextField
            label="Timeout (секунды)"
            size="small"
            fullWidth
            type="number"
            value={form.timeout_sec}
            onChange={e => setForm(f => ({ ...f, timeout_sec: e.target.value }))}
            helperText="Минимальное время в голосе до кика"
          />
          <TextField
            label="Max Timeout (секунды, необязательно)"
            size="small"
            fullWidth
            type="number"
            value={form.max_timeout_sec}
            onChange={e => setForm(f => ({ ...f, max_timeout_sec: e.target.value }))}
            helperText="Если задан — таймаут рандомизируется в диапазоне"
          />
        </Box>
      </Drawer>

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Удалить цель?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {deleteTarget?.discord_id} будет удалён из списка автокика.
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
