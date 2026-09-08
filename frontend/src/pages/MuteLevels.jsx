import { useState, useEffect } from 'react'
import {
  Box, Button, Switch, FormControlLabel,
  Table, TableBody, TableCell, TableHead, TableRow, TableContainer,
  Paper, IconButton, TextField, Typography, Tooltip, Snackbar, Alert,
  Select, MenuItem, FormControl, InputLabel, FormHelperText, useMediaQuery,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { AddOutlined, EditOutlined, DeleteOutlined, VolumeOffOutlined, BarChartOutlined } from '@mui/icons-material'
import {
  getMuteLevels, createMuteLevel, updateMuteLevel, deleteMuteLevel,
  getMuteLeaderboard, getGuildRoles,
} from '../api/muteLevels'
import {
  MemberCell, PageHeader, LoadingState, ErrorState, EmptyState,
  StatusBadge, FormDrawer, ConfirmDialog,
} from '../components/ui'
import { useMemberResolver } from '../hooks/useMemberResolver'
import { PageWrapper } from '../styles/motion'

const MONO = { fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.72rem' }

// XP awarded per minute of a full mute (mic + deafen) — shown as a hint next
// to the XP threshold field so an admin can picture the time cost of a level.
const XP_PER_MINUTE = 10

function fmtMuteTime(seconds) {
  if (!seconds) return '0 мин'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return h ? `${h} ч ${m} мин` : `${m} мин`
}

// Guild role colors are Discord-assigned data, not part of this app's
// design system. They are rendered only as a small swatch inside the role
// selector below (role metadata), never reused as page/table chrome.
function roleColorHex(color) {
  const n = Number(color)
  return Number.isFinite(n) && n > 0 ? `#${n.toString(16).padStart(6, '0')}` : '#99aab5'
}

function RoleSwatch({ color }) {
  return (
    <Box
      aria-hidden="true"
      sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: roleColorHex(color), flexShrink: 0 }}
    />
  )
}

// The mute-level API has no is_active flag (see MuteLevelResponse) — whether
// a level grants a role is the meaningful per-row state to communicate, so
// it stands in as this table's semantic-badge "state" column.
function LevelRoleBadge({ roleId, roleName }) {
  return roleId ? (
    <StatusBadge tone="info">{`@${roleName}`}</StatusBadge>
  ) : (
    <StatusBadge tone="neutral">Без роли</StatusBadge>
  )
}

// Row-level building blocks shared between the mobile LevelRecord card and
// the desktop table row — mirrors Rules.jsx's shared-row-helper pattern.
function LevelRowActions({ level, onEdit, onDelete }) {
  const name = level.label
  return (
    <Box sx={{ display: 'flex', gap: 0.5 }}>
      <Tooltip title={`Редактировать: ${name}`}>
        <IconButton size="small" aria-label={`Редактировать: ${name}`} onClick={() => onEdit(level)}>
          <EditOutlined sx={{ fontSize: 15 }} />
        </IconButton>
      </Tooltip>
      <Tooltip title={`Удалить: ${name}`}>
        <IconButton size="small" color="error" aria-label={`Удалить: ${name}`} onClick={() => onDelete(level)}>
          <DeleteOutlined sx={{ fontSize: 15 }} />
        </IconButton>
      </Tooltip>
    </Box>
  )
}

function LevelRecord({ level, roleName, onEdit, onDelete }) {
  return (
    <Box sx={{ border: '1px solid var(--color-border)', borderRadius: 2, p: 1.75 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1, mb: 1 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ color: 'text.primary', fontWeight: 600, fontSize: '0.85rem' }}>
            {level.label}
          </Typography>
          <Typography sx={MONO}>Уровень {level.level}</Typography>
        </Box>
        <LevelRowActions level={level} onEdit={onEdit} onDelete={onDelete} />
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography sx={MONO}>{level.xp_required.toLocaleString()} XP</Typography>
        <LevelRoleBadge roleId={level.role_id} roleName={roleName} />
      </Box>
    </Box>
  )
}

// Rank is a plain mono ordinal with an accessible "Место N" name — no
// trophy symbols, no emoji, and no gold/silver/bronze color coding.
function RankBadge({ rank }) {
  return (
    <Typography
      component="span"
      aria-label={`Место ${rank}`}
      sx={{ ...MONO, fontSize: '0.78rem', color: 'text.secondary' }}
    >
      {rank}
    </Typography>
  )
}

const defaultForm = () => ({
  level: '',
  label: '',
  xp_required: '',
  role_id: '',
  has_role: false,
})

