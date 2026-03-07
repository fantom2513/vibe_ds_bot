import { useState, useEffect, useCallback } from 'react'
import { Row, Col, Table, Avatar, Alert, Spin, Empty, Typography, Space } from 'antd'
import {
  OrderedListOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  HistoryOutlined,
} from '@ant-design/icons'
import { getDashboard } from '../api/dashboard'
import { getStatsOverview } from '../api/stats'
import StatCard from '../components/StatCard'
import ActionTag from '../components/ActionTag'
import Timestamp from '../components/Timestamp'
import DiscordId from '../components/DiscordId'

const PAGE_HEADER = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 20,
  paddingBottom: 16,
  borderBottom: '1px solid var(--border-subtle)',
}

export default function Dashboard() {
  const [dashboard, setDashboard] = useState(null)
  const [stats, setStats] = useState(null)
  const [recentLogs, setRecentLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchData = useCallback(async () => {
    try {
      const [dash, st] = await Promise.all([getDashboard(), getStatsOverview()])
      setDashboard(dash)
      setStats(st)
      setRecentLogs(dash.recent_logs || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // SSE real-time updates (Part 2.4 — wired up here)
  useEffect(() => {
    const es = new EventSource('/api/dashboard/stream')

    es.onmessage = (e) => {
      const event = JSON.parse(e.data)
      if (event.type === 'ping') return
      if (event.type === 'voice_update') {
        fetchData()
      }
      if (event.type === 'action_log') {
        setRecentLogs(prev => [
          {
            id: Date.now(),
            executed_at: event.timestamp,
            discord_id: event.discord_id,
            action_type: event.action_type,
            rule_id: event.rule_id,
            is_dry_run: event.is_dry_run,
            channel_id: null,
          },
          ...prev,
        ].slice(0, 20))
      }
    }

    es.onerror = () => {
      console.warn('SSE disconnected, reconnecting...')
    }

    return () => es.close()
  }, [fetchData])

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}>
        <Spin size="large" />
      </div>
    )
  }

  if (error) return <Alert type="error" message={error} />

  const onlineColumns = [
    {
      title: '',
      dataIndex: 'avatar',
      width: 40,
      render: (url) => <Avatar src={url} size="small" />,
    },
    { title: 'Пользователь', dataIndex: 'username' },
    { title: 'Канал', dataIndex: 'channel_name' },
    {
      title: 'Время в канале',
      dataIndex: 'joined_at',
      render: (v) => <Timestamp iso={v} />,
    },
  ]

  const logColumns = [
    {
      title: 'Время',
      dataIndex: 'executed_at',
      render: (v) => <Timestamp iso={v} />,
      width: 130,
    },
    {
      title: 'Discord ID',
      dataIndex: 'discord_id',
      render: (v) => <DiscordId id={v} />,
    },
    {
      title: 'Действие',
      dataIndex: 'action_type',
      render: (v, r) => <ActionTag type={v} isDryRun={r.is_dry_run} />,
      width: 140,
    },
    { title: 'Rule ID', dataIndex: 'rule_id', width: 80, render: v => v ?? '—' },
  ]

  const onlineUsers = dashboard?.online_users || []
  const todayActions = stats?.total_actions || 0

  return (
    <>
      <div style={PAGE_HEADER}>
        <div>
          <Typography.Title
            level={4}
            style={{ margin: 0, fontFamily: 'Syne, sans-serif', color: 'var(--text-primary)', fontWeight: 600 }}
          >
            Dashboard
          </Typography.Title>
          <Typography.Text style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
            Обзор активности бота в реальном времени
          </Typography.Text>
        </div>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            title="Активных правил"
            value={dashboard?.active_rules?.length ?? 0}
            icon={<OrderedListOutlined />}
            color="#5865F2"
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            title="В голосе сейчас"
            value={dashboard?.voice_online_count ?? 0}
            icon={<TeamOutlined />}
            color="#23c55e"
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            title="Действий всего"
            value={todayActions}
            icon={<ThunderboltOutlined />}
            color="#f59e0b"
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            title="Последних событий"
            value={recentLogs.length}
            icon={<HistoryOutlined />}
            color="#3b82f6"
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Typography.Title
            level={5}
            style={{ fontFamily: 'Syne, sans-serif', color: 'var(--text-primary)', marginBottom: 12 }}
          >
            Сейчас в голосе
          </Typography.Title>
          {onlineUsers.length === 0 ? (
            <Empty description="Никого нет в голосовых каналах" />
          ) : (
            <Table
              dataSource={onlineUsers}
              columns={onlineColumns}
              rowKey="user_id"
              size="small"
              pagination={false}
              rowClassName={() => 'table-row'}
            />
          )}
        </Col>

        <Col xs={24} lg={12}>
          <Typography.Title
            level={5}
            style={{ fontFamily: 'Syne, sans-serif', color: 'var(--text-primary)', marginBottom: 12 }}
          >
            Последние события
          </Typography.Title>
          {recentLogs.length === 0 ? (
            <Empty description="Нет событий" />
          ) : (
            <Table
              dataSource={recentLogs}
              columns={logColumns}
              rowKey="id"
              size="small"
              pagination={false}
              rowClassName={() => 'table-row'}
            />
          )}
        </Col>
      </Row>
    </>
  )
}
