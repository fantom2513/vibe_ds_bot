import { useState, useEffect } from 'react'
import {
  Table, Button, Drawer, Form, Select, Input, Switch,
  Popconfirm, message, Alert, Spin, Empty, Typography, Tag, Space,
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import cronstrue from 'cronstrue/i18n'
import { getSchedules, createSchedule, updateSchedule, deleteSchedule } from '../api/schedules'
import { getRules } from '../api/rules'

const PAGE_HEADER = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 20,
  paddingBottom: 16,
  borderBottom: '1px solid var(--border-subtle)',
}

const TIMEZONES = [
  'Europe/Moscow', 'Europe/London', 'Europe/Berlin', 'Europe/Paris',
  'America/New_York', 'America/Chicago', 'America/Los_Angeles',
  'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Kolkata', 'Australia/Sydney',
  'UTC',
]

function cronDescription(expr) {
  try {
    return cronstrue.toString(expr, { locale: 'ru', throwExceptionOnParseError: true })
  } catch {
    return null
  }
}

export default function Schedules() {
  const [schedules, setSchedules] = useState([])
  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [cronPreview, setCronPreview] = useState('')
  const [form] = Form.useForm()

  const load = async () => {
    try {
      const [s, r] = await Promise.all([getSchedules(), getRules()])
      setSchedules(s)
      setRules(r)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ action: 'enable', timezone: 'Europe/Moscow', is_active: true })
    setCronPreview('')
    setDrawerOpen(true)
  }

  const openEdit = (s) => {
    setEditing(s)
    form.setFieldsValue({
      rule_id: s.rule_id,
      cron_expr: s.cron_expr,
      timezone: s.timezone,
      action: s.action,
      is_active: s.is_active,
    })
    setCronPreview(cronDescription(s.cron_expr) || '')
    setDrawerOpen(true)
  }

  const handleCronChange = (e) => {
    const expr = e.target.value
    setCronPreview(cronDescription(expr) || '')
  }

  const handleSave = async () => {
    let values
    try { values = await form.validateFields() } catch { return }
    setSaving(true)
    try {
      if (editing) {
        await updateSchedule(editing.id, values)
        message.success('Расписание обновлено')
      } else {
        await createSchedule(values)
        message.success('Расписание создано')
      }
      setDrawerOpen(false)
      load()
    } catch (e) {
      message.error(e.response?.data?.detail || 'Ошибка')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    try {
      await deleteSchedule(id)
      message.success('Удалено')
      load()
    } catch (e) {
      message.error(e.response?.data?.detail || 'Ошибка')
    }
  }

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 60,
      render: v => <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11 }}>{v}</span>,
    },
    {
      title: 'Rule ID',
      dataIndex: 'rule_id',
      width: 80,
      render: v => <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11 }}>{v}</span>,
    },
    {
      title: 'Cron',
      dataIndex: 'cron_expr',
      render: v => (
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: 'var(--text-mono)' }}>
          {v}
        </span>
      ),
    },
    { title: 'Timezone', dataIndex: 'timezone', width: 150 },
    {
      title: 'Action',
      dataIndex: 'action',
      width: 90,
      render: v => <Tag color={v === 'enable' ? 'green' : 'red'}>{v}</Tag>,
    },
    {
      title: 'Активно',
      dataIndex: 'is_active',
      width: 80,
      render: v => <Tag color={v ? 'green' : 'default'}>{v ? 'Да' : 'Нет'}</Tag>,
    },
    {
      title: '',
      key: 'actions',
      width: 90,
      render: (_, r) => (
        <Space size={4}>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Popconfirm title="Удалить расписание?" onConfirm={() => handleDelete(r.id)} okText="Да" cancelText="Нет">
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  if (loading) return <div style={{ textAlign: 'center', paddingTop: 60 }}><Spin size="large" /></div>
  if (error) return <Alert type="error" message={error} />

  return (
    <>
      <div style={PAGE_HEADER}>
        <div>
          <Typography.Title
            level={4}
            style={{ margin: 0, fontFamily: 'Syne, sans-serif', color: 'var(--text-primary)', fontWeight: 600 }}
          >
            Schedules
          </Typography.Title>
          <Typography.Text style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
            Cron-расписания включения/отключения правил
          </Typography.Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          Новое расписание
        </Button>
      </div>

      {schedules.length === 0 ? (
        <Empty description="Нет расписаний" />
      ) : (
        <Table
          dataSource={schedules}
          columns={columns}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 20, size: 'small', showTotal: t => `Всего: ${t}` }}
          rowClassName={() => 'table-row'}
        />
      )}

      <Drawer
        title={editing ? 'Редактировать расписание' : 'Новое расписание'}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={480}
        extra={
          <Button type="primary" loading={saving} onClick={handleSave}>
            Сохранить
          </Button>
        }
      >
        <Form form={form} layout="vertical">
          <Form.Item name="rule_id" label="Rule ID" rules={[{ required: true }]}>
            <Select placeholder="Выберите правило">
              {rules.map(r => (
                <Select.Option key={r.id} value={r.id}>
                  #{r.id} — {r.action_type} ({r.target_list || 'all'})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="cron_expr"
            label="Cron Expression"
            rules={[{ required: true, message: 'Введите cron выражение' }]}
            extra={cronPreview
              ? <span style={{ color: 'var(--status-success)', fontSize: 11 }}>{cronPreview}</span>
              : <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>Пример: 0 22 * * * (каждый день в 22:00)</span>
            }
          >
            <Input
              onChange={handleCronChange}
              placeholder="0 22 * * *"
              style={{ fontFamily: "'IBM Plex Mono', monospace" }}
            />
          </Form.Item>
          <Form.Item name="timezone" label="Timezone">
            <Select showSearch>
              {TIMEZONES.map(tz => (
                <Select.Option key={tz} value={tz}>{tz}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="action" label="Action">
            <Select>
              <Select.Option value="enable">enable</Select.Option>
              <Select.Option value="disable">disable</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="is_active" label="Активно" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Drawer>
    </>
  )
}
