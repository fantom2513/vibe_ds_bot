import { useState } from 'react'
import { Layout, Menu } from 'antd'
import {
  DashboardOutlined,
  OrderedListOutlined,
  TeamOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import UserAvatar from './UserAvatar'

const { Sider, Header, Content } = Layout

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: 'Dashboard' },
  { key: '/rules', icon: <OrderedListOutlined />, label: 'Rules' },
  { key: '/users', icon: <TeamOutlined />, label: 'Users' },
  { key: '/schedules', icon: <ClockCircleOutlined />, label: 'Schedules' },
  { key: '/logs', icon: <FileTextOutlined />, label: 'Logs' },
  { key: '/settings', icon: <SettingOutlined />, label: 'Settings' },
]

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuth()

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        style={{ background: 'var(--bg-surface)' }}
      >
        <div
          style={{
            height: 32,
            margin: 16,
            background: 'var(--accent)',
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 700,
            fontFamily: 'Syne, sans-serif',
            fontSize: collapsed ? 16 : 13,
          }}
        >
          {collapsed ? '🤖' : '🤖 Bot Admin'}
        </div>
        <Menu
          theme="dark"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ background: 'var(--bg-surface)', borderRight: 0 }}
        />
      </Sider>

      <Layout>
        <Header
          style={{
            background: 'var(--bg-surface)',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 12,
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <UserAvatar user={user} onLogout={logout} />
        </Header>
        <Content
          style={{
            margin: 24,
            background: 'var(--bg-surface)',
            borderRadius: 8,
            padding: 24,
            minHeight: 360,
            border: '1px solid var(--border-subtle)',
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
