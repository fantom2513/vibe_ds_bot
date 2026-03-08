import { useState, useEffect } from 'react'
import {
  Box,
  Button, Drawer, Select, MenuItem, TextField, Switch, FormControlLabel,
  Table, TableBody, TableCell, TableHead, TableRow, TableContainer,
  Paper, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  Snackbar, Alert, Tooltip, Typography, FormControl, InputLabel,
} from '@mui/material'
import { AddOutlined, EditOutlined, DeleteOutlined } from '@mui/icons-material'
import { getRules, createRule, updateRule, deleteRule, toggleRule } from '../api/rules'
import { ActionChip, PageHeader, LoadingState, ErrorState, EmptyState } from '../components/ui'
import { PageWrapper } from '../styles/motion'

const MONO = { fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.72rem' }

const defaultForm = () => ({
  target_list: '',
  channel_ids: '',
  max_time_sec: '',
  action_type: '',
  action_params: '{}',
  priority: 0,
  is_active: true,
  is_dry_run: false,
})

export default function Rules() {
  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(defaultForm())
  const [formError, setFormError] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
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

  useEffect(() => { load() }, [])

  const showSnack = (msg, severity = 'success') => setSnack({ msg, severity })

  const openCreate = () => {
    setEditing(null)
    setForm(defaultForm())
    setFormError(null)
    setDrawerOpen(true)
  }

  const openEdit = (rule) => {
    setEditing(rule)
    setForm({
      target_list: rule.target_list || '',
      channel_ids: (rule.channel_ids || []).join(', '),
      max_time_sec: rule.max_time_sec ?? '',
      action_type: rule.action_type || '',
      action_params: typeof rule.action_params === 'object'
        ? JSON.stringify(rule.action_params, null, 2)
        : (rule.action_params || '{}'),
      priority: rule.priority ?? 0,
      is_active: rule.is_active,
      is_dry_run: rule.is_dry_run,
    })
    setFormError(null)
    setDrawerOpen(true)
  }

  const handleSave = async () => {
    if (!form.action_type) { setFormError('action_type обязателен'); return }
    let action_params
    try {
      action_params = JSON.parse(form.action_params || '{}')
    } catch {
      setFormError('action_params — невалидный JSON')
      return
    }
    const payload = {
      target_list: form.target_list || null,
      channel_ids: form.channel_ids
        ? form.channel_ids.split(',').map(s => s.trim()).filter(Boolean)
        : [],
      max_time_sec: form.max_time_sec ? Number(form.max_time_sec) : null,
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
    try {
      await deleteRule(deleteTarget.id)
      showSnack('Правило удалено')
      setDeleteTarget(null)
      load()
    } catch (e) {
      showSnack(e.response?.data?.detail || 'Ошибка удаления', 'error')
    }
  }

  const handleToggle = async (rule) => {
    try {
      await toggleRule(rule.id)
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
        title="Rules"
        subtitle="Управление правилами обработки голосовых событий"
        actions={
          <Button variant="contained" startIcon={<AddOutlined />} onClick={openCreate}>
            Новое правило
          </Button>
        }
      />

      {rules.length === 0 ? (
        <EmptyState text="Нет правил" icon="📋" />
      ) : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Target List</TableCell>
                <TableCell>Каналы</TableCell>
                <TableCell>Max Time</TableCell>
                <TableCell>Действие</TableCell>
                <TableCell>Приоритет</TableCell>
                <TableCell>Активно</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {rules.map(r => (
                <TableRow key={r.id}>
                  <TableCell sx={MONO}>{r.id}</TableCell>
                  <TableCell>
                    {r.target_list ? (
                      <Box component="span" sx={{
                        px: 0.75, py: '2px', borderRadius: '4px', fontSize: '0.7rem',
                        ...MONO,
                        backgroundColor: r.target_list === 'whitelist'
                          ? 'rgba(34,211,165,0.10)' : 'rgba(244,63,94,0.10)',
                        color: r.target_list === 'whitelist' ? '#22d3a5' : '#f43f5e',
                        border: `1px solid ${r.target_list === 'whitelist' ? 'rgba(34,211,165,0.30)' : 'rgba(244,63,94,0.30)'}`,
                      }}>
                        {r.target_list}
                      </Box>
                    ) : (
                      <Typography sx={{ color: 'text.disabled', fontSize: '0.72rem' }}>—</Typography>
                    )}
                  </TableCell>
                  <TableCell sx={{ color: Array.isArray(r.channel_ids) && r.channel_ids.length ? 'text.primary' : 'text.disabled', ...MONO }}>
                    {Array.isArray(r.channel_ids) && r.channel_ids.length ? r.channel_ids.join(', ') : 'Все'}
                  </TableCell>
                  <TableCell sx={MONO}>
                    {r.max_time_sec ? `${Math.round(r.max_time_sec / 60)} мин` : <Typography sx={{ color: 'text.disabled', fontSize: '0.72rem' }}>—</Typography>}
                  </TableCell>
                  <TableCell><ActionChip type={r.action_type} isDryRun={r.is_dry_run} /></TableCell>
                  <TableCell sx={MONO}>{r.priority}</TableCell>
                  <TableCell>
                    <Switch checked={r.is_active} size="small" onChange={() => handleToggle(r)} />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <Tooltip title="Редактировать">
                        <IconButton size="small" onClick={() => openEdit(r)}>
                          <EditOutlined sx={{ fontSize: 15 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Удалить">
                        <IconButton size="small" color="error" onClick={() => setDeleteTarget(r)}>
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

      {/* Edit/Create Drawer */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{ sx: { width: 480, p: 3 } }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h6" sx={{ fontSize: '1rem' }}>
            {editing ? 'Редактировать правило' : 'Новое правило'}
          </Typography>
          <Button variant="contained" size="small" onClick={handleSave} disabled={saving}>
            {saving ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </Box>

        {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <FormControl size="small" fullWidth>
            <InputLabel>Target List</InputLabel>
            <Select
              value={form.target_list}
              label="Target List"
              onChange={e => setForm(f => ({ ...f, target_list: e.target.value }))}
            >
              <MenuItem value="">Все пользователи</MenuItem>
              <MenuItem value="whitelist">whitelist</MenuItem>
              <MenuItem value="blacklist">blacklist</MenuItem>
            </Select>
          </FormControl>

          <TextField
            label="Channel IDs (через запятую, пусто = все)"
            size="small"
            fullWidth
            value={form.channel_ids}
            onChange={e => setForm(f => ({ ...f, channel_ids: e.target.value }))}
            placeholder="123456789, 987654321"
            inputProps={{ style: { fontFamily: "'IBM Plex Mono', monospace" } }}
          />

          <TextField
            label="Max Time (секунды)"
            size="small"
            fullWidth
            type="number"
            value={form.max_time_sec}
            onChange={e => setForm(f => ({ ...f, max_time_sec: e.target.value }))}
            placeholder="например 3600"
          />

          <FormControl size="small" fullWidth required>
            <InputLabel>Action Type *</InputLabel>
            <Select
              value={form.action_type}
              label="Action Type *"
              onChange={e => setForm(f => ({ ...f, action_type: e.target.value }))}
            >
              {['mute', 'unmute', 'move', 'kick'].map(t => (
                <MenuItem key={t} value={t}>{t}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label="Action Params (JSON)"
            size="small"
            fullWidth
            multiline
            rows={3}
            value={form.action_params}
            onChange={e => setForm(f => ({ ...f, action_params: e.target.value }))}
            inputProps={{ style: { fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.75rem' } }}
          />

          <TextField
            label="Приоритет"
            size="small"
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
            label="Dry Run"
          />
        </Box>
      </Drawer>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Удалить правило?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Правило #{deleteTarget?.id} ({deleteTarget?.action_type}) будет удалено.
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
