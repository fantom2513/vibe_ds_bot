import { useState, useEffect } from 'react'
import {
  Box, Button, Switch, FormControlLabel,
  Table, TableBody, TableCell, TableHead, TableRow, TableContainer,
  Paper, IconButton, Drawer, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Typography, Tooltip, Snackbar, Alert, Select, MenuItem,
  FormControl, InputLabel, Chip,
} from '@mui/material'
import { AddOutlined, EditOutlined, DeleteOutlined } from '@mui/icons-material'
import {
  getMuteLevels, createMuteLevel, updateMuteLevel, deleteMuteLevel,
  getMuteLeaderboard, getGuildRoles,
} from '../api/muteLevels'
import { MemberCell, PageHeader, LoadingState, ErrorState, EmptyState } from '../components/ui'
import { useMemberResolver } from '../hooks/useMemberResolver'
import { PageWrapper } from '../styles/motion'

const MONO = { fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.72rem' }

function fmtMuteTime(seconds) {
  if (!seconds) return '0m'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return h ? `${h}h ${m}m` : `${m}m`
}

const defaultForm = () => ({
  level: '',
  label: '',
  xp_required: '',
  role_id: '',
  has_role: false,
})

export default function MuteLevels() {
  const [levels, setLevels] = useState([])
  const [leaderboard, setLeaderboard] = useState([])
  const [roles, setRoles] = useState([])
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
      const [lvls, board, guildRoles] = await Promise.all([
        getMuteLevels(),
        getMuteLeaderboard(),
        getGuildRoles().catch(() => []),
      ])
      setLevels(lvls)
      setLeaderboard(board)
      setRoles(guildRoles)
      resolveMany(board.map(e => String(e.discord_id)))
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

  const openEdit = (lvl) => {
    setEditing(lvl)
    setForm({
      level: String(lvl.level),
      label: lvl.label,
      xp_required: String(lvl.xp_required),
      role_id: lvl.role_id ? String(lvl.role_id) : '',
      has_role: !!lvl.role_id,
    })
    setDrawerOpen(true)
  }

  const handleSave = async () => {
    if (!form.level || !form.label || !form.xp_required) {
      showSnack('Заполните все обязательные поля', 'error')
      return
    }
    const payload = {
      level: Number(form.level),
      label: form.label,
      xp_required: Number(form.xp_required),
      role_id: form.has_role && form.role_id ? Number(form.role_id) : null,
    }
    setSaving(true)
    try {
      if (editing) {
        await updateMuteLevel(editing.level, {
          label: payload.label,
          xp_required: payload.xp_required,
          role_id: payload.role_id,
        })
        showSnack('Обновлено')
      } else {
        await createMuteLevel(payload)
        showSnack('Уровень создан')
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
      await deleteMuteLevel(deleteTarget.level)
      showSnack('Удалён')
      setDeleteTarget(null)
      load()
    } catch (e) {
      showSnack(e.response?.data?.detail || 'Ошибка', 'error')
    }
  }

  const getRoleName = (roleId) => {
    const role = roles.find(r => r.id === String(roleId))
    return role ? role.name : String(roleId)
  }

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} />

  return (
    <PageWrapper>
      <PageHeader
        title="Mute Levels"
        subtitle="Система уровней тишины — XP за полный мут (микрофон + наушники выключены)"
        actions={
          <Button variant="contained" startIcon={<AddOutlined />} onClick={openCreate}>
            Добавить уровень
          </Button>
        }
      />

      {/* ── Настройка уровней ── */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" sx={{ mb: 1.5, fontSize: '0.9rem' }}>
          Уровни
        </Typography>
        {levels.length === 0 ? (
          <EmptyState text="Уровни не настроены" icon="🔇" />
        ) : (
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Уровень</TableCell>
                  <TableCell>Название</TableCell>
                  <TableCell>XP порог</TableCell>
                  <TableCell>Роль</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {levels.map(lvl => (
                  <TableRow key={lvl.level}>
                    <TableCell sx={MONO}>#{lvl.level}</TableCell>
                    <TableCell>
                      <Chip
                        label={lvl.label}
                        size="small"
                        sx={{
                          bgcolor: 'rgba(139,92,246,0.15)',
                          color: '#a78bfa',
                          border: '1px solid rgba(139,92,246,0.3)',
                          fontFamily: "'IBM Plex Mono', monospace",
                          fontSize: '0.72rem',
                        }}
                      />
                    </TableCell>
                    <TableCell sx={MONO}>{lvl.xp_required.toLocaleString()} XP</TableCell>
                    <TableCell sx={{ color: lvl.role_id ? 'text.primary' : 'text.disabled', ...MONO }}>
                      {lvl.role_id ? `@${getRoleName(lvl.role_id)}` : '—'}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <Tooltip title="Редактировать">
                          <IconButton size="small" onClick={() => openEdit(lvl)}>
                            <EditOutlined sx={{ fontSize: 15 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Удалить">
                          <IconButton size="small" color="error" onClick={() => setDeleteTarget(lvl)}>
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
      </Box>

      {/* ── Лидерборд ── */}
      <Box>
        <Typography variant="h6" sx={{ mb: 1.5, fontSize: '0.9rem' }}>
          Лидерборд — топ 10
        </Typography>
        {leaderboard.length === 0 ? (
          <EmptyState text="Нет данных" icon="📊" />
        ) : (
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Место</TableCell>
                  <TableCell>Участник</TableCell>
                  <TableCell>Уровень</TableCell>
                  <TableCell>XP</TableCell>
                  <TableCell>Всего в муте</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {leaderboard.map((entry, idx) => (
                  <TableRow key={entry.discord_id}>
                    <TableCell sx={{ ...MONO, color: idx === 0 ? '#fbbf24' : idx === 1 ? '#94a3b8' : idx === 2 ? '#cd7c2f' : 'text.secondary' }}>
                      #{idx + 1}
                    </TableCell>
                    <TableCell sx={{ minWidth: 200 }}>
                      <MemberCell id={String(entry.discord_id)} memberData={get(String(entry.discord_id))} />
                    </TableCell>
                    <TableCell sx={MONO}>{entry.level}</TableCell>
                    <TableCell sx={MONO}>{entry.xp.toLocaleString()}</TableCell>
                    <TableCell sx={MONO}>{fmtMuteTime(entry.total_mute_seconds)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>

      {/* ── Drawer: создать/редактировать уровень ── */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{ sx: { width: 420, p: 3 } }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h6" sx={{ fontSize: '1rem' }}>
            {editing ? 'Редактировать уровень' : 'Новый уровень'}
          </Typography>
          <Button variant="contained" size="small" onClick={handleSave} disabled={saving}>
            {saving ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Номер уровня"
            size="small"
            fullWidth
            type="number"
            value={form.level}
            onChange={e => setForm(f => ({ ...f, level: e.target.value }))}
            disabled={!!editing}
            helperText="Уникальный номер уровня"
          />
          <TextField
            label="Название"
            size="small"
            fullWidth
            value={form.label}
            onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
            placeholder="Тихоня, Призрак, Монолит..."
          />
          <TextField
            label="XP порог"
            size="small"
            fullWidth
            type="number"
            value={form.xp_required}
            onChange={e => setForm(f => ({ ...f, xp_required: e.target.value }))}
            helperText={`${MUTE_XP_PER_MINUTE_LABEL} в минуту — порог ${form.xp_required ? Math.round(form.xp_required / 10) + ' мин' : '?'}`}
          />
          <FormControlLabel
            control={
              <Switch
                checked={form.has_role}
                onChange={e => setForm(f => ({ ...f, has_role: e.target.checked, role_id: '' }))}
                size="small"
              />
            }
            label="Выдавать роль при достижении"
          />
          {form.has_role && (
            <FormControl size="small" fullWidth>
              <InputLabel>Роль</InputLabel>
              <Select
                value={form.role_id}
                label="Роль"
                onChange={e => setForm(f => ({ ...f, role_id: e.target.value }))}
              >
                {roles.map(r => (
                  <MenuItem key={r.id} value={r.id}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{
                        width: 10, height: 10, borderRadius: '50%',
                        bgcolor: r.color !== '0' ? `#${parseInt(r.color).toString(16).padStart(6, '0')}` : '#99aab5',
                        flexShrink: 0,
                      }} />
                      {r.name}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </Box>
      </Drawer>

      {/* ── Диалог удаления ── */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Удалить уровень?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Уровень <strong>{deleteTarget?.level} — {deleteTarget?.label}</strong> будет удалён.
            Пользователи с этим уровнем останутся с прежним XP.
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

// 10 XP per minute — показываем в подсказке
const MUTE_XP_PER_MINUTE_LABEL = '10 XP'
