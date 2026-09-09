import { useState, useEffect, useCallback } from 'react'
import {
  Box,
  Button,
  TextField,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material'
import { DownloadOutlined, RefreshOutlined } from '@mui/icons-material'
import { DataGrid } from '@mui/x-data-grid'
import { getLogs } from '../api/logs'
import { ActionChip, PageHeader, ErrorState, DiscordId, Panel } from '../components/ui'
import { PageWrapper } from '../styles/motion'
import Timestamp from '../components/Timestamp'

const ACTION_TYPES = ['mute', 'unmute', 'move', 'kick', 'kick_timeout', 'pair_move']

const MONO = { fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.72rem' }

// MUI X DataGrid locale text — the small set of copy strings the page
// actually surfaces (empty state, selection count, and the rows-per-page
// control). The installed @mui/x-data-grid major version resolves the
// rows-per-page string from the top-level `paginationRowsPerPage` key (see
// constants/localeTextConstants.js) rather than a nested `MuiTablePagination`
// object used by older majors, so it's set directly here.
const gridLocale = {
  noRowsLabel: 'Нет событий',
  footerRowSelected: count => `Выбрано: ${count}`,
  paginationRowsPerPage: 'Строк на странице:',
}

export default function Logs() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [rowCount, setRowCount] = useState(0)
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 50 })
  const [filters, setFilters] = useState({
    action_type: '',
    discord_id: '',
    rule_id: '',
    date_from: '',
    date_to: '',
  })
  const [appliedFilters, setAppliedFilters] = useState({})

  const load = useCallback(async (page, pageSize, f) => {
    setLoading(true)
    try {
      const params = {
        limit: pageSize,
        offset: page * pageSize,
        ...(f.discord_id && { discord_id: f.discord_id }),
        ...(f.action_type && { action_type: f.action_type }),
        ...(f.rule_id && { rule_id: f.rule_id }),
        ...(f.date_from && { date_from: new Date(f.date_from).toISOString() }),
        ...(f.date_to && { date_to: new Date(f.date_to).toISOString() }),
      }
      const data = await getLogs(params)
      setLogs(data)
      setRowCount(prev => {
        const fetched = page * pageSize + data.length
        return data.length < pageSize ? fetched : Math.max(prev, fetched + 1)
      })
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(paginationModel.page, paginationModel.pageSize, appliedFilters)
  }, [paginationModel, appliedFilters, load])

  const handleSearch = () => {
    setAppliedFilters({ ...filters })
    setPaginationModel(m => ({ ...m, page: 0 }))
  }

  const handleReset = () => {
    const empty = { action_type: '', discord_id: '', rule_id: '', date_from: '', date_to: '' }
    setFilters(empty)
    setAppliedFilters({})
    setPaginationModel(m => ({ ...m, page: 0 }))
  }

  const exportCsv = () => {
    const f = appliedFilters
    const params = new URLSearchParams()
    if (f.discord_id) params.set('discord_id', f.discord_id)
    if (f.action_type) params.set('action_type', f.action_type)
    if (f.rule_id) params.set('rule_id', f.rule_id)
    if (f.date_from) params.set('date_from', new Date(f.date_from).toISOString())
    if (f.date_to) params.set('date_to', new Date(f.date_to).toISOString())
    window.open(`/api/logs/export?${params}`)
  }

  const columns = [
    {
      field: 'executed_at',
      headerName: 'Время',
      width: 130,
      renderCell: ({ value }) => <Timestamp iso={value} />,
    },
    {
      field: 'discord_id',
      headerName: 'Discord ID',
      width: 160,
      renderCell: ({ value }) => <DiscordId id={value} />,
    },
    {
      field: 'action_type',
      headerName: 'Действие',
      width: 140,
      renderCell: ({ row }) => <ActionChip type={row.action_type} isDryRun={row.is_dry_run} />,
    },
    {
      field: 'rule_id',
      headerName: 'Правило',
      width: 90,
      renderCell: ({ value }) => (
        <Typography sx={{ ...MONO, color: value != null ? 'text.primary' : 'text.disabled' }}>
          {value ?? '—'}
        </Typography>
      ),
    },
    {
      field: 'channel_id',
      headerName: 'Канал',
      width: 150,
      renderCell: ({ value }) => (
        <Typography sx={{ ...MONO, color: value ? 'text.primary' : 'text.disabled' }}>
          {value || '—'}
        </Typography>
      ),
    },
  ]

  if (error) return <ErrorState message={error} />

  return (
    <PageWrapper>
      <PageHeader
        title="Журнал"
        subtitle="История действий бота"
        actions={
          <Button
            variant="outlined"
            startIcon={<DownloadOutlined />}
            onClick={exportCsv}
            size="small"
          >
            Экспорт CSV
          </Button>
        }
      />

      <Panel sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <TextField
            label="Дата с"
            size="small"
            type="datetime-local"
            value={filters.date_from}
            onChange={e => setFilters(f => ({ ...f, date_from: e.target.value }))}
            InputLabelProps={{ shrink: true }}
            sx={{ width: { xs: '100%', sm: 200 } }}
          />
          <TextField
            label="Дата по"
            size="small"
            type="datetime-local"
            value={filters.date_to}
            onChange={e => setFilters(f => ({ ...f, date_to: e.target.value }))}
            InputLabelProps={{ shrink: true }}
            sx={{ width: { xs: '100%', sm: 200 } }}
          />
          <FormControl size="small" sx={{ width: { xs: '100%', sm: 150 } }}>
            <InputLabel id="logs-action-type-label">Тип действия</InputLabel>
            <Select
              labelId="logs-action-type-label"
              value={filters.action_type}
              label="Тип действия"
              onChange={e => setFilters(f => ({ ...f, action_type: e.target.value }))}
            >
              <MenuItem value="">Все</MenuItem>
              {ACTION_TYPES.map(t => (
                <MenuItem key={t} value={t}>
                  {t}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="Discord ID"
            size="small"
            value={filters.discord_id}
            onChange={e => setFilters(f => ({ ...f, discord_id: e.target.value }))}
            sx={{ width: { xs: '100%', sm: 160 } }}
            inputProps={{ style: { fontFamily: "'IBM Plex Mono', monospace" } }}
          />
          <TextField
            label="ID правила"
            size="small"
            value={filters.rule_id}
            onChange={e => setFilters(f => ({ ...f, rule_id: e.target.value }))}
            sx={{ width: { xs: '100%', sm: 100 } }}
          />
          <Button
            variant="contained"
            startIcon={<RefreshOutlined />}
            size="small"
            onClick={handleSearch}
          >
            Применить
          </Button>
          <Button variant="text" size="small" onClick={handleReset}>
            Сбросить
          </Button>
        </Box>
      </Panel>

      <Box sx={{ width: '100%' }}>
        <DataGrid
          rows={logs}
          columns={columns}
          paginationMode="server"
          rowCount={rowCount}
          paginationModel={paginationModel}
          onPaginationModelChange={setPaginationModel}
          pageSizeOptions={[25, 50, 100]}
          loading={loading}
          autoHeight
          disableRowSelectionOnClick
          localeText={gridLocale}
          sx={{
            border: '1px solid var(--color-border)',
            borderRadius: 2,
            '& .MuiDataGrid-columnHeaders': {
              backgroundColor: 'var(--color-bg-elevated)',
              borderBottom: '1px solid var(--color-border)',
            },
            '& .MuiDataGrid-row:hover': {
              backgroundColor: 'var(--color-bg-elevated)',
            },
            '& .MuiDataGrid-cell': {
              borderBottom: '1px solid var(--color-border)',
              fontSize: '0.82rem',
            },
            '& .MuiDataGrid-footerContainer': {
              borderTop: '1px solid var(--color-border)',
            },
          }}
        />
      </Box>
    </PageWrapper>
  )
}
