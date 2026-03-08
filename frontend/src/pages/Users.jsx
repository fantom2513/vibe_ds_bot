import { useState, useEffect } from 'react'
import {
  Box, Button, Tabs, Tab,
  Table, TableBody, TableCell, TableHead, TableRow, TableContainer,
  Paper, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  Typography, Tooltip, Snackbar, Alert,
} from '@mui/material'
import { AddOutlined, DeleteOutlined } from '@mui/icons-material'
import { getUsers, addUser, deleteUser } from '../api/users'
import { MemberCell, MemberAutocomplete, PageHeader, LoadingState, EmptyState } from '../components/ui'
import { useMemberResolver } from '../hooks/useMemberResolver'
import { PageWrapper } from '../styles/motion'
import Timestamp from '../components/Timestamp'

function UserTable({ listType }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [snack, setSnack] = useState(null)
  const { get, resolveMany } = useMemberResolver()

  const load = async () => {
    setLoading(true)
    try {
      const data = await getUsers(listType)
      setUsers(data)
      resolveMany(data.map(u => String(u.discord_id)))
    } catch (e) {
      setSnack({ msg: e.message, severity: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [listType])

  const showSnack = (msg, severity = 'success') => setSnack({ msg, severity })

  const handleAdd = async () => {
    if (!selectedId) {
      showSnack('Выберите пользователя', 'error')
      return
    }
    const memberData = get(selectedId)
    setSaving(true)
    try {
      await addUser({
        discord_id: Number(selectedId),
        list_type: listType,
        username: memberData?.username || null,
      })
      showSnack('Пользователь добавлен')
      setModalOpen(false)
      setSelectedId(null)
      load()
    } catch (e) {
      showSnack(e.response?.data?.detail || 'Ошибка', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    try {
      await deleteUser(deleteTarget.discord_id, listType)
      showSnack('Удалено')
      setDeleteTarget(null)
      load()
    } catch (e) {
      showSnack(e.response?.data?.detail || 'Ошибка', 'error')
    }
  }

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1.5 }}>
        <Button variant="contained" startIcon={<AddOutlined />} onClick={() => {
          setSelectedId(null); setModalOpen(true)
        }}>
          Добавить
        </Button>
      </Box>

      {loading ? (
        <LoadingState />
      ) : users.length === 0 ? (
        <EmptyState text="Список пуст" icon="👤" />
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
                    <Tooltip title="Удалить">
                      <IconButton size="small" color="error" onClick={() => setDeleteTarget(u)}>
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

      {/* Add Modal */}
      <Dialog open={modalOpen} onClose={() => setModalOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Добавить в {listType}</DialogTitle>
        <DialogContent sx={{ pt: '16px !important' }}>
          <MemberAutocomplete
            label="Пользователь"
            value={selectedId}
            onChange={id => setSelectedId(id)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setModalOpen(false)}>Отмена</Button>
          <Button variant="contained" onClick={handleAdd} disabled={saving}>
            {saving ? 'Добавление...' : 'Добавить'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Удалить пользователя?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {deleteTarget?.discord_id} будет удалён из {listType}.
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
    </>
  )
}

export default function Users() {
  const [tab, setTab] = useState(0)

  return (
    <PageWrapper>
      <PageHeader
        title="Users"
        subtitle="Управление whitelist и blacklist пользователей"
      />
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Whitelist" />
        <Tab label="Blacklist" />
      </Tabs>
      {tab === 0 && <UserTable listType="whitelist" />}
      {tab === 1 && <UserTable listType="blacklist" />}
    </PageWrapper>
  )
}
