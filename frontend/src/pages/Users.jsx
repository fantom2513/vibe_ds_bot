import { useState, useEffect } from 'react'
import {
  Box, Button, Tabs, Tab,
  Table, TableBody, TableCell, TableHead, TableRow, TableContainer,
  Paper, IconButton, Tooltip, Snackbar, Alert, useMediaQuery,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { AddOutlined, DeleteOutlined, PersonOutlineOutlined } from '@mui/icons-material'
import { getUsers, addUser, deleteUser } from '../api/users'
import {
  MemberCell, MemberAutocomplete, PageHeader, LoadingState, ErrorState, EmptyState,
  FormDrawer, ConfirmDialog,
} from '../components/ui'
import { useMemberResolver } from '../hooks/useMemberResolver'
import { PageWrapper } from '../styles/motion'
import Timestamp from '../components/Timestamp'

// Tabs show Russian sentence-case copy; the internal `list_type` API value
// (`whitelist` / `blacklist`) stays out of the visible UI entirely.
const LIST_TABS = [
  { listType: 'whitelist', label: 'Белый список' },
  { listType: 'blacklist', label: 'Чёрный список' },
]

// Row-level building blocks shared between the mobile UserRecord card and
// the desktop table row, mirroring Rules.jsx's RuleRowActions pattern.
function UserRowActions({ user, memberData, onDelete }) {
  const name = memberData?.display_name || user.username || user.discord_id
  return (
    <Tooltip title={`Удалить: ${name}`}>
      <IconButton size="small" color="error" aria-label={`Удалить: ${name}`} onClick={() => onDelete(user)}>
        <DeleteOutlined sx={{ fontSize: 15 }} />
      </IconButton>
    </Tooltip>
  )
}

function UserRecord({ user, memberData, onDelete }) {
  return (
    <Box sx={{ border: '1px solid var(--color-border)', borderRadius: 2, p: 1.75, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
      <MemberCell id={String(user.discord_id)} memberData={memberData} showId />
      <UserRowActions user={user} memberData={memberData} onDelete={onDelete} />
    </Box>
  )
}

function UserTable({ listType, emptyText }) {
  const theme = useTheme()
  const isCompact = useMediaQuery(theme.breakpoints.down('sm'))
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [selectError, setSelectError] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [snack, setSnack] = useState(null)
  const { get, resolveMany } = useMemberResolver()

  const load = async () => {
    setLoading(true)
    try {
      const data = await getUsers(listType)
      setUsers(data)
      resolveMany(data.map(u => String(u.discord_id)))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [listType])

  const showSnack = (msg, severity = 'success') => setSnack({ msg, severity })

  const openCreate = () => {
    setSelectedId(null)
    setSelectError(null)
    setDrawerOpen(true)
  }

  const closeDrawer = () => setDrawerOpen(false)

  const handleAdd = async () => {
    if (!selectedId) {
      setSelectError('Выберите участника')
      return
    }
    setSelectError(null)
    const memberData = get(selectedId)
    setSaving(true)
    try {
      await addUser({
        discord_id: selectedId,
        list_type: listType,
        username: memberData?.username || null,
      })
      showSnack('Участник добавлен')
      setDrawerOpen(false)
      setSelectedId(null)
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
      await deleteUser(deleteTarget.discord_id, listType)
      showSnack('Участник удалён')
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
    <>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1.5 }}>
        <Button variant="contained" startIcon={<AddOutlined />} onClick={openCreate}>
          Добавить
        </Button>
      </Box>

      {users.length === 0 ? (
        <EmptyState text={emptyText} icon={PersonOutlineOutlined} />
      ) : isCompact ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {users.map(u => (
            <UserRecord
              key={`${u.discord_id}-${u.list_type}`}
              user={u}
              memberData={get(String(u.discord_id))}
              onDelete={setDeleteTarget}
            />
          ))}
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Участник</TableCell>
                <TableCell>Добавлен</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map(u => (
                <TableRow key={`${u.discord_id}-${u.list_type}`}>
                  <TableCell sx={{ minWidth: 200 }}>
                    <MemberCell id={String(u.discord_id)} memberData={get(String(u.discord_id))} showId />
                  </TableCell>
                  <TableCell><Timestamp iso={u.created_at} /></TableCell>
                  <TableCell>
                    <UserRowActions user={u} memberData={get(String(u.discord_id))} onDelete={setDeleteTarget} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <FormDrawer
        open={drawerOpen}
        title={listType === 'whitelist' ? 'Добавить в белый список' : 'Добавить в чёрный список'}
        onClose={closeDrawer}
        onSubmit={handleAdd}
        submitting={saving}
        submitLabel="Сохранить"
        width={420}
      >
        <MemberAutocomplete
          label="Участник"
          value={selectedId}
          onChange={id => { setSelectedId(id); if (id) setSelectError(null) }}
          error={!!selectError}
          helperText={selectError}
        />
      </FormDrawer>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Удалить участника?"
        description={`Участник ${get(String(deleteTarget?.discord_id))?.display_name || deleteTarget?.discord_id} будет удалён из списка.`}
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
    </>
  )
}

export default function Users() {
  const [tab, setTab] = useState(0)
  const active = LIST_TABS[tab]

  return (
    <PageWrapper>
      <PageHeader
        title="Участники"
        subtitle="Управление белым и чёрным списками участников"
      />
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        {LIST_TABS.map(t => (
          <Tab key={t.listType} label={t.label} />
        ))}
      </Tabs>
      <UserTable
        key={active.listType}
        listType={active.listType}
        emptyText={
          active.listType === 'whitelist'
            ? 'В белом списке нет участников. Добавьте участника через кнопку выше.'
            : 'В чёрном списке нет участников. Добавьте участника через кнопку выше.'
        }
      />
    </PageWrapper>
  )
}
