import { useState, useEffect } from 'react'
import {
  Table, Button, Drawer, Form, Select, Input, InputNumber, Switch, Tag,
  Popconfirm, message, Alert, Spin, Empty, Space, Typography,
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { getRules, createRule, updateRule, deleteRule, toggleRule } from '../api/rules'
import ActionTag from '../components/ActionTag'

const PAGE_HEADER = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 20,
  paddingBottom: 16,
  borderBottom: '1px solid var(--border-subtle)',
}

export default function Rules() {
  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  const load = async () => {
    try {
      const data = await getRules()
      setRules(data)
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
    form.setFieldsValue({ is_active: true, is_dry_run: false, priority: 0, action_params: '{}' })
    setDrawerOpen(true)
  }

  const openEdit = (rule) => {
    setEditing(rule)
    form.setFieldsValue({
      target_list: rule.target_list,
      channel_ids: rule.channel_ids,
      max_time_sec: rule.max_time_sec,
      action_type: rule.action_type,
      action_params: typeof rule.action_params === 'object'
        ? JSON.stringify(rule.action_params, null, 2)
        : (rule.action_params || '{}'),
      priority: rule.priority ?? 0,
      is_active: rule.is_active,
      is_dry_run: rule.is_dry_run,
    })
    setDrawerOpen(true)
  }

  const handleSave = async () => {
    let values
    try {
      values = await form.validateFields()
    } catch { return }

    // Validate action_params JSON
    try {
      values.action_params = JSON.parse(values.action_params || '{}')
    } catch {
      message.error('action_params — невалидный JSON')
      return
    }

    setSaving(true)
    try {
      if (editing) {
        await updateRule(editing.id, values)
        message.success('Правило обновлено')
      } else {
        await createRule(values)
        message.success('Правило создано')
      }
      setDrawerOpen(false)
      load()
    } catch (e) {
      message.error(e.response?.data?.detail || 'Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    try {
      await deleteRule(id)
      message.success('Правило удалено')
      load()
    } catch (e) {
      message.error(e.response?.data?.detail || 'Ошибка удаления')
    }
  }

  const handleToggle = async (rule) => {
    try {
      await toggleRule(rule.id)
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
      render: v => (
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: 'var(--text-mono)' }}>
          {v}
        </span>
      ),
    },
    {
      title: 'Target List',
      dataIndex: 'target_list',
      width: 110,
      render: v => v
        ? <Tag color={v === 'whitelist' ? 'green' : 'red'}>{v}</Tag>
        : <span style={{ color: 'var(--text-muted)' }}>—</span>,
    },
    {
      title: 'Каналы',
      dataIndex: 'channel_ids',
      render: v => Array.isArray(v) && v.length
        ? <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11 }}>{v.join(', ')}</span>
        : <span style={{ color: 'var(--text-muted)' }}>Все</span>,
    },
    {
      title: 'Max Time',
      dataIndex: 'max_time_sec',
      width: 100,
      render: v => v
        ? <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11 }}>{Math.round(v / 60)} мин</span>
        : <span style={{ color: 'var(--text-muted)' }}>—</span>,
    },
    {
      title: 'Действие',
      dataIndex: 'action_type',
      width: 130,
      render: (v, r) => <ActionTag type={v} isDryRun={r.is_dry_run} />,
    },
    {
      title: 'Приоритет',
      dataIndex: 'priority',
      width: 90,
      render: v => (
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11 }}>{v}</span>
      ),
    },
    {
      title: 'Активно',
      dataIndex: 'is_active',
      width: 90,
      render: (v, r) => (
        <Switch checked={v} size="small" onChange={() => handleToggle(r)} />
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 90,
      render: (_, r) => (
        <Space size={4}>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => openEdit(r)}
          />
          <Popconfirm
            title="Удалить правило?"
            onConfirm={() => handleDelete(r.id)}
            okText="Да"
            cancelText="Нет"
          >
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
            Rules
          </Typography.Title>
          <Typography.Text style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
            Управление правилами обработки голосовых событий
          </Typography.Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          Новое правило
        </Button>
      </div>

      {rules.length === 0 ? (
        <Empty description="Нет правил" />
      ) : (
        <Table
          dataSource={rules}
          columns={columns}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 20, size: 'small', showTotal: t => `Всего: ${t}` }}
          rowClassName={() => 'table-row'}
        />
      )}

      <Drawer
        title={editing ? 'Редактировать правило' : 'Новое правило'}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={520}
        extra={
          <Button type="primary" loading={saving} onClick={handleSave}>
            Сохранить
          </Button>
        }
      >
        <Form form={form} layout="vertical">
          <Form.Item name="target_list" label="Target List">
            <Select placeholder="Все пользователи" allowClear>
              <Select.Option value="whitelist">whitelist</Select.Option>
              <Select.Option value="blacklist">blacklist</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="channel_ids" label="Channel IDs (пустой = все каналы)">
            <Select mode="tags" placeholder="Введите ID канала и нажмите Enter" tokenSeparators={[',']} />
          </Form.Item>
          <Form.Item name="max_time_sec" label="Max Time (секунды)">
            <InputNumber style={{ width: '100%' }} min={1} placeholder="например 3600" />
          </Form.Item>
          <Form.Item name="action_type" label="Action Type" rules={[{ required: true }]}>
            <Select>
              {['mute', 'unmute', 'move', 'kick'].map(t => (
                <Select.Option key={t} value={t}>{t}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="action_params"
            label="Action Params (JSON)"
            rules={[{
              validator: (_, v) => {
                try { JSON.parse(v || '{}'); return Promise.resolve() }
                catch { return Promise.reject('Невалидный JSON') }
              }
            }]}
          >
            <Input.TextArea rows={3} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11 }} />
          </Form.Item>
          <Form.Item name="priority" label="Приоритет">
            <InputNumber style={{ width: '100%' }} defaultValue={0} />
          </Form.Item>
          <Form.Item name="is_active" label="Активно" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="is_dry_run" label="Dry Run" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Drawer>
    </>
  )
}
