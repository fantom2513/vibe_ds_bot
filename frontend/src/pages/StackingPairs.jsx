import { useState, useEffect } from 'react'
import {
  Box, Button, Switch,
  Table, TableBody, TableCell, TableHead, TableRow, TableContainer,
  Paper, IconButton, Drawer, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Typography, Tooltip, Snackbar, Alert,
} from '@mui/material'
import { AddOutlined, DeleteOutlined } from '@mui/icons-material'
import { getStackingPairs, createStackingPair, toggleStackingPair, deleteStackingPair } from '../api/stackingPairs'
import { DiscordId, PageHeader, LoadingState, ErrorState, EmptyState } from '../components/ui'
import { PageWrapper } from '../styles/motion'
import Timestamp from '../components/Timestamp'

const MONO = { fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.72rem' }

const defaultForm = () => ({ user_id_1: '', user_id_2: '', target_channel_id: '' })

export default function StackingPairs() {
  const [pairs, setPairs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(defaultForm())
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [snack, setSnack] = useState(null)

  const load = async () => {
    try {
      setPairs(await getStackingPairs())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const showSnack = (msg, severity = 'success') => setSnack({ msg, severity })

  const handleSave = async () => {
    const payload = {
      user_id_1: Number(form.user_id_1),
      user_id_2: Number(form.user_id_2),
      target_channel_id: Number(form.target_channel_id),
    }
    if (!payload.user_id_1 || !payload.user_id_2 || !payload.target_channel_id) {
      showSnack('Заполните все поля', 'error')
      return
    }
    setSaving(true)
    try {
      await createStackingPair(payload)
      showSnack('Пара добавлена')
      setDrawerOpen(false)
      setForm(defaultForm())
      load()
    } catch (e) {
      showSnack(e.response?.data?.detail || 'Ошибка', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async (pair) => {
    try {
      await toggleStackingPair(pair.id)
      load()
    } catch (e) {
      showSnack(e.response?.data?.detail || 'Ошибка', 'error')
    }
  }

  const handleDelete = async () => {
    try {
      await deleteStackingPair(deleteTarget.id)
      showSnack('Удалена')
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
        title="Stacking Pairs"
        subtitle="Пары пользователей, которых бот перемещает вместе при встрече в одном канале"
        actions={
          <Button variant="contained" startIcon={<AddOutlined />} onClick={() => {
            setForm(defaultForm()); setDrawerOpen(true)
          }}>
            Добавить пару
          </Button>
        }
      />

      {pairs.length === 0 ? (
        <EmptyState text="Нет пар стакинга" icon="👥" />
      ) : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>User 1</TableCell>
                <TableCell>User 2</TableCell>
                <TableCell>Target Channel</TableCell>
                <TableCell>Создана</TableCell>
                <TableCell>Активно</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {pairs.map(p => (
                <TableRow key={p.id}>
                  <TableCell sx={MONO}>{p.id}</TableCell>
                  <TableCell><DiscordId id={p.user_id_1} /></TableCell>
                  <TableCell><DiscordId id={p.user_id_2} /></TableCell>
                  <TableCell sx={MONO}>{p.target_channel_id}</TableCell>
                  <TableCell><Timestamp iso={p.created_at} /></TableCell>
                  <TableCell>
                    <Switch checked={p.is_active} size="small" onChange={() => handleToggle(p)} />
                  </TableCell>
                  <TableCell>
                    <Tooltip title="Удалить">
                      <IconButton size="small" color="error" onClick={() => setDeleteTarget(p)}>
                        <DeleteOutlined sx={{ fontSize: 15 }} />
                      </IconButton>
                    </Tooltip>
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
          <Typography variant="h6" sx={{ fontSize: '1rem' }}>Добавить пару стакинга</Typography>
          <Button variant="contained" size="small" onClick={handleSave} disabled={saving}>
            {saving ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="User ID 1"
            size="small"
            fullWidth
            value={form.user_id_1}
            onChange={e => setForm(f => ({ ...f, user_id_1: e.target.value }))}
            inputProps={{ style: { fontFamily: "'IBM Plex Mono', monospace" } }}
            placeholder="123456789012345678"
          />
          <TextField
            label="User ID 2"
            size="small"
            fullWidth
            value={form.user_id_2}
            onChange={e => setForm(f => ({ ...f, user_id_2: e.target.value }))}
            inputProps={{ style: { fontFamily: "'IBM Plex Mono', monospace" } }}
            placeholder="987654321098765432"
          />
          <TextField
            label="Target Channel ID"
            size="small"
            fullWidth
            value={form.target_channel_id}
            onChange={e => setForm(f => ({ ...f, target_channel_id: e.target.value }))}
            inputProps={{ style: { fontFamily: "'IBM Plex Mono', monospace" } }}
            placeholder="111222333444555666"
            helperText="Канал, куда бот переместит обоих пользователей"
          />
        </Box>
      </Drawer>

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Удалить пару?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Пара #{deleteTarget?.id} будет удалена.
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
