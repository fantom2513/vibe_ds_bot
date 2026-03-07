import { useState, useEffect } from 'react'
import {
  Descriptions, Badge, Table, Alert, Spin, Typography, Space, Tag,
} from 'antd'
import { getBotInfo, getAllowedUsers } from '../api/stats'
import DiscordId from '../components/DiscordId'

const PAGE_HEADER = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 20,
  paddingBottom: 16,
  borderBottom: '1px solid var(--border-subtle)',
}

function formatUptime(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${h}ч ${m}м ${s}с`
}

export default function Settings() {
  const [botInfo, setBotInfo] = useState(null)
  const [allowedUsers, setAllowedUsers] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    Promise.all([getBotInfo(), getAllowedUsers()])
      .then(([info, users]) => {
        setBotInfo(info)
        setAllowedUsers(users)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ textAlign: 'center', paddingTop: 60 }}><Spin size="large" /></div>
  if (error) return <Alert type="error" message={error} />

  const allowedColumns = [
    {
      title: 'Discord ID',
      dataIndex: 'id',
      render: v => <DiscordId id={v} />,
    },
    {
      title: 'Статус',
      render: () => <Badge status="success" text="Allowed" />,
    },
  ]

  const allowedData = (allowedUsers?.allowed_discord_ids || []).map((id, i) => ({ id, key: i }))

  return (
    <>
      <div style={PAGE_HEADER}>
        <div>
          <Typography.Title
            level={4}
            style={{ margin: 0, fontFamily: 'Syne, sans-serif', color: 'var(--text-primary)', fontWeight: 600 }}
          >
            Settings
          </Typography.Title>
          <Typography.Text style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
            Информация о боте и доступ к дашборду
          </Typography.Text>
        </div>
      </div>

      <Space direction="vertical" size={24} style={{ width: '100%' }}>
        <div>
          <Typography.Title
            level={5}
            style={{ fontFamily: 'Syne, sans-serif', color: 'var(--text-primary)', marginBottom: 12 }}
          >
            Bot Info
          </Typography.Title>
          <Descriptions
            bordered
            size="small"
            column={1}
            labelStyle={{ color: 'var(--text-secondary)', width: 160 }}
            contentStyle={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12 }}
          >
            <Descriptions.Item label="Имя бота">
              {botInfo?.bot_name || '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Guild ID">
              {botInfo?.guild_id || '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Guild Name">
              {botInfo?.guild_name || '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Uptime">
              {botInfo?.uptime_seconds != null ? formatUptime(botInfo.uptime_seconds) : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Latency">
              {botInfo?.latency_ms != null ? `${botInfo.latency_ms} ms` : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Статус">
              <Badge status="success" text="Online" />
            </Descriptions.Item>
          </Descriptions>
        </div>

        <div>
          <Typography.Title
            level={5}
            style={{ fontFamily: 'Syne, sans-serif', color: 'var(--text-primary)', marginBottom: 4 }}
          >
            Dashboard Access
          </Typography.Title>
          <Typography.Text style={{ color: 'var(--text-secondary)', fontSize: 12, display: 'block', marginBottom: 12 }}>
            {allowedUsers?.note}
          </Typography.Text>
          <Table
            dataSource={allowedData}
            columns={allowedColumns}
            rowKey="key"
            size="small"
            pagination={false}
            rowClassName={() => 'table-row'}
          />
        </div>
      </Space>
    </>
  )
}