export default function MuteLevels() {
  const theme = useTheme()
  const isCompact = useMediaQuery(theme.breakpoints.down('sm'))

  const [levels, setLevels] = useState([])
  const [leaderboard, setLeaderboard] = useState([])
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(defaultForm())
  const [errors, setErrors] = useState({})
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
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

  const getRoleName = (roleId) => {
    const role = roles.find(r => r.id === String(roleId))
    return role ? role.name : String(roleId)
  }

  const openCreate = () => {
    setEditing(null)
    setForm(defaultForm())
    setErrors({})
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
    setErrors({})
    setDrawerOpen(true)
  }

  const closeDrawer = () => setDrawerOpen(false)

  const handleSave = async () => {
    const nextErrors = {}
    const levelNumber = Number(form.level)
    if (!form.level || !(levelNumber > 0)) nextErrors.level = 'Укажите номер уровня'
    if (!form.label.trim()) nextErrors.label = 'Название обязательно'
    const xpNumber = Number(form.xp_required)
    if (!form.xp_required || !(xpNumber > 0)) nextErrors.xp_required = 'XP порог должен быть больше нуля'
    if (form.has_role && !form.role_id) nextErrors.role_id = 'Выберите роль'
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors)
      return
    }
    setErrors({})

    const roleId = form.has_role && form.role_id ? Number(form.role_id) : null

    setSaving(true)
    try {
      if (editing) {
        await updateMuteLevel(editing.level, {
          label: form.label.trim(),
          xp_required: xpNumber,
          role_id: roleId,
        })
        showSnack('Уровень обновлён')
      } else {
        await createMuteLevel({
          level: levelNumber,
          label: form.label.trim(),
          xp_required: xpNumber,
          role_id: roleId,
        })
        showSnack('Уровень создан')
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
      await deleteMuteLevel(deleteTarget.level)
      showSnack('Уровень удалён')
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
        title="Уровни тишины"
        subtitle="Система уровней тишины — XP за полный мут (микрофон и наушники выключены)"
        actions={
          <Button variant="contained" startIcon={<AddOutlined />} onClick={openCreate}>
            Добавить уровень
          </Button>
        }
      />

      {/* ── Настройка уровней ── */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" sx={{ mb: 1.5, fontSize: '0.9rem' }}>
          Настройка уровней
        </Typography>
        {levels.length === 0 ? (
          <EmptyState text="Уровни не настроены" icon={VolumeOffOutlined} />
        ) : isCompact ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {levels.map(lvl => (
              <LevelRecord
                key={lvl.level}
                level={lvl}
                roleName={lvl.role_id ? getRoleName(lvl.role_id) : null}
                onEdit={openEdit}
                onDelete={setDeleteTarget}
              />
            ))}
          </Box>
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
                    <TableCell sx={MONO}>{lvl.level}</TableCell>
                    <TableCell sx={{ color: 'text.primary' }}>{lvl.label}</TableCell>
                    <TableCell sx={MONO}>{lvl.xp_required.toLocaleString()} XP</TableCell>
                    <TableCell>
                      <LevelRoleBadge roleId={lvl.role_id} roleName={lvl.role_id ? getRoleName(lvl.role_id) : null} />
                    </TableCell>
                    <TableCell>
                      <LevelRowActions level={lvl} onEdit={openEdit} onDelete={setDeleteTarget} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>

      {/* ── Рейтинг участников ── */}
      <Box>
        <Typography variant="h6" sx={{ mb: 1.5, fontSize: '0.9rem' }}>
          Рейтинг участников
        </Typography>
        {leaderboard.length === 0 ? (
          <EmptyState text="Нет данных" icon={BarChartOutlined} />
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
                    <TableCell><RankBadge rank={idx + 1} /></TableCell>
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

      <FormDrawer
        open={drawerOpen}
        title={editing ? 'Редактировать уровень' : 'Новый уровень'}
        onClose={closeDrawer}
        onSubmit={handleSave}
        submitting={saving}
        submitLabel="Сохранить"
        width={420}
      >
        <TextField
          label="Номер уровня"
          fullWidth
          type="number"
          value={form.level}
          onChange={e => setForm(f => ({ ...f, level: e.target.value }))}
          disabled={!!editing}
          error={!!errors.level}
          helperText={errors.level || 'Уникальный номер уровня'}
        />
        <TextField
          label="Название"
          fullWidth
          value={form.label}
          onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
          placeholder="Тихоня, Призрак, Монолит..."
          error={!!errors.label}
          helperText={errors.label}
        />
        <TextField
          label="XP порог"
          fullWidth
          type="number"
          value={form.xp_required}
          onChange={e => setForm(f => ({ ...f, xp_required: e.target.value }))}
          error={!!errors.xp_required}
          helperText={
            errors.xp_required
              || `${XP_PER_MINUTE} XP в минуту — порог ${form.xp_required ? Math.round(form.xp_required / XP_PER_MINUTE) + ' мин' : '?'}`
          }
        />
        <FormControlLabel
          control={
            <Switch
              checked={form.has_role}
              onChange={e => setForm(f => ({ ...f, has_role: e.target.checked, role_id: '' }))}
            />
          }
          label="Выдавать роль при достижении"
        />
        {form.has_role && (
          <FormControl fullWidth error={!!errors.role_id}>
            <InputLabel id="mute-level-role-label">Роль</InputLabel>
            <Select
              labelId="mute-level-role-label"
              value={form.role_id}
              label="Роль"
              onChange={e => setForm(f => ({ ...f, role_id: e.target.value }))}
            >
              {roles.map(r => (
                <MenuItem key={r.id} value={r.id}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <RoleSwatch color={r.color} />
                    {r.name}
                  </Box>
                </MenuItem>
              ))}
            </Select>
            {errors.role_id && <FormHelperText>{errors.role_id}</FormHelperText>}
          </FormControl>
        )}
      </FormDrawer>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Удалить уровень?"
        description={`Уровень «${deleteTarget?.label}» будет удалён. Пользователи с этим уровнем останутся с прежним XP.`}
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
