import { useState, useEffect } from 'react'
import {
  Tabs, Table, Button, Modal, Form, Input, Popconfirm,
  message, Alert, Spin, Empty, Typography, Space, Tag,
} from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import { getUsers, addUser, deleteUser } from '../api/users'
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

function UserTable({ listType }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  const load = async () => {
    setLoading(true)
    try {
      setUsers(await getUsers(listType))
    } catch (e) {
      message.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [listType])

  const handleAdd = async () => {
    let values
    try { values = await form.validateFields() } catch { return }
    setSaving(true)
    try {
      await addUser({ discord_id: Number(values.discord_id), list_type: listType, username: values.username || null })
      message.success('Пользователь добавлен')
      setModalOpen(false)
      form.resetFields()
      load()
    } catch (e) {
      message.error(e.response?.data?.detail || 'Ошибка')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (discord_id) => {
    try {
      await deleteUser(discord_id, listType)
      message.success('Удалено')
      load()
    } catch (e) {
      message.error(e.response?.data?.detail || 'Ошибка')
    }
  }

  const columns = [
    {
      title: 'Discord ID',
      dataIndex: 'discord_id',
      render: v => <DiscordId id={v} />,
    },
    {
      title: 'Username',
      dataIndex: 'username',
      render: v => v || <span style={{ color: 'var(--text-muted)' }}>—</span>,
    },
    {
      title: 'Добавлен',
      dataIndex: 'created_at',
      render: v => <Timestamp iso={v} />,
      width: 130,
    },
    {
      title: '',
      key: 'actions',
      width: 60,
      render: (_, r) => (
        <Popconfirm
          title="Удалить пользователя?"
          onConfirm={() => handleDelete(r.discord_id)}
          okText="Да"
          cancelText="Нет"
        >
          <Button size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ]

  return (
    <>
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'flex-end' }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
          Добавить
        </Button>
      </div>
      {loading ? (
        <div style={{ textAlign: 'center', paddingTop: 40 }}><Spin /></div>
      ) : users.length === 0 ? (
        <Empty description="Список пуст" />
      ) : (
        <Table
          dataSource={users}
          columns={columns}
          rowKey={r => `${r.discord_id}-${r.list_type}`}
          size="small"
          pagination={{ pageSize: 20, size: 'small', showTotal: t => `Всего: ${t}` }}
          rowClassName={() => 'table-row'}
        />
      )}

      <Modal
        title={`Добавить в ${listType}`}
        open={modalOpen}
        onOk={handleAdd}
        onCancel={() => setModalOpen(false)}
        confirmLoading={saving}
        okText="Добавить"
        cancelText="Отмена"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="discord_id"
            label="Discord ID"
            rules={[
              { required: true, message: 'Введите Discord ID' },
              { pattern: /^\d+$/, message: 'Только числа' },
            ]}
          >
            <Input placeholder="123456789012345678" />
          </Form.Item>
          <Form.Item name="username" label="Username (необязательно)">
            <Input placeholder="user#0000" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}

export default function Users() {
  return (
    <>
      <div style={PAGE_HEADER}>
        <div>
          <Typography.Title
            level={4}
            style={{ margin: 0, fontFamily: 'Syne, sans-serif', color: 'var(--text-primary)', fontWeight: 600 }}
          >
            Users
          </Typography.Title>
          <Typography.Text style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
            Управление whitelist и blacklist пользователей
          </Typography.Text>
        </div>
      </div>

      <Tabs
        items={[
          {
            key: 'whitelist',
            label: <span><Tag color="green" style={{ marginRight: 4 }}>WL</Tag>Whitelist</span>,
            children: <UserTable listType="whitelist" />,
          },
          {
            key: 'blacklist',
            label: <span><Tag color="red" style={{ marginRight: 4 }}>BL</Tag>Blacklist</span>,
            children: <UserTable listType="blacklist" />,
          },
        ]}
      />
    </>
  )
}
