import { useState, useEffect, useCallback } from 'react'
import {
  Table, Form, Input, Select, Button, DatePicker, Space, Alert, Spin, Empty, Typography,
} from 'antd'
import { DownloadOutlined, ReloadOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { getLogs } from '../api/logs'
import ActionTag from '../components/ActionTag'
import DiscordId from '../components/DiscordId'
import Timestamp from '../components/Timestamp'

const PAGE_HEADER = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 20,
  paddingBottom: 16,
  borderBottom: '1px solid var(--border-subtle)',
}

const ACTION_TYPES = ['mute', 'unmute', 'move', 'kick', 'kick_timeout', 'pair_move']

export default function Logs() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [pagination, setPagination] = useState({ current: 1, pageSize: 50, total: 0 })
  const [filters, setFilters] = useState({})
  const [form] = Form.useForm()

  const load = useCallback(async (page = 1, pageSize = 50, f = filters) => {
    setLoading(true)
    try {
      const params = {
        limit: pageSize,
        offset: (page - 1) * pageSize,
        ...(f.discord_id && { discord_id: f.discord_id }),
        ...(f.action_type && { action_type: f.action_type }),
        ...(f.rule_id && { rule_id: f.rule_id }),
        ...(f.date_range?.[0] && { date_from: f.date_range[0].toISOString() }),
        ...(f.date_range?.[1] && { date_to: f.date_range[1].toISOString() }),
      }
      const data = await getLogs(params)
      setLogs(data)
      setPagination(prev => ({ ...prev, current: page, pageSize, total: data.length < pageSize ? (page - 1) * pageSize + data.length : page * pageSize + 1 }))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => { load(1, 50, {}) }, [])

  const handleSearch = async () => {
    const values = form.getFieldsValue()
    setFilters(values)
    await load(1, pagination.pageSize, values)
  }

  const handleReset = () => {
    form.resetFields()
    setFilters({})
    load(1, 50, {})
  }

  const handleTableChange = (pag) => {
    load(pag.current, pag.pageSize, filters)
  }

  const exportCsv = () => {
    const f = filters
    const params = new URLSearchParams()
    if (f.discord_id) params.set('discord_id', f.discord_id)
    if (f.action_type) params.set('action_type', f.action_type)
    if (f.rule_id) params.set('rule_id', f.rule_id)
    if (f.date_range?.[0]) params.set('date_from', f.date_range[0].toISOString())
    if (f.date_range?.[1]) params.set('date_to', f.date_range[1].toISOString())
    window.open(`/api/logs/export?${params}`)
  }

  const columns = [
    {
      title: 'Время',
      dataIndex: 'executed_at',
      width: 130,
      render: v => <Timestamp iso={v} />,
    },
    {
      title: 'Discord ID',
      dataIndex: 'discord_id',
      render: v => <DiscordId id={v} />,
    },
    {
      title: 'Действие',
      dataIndex: 'action_type',
      width: 150,
      render: (v, r) => <ActionTag type={v} isDryRun={r.is_dry_run} />,
    },
    {
      title: 'Rule ID',
      dataIndex: 'rule_id',
      width: 80,
      render: v => v != null
        ? <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11 }}>{v}</span>
        : <span style={{ color: 'var(--text-muted)' }}>—</span>,
    },
    {
      title: 'Channel',
      dataIndex: 'channel_id',
      width: 150,
      render: v => v
        ? <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11 }}>{v}</span>
        : <span style={{ color: 'var(--text-muted)' }}>—</span>,
    },
  ]

  if (error) return <Alert type="error" message={error} />

  return (
    <>
      <div style={PAGE_HEADER}>
        <div>
          <Typography.Title
            level={4}
            style={{ margin: 0, fontFamily: 'Syne, sans-serif', color: 'var(--text-primary)', fontWeight: 600 }}
          >
            Logs
          </Typography.Title>
          <Typography.Text style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
            История действий бота
          </Typography.Text>
        </div>
        <Button icon={<DownloadOutlined />} onClick={exportCsv}>
          Экспорт CSV
        </Button>
      </div>

      <Form form={form} layout="inline" style={{ marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <Form.Item name="date_range">
          <DatePicker.RangePicker showTime size="small" />
        </Form.Item>
        <Form.Item name="action_type">
          <Select
            size="small"
            placeholder="Action type"
            style={{ width: 140 }}
            allowClear
          >
            {ACTION_TYPES.map(t => <Select.Option key={t} value={t}>{t}</Select.Option>)}
          </Select>
        </Form.Item>
        <Form.Item name="discord_id">
          <Input size="small" placeholder="Discord ID" style={{ width: 160, fontFamily: "'IBM Plex Mono', monospace" }} />
        </Form.Item>
        <Form.Item name="rule_id">
          <Input size="small" placeholder="Rule ID" style={{ width: 90 }} />
        </Form.Item>
        <Form.Item>
          <Space>
            <Button size="small" type="primary" icon={<ReloadOutlined />} onClick={handleSearch}>
              Применить
            </Button>
            <Button size="small" onClick={handleReset}>Сбросить</Button>
          </Space>
        </Form.Item>
      </Form>

      {loading ? (
        <div style={{ textAlign: 'center', paddingTop: 60 }}><Spin size="large" /></div>
      ) : logs.length === 0 ? (
        <Empty description="Нет записей" />
      ) : (
        <Table
          dataSource={logs}
          columns={columns}
          rowKey="id"
          size="small"
          pagination={{
            ...pagination,
            size: 'small',
            showTotal: t => `Всего: ${t}`,
          }}
          onChange={handleTableChange}
          rowClassName={() => 'table-row'}
          expandable={{
            expandedRowRender: r => (
              <pre className="json-preview">
                {JSON.stringify(r.details || {}, null, 2)}
              </pre>
            ),
            rowExpandable: r => r.details && Object.keys(r.details).length > 0,
          }}
        />
      )}
    </>
  )
}
