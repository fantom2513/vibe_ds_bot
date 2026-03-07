import { Avatar, Dropdown, Space, Typography } from 'antd'
import { LogoutOutlined, UserOutlined } from '@ant-design/icons'

export default function UserAvatar({ user, onLogout }) {
  const items = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Logout',
      danger: true,
      onClick: onLogout,
    },
  ]
  return (
    <Dropdown menu={{ items }} placement="bottomRight">
      <Space style={{ cursor: 'pointer', color: 'var(--text-primary)' }}>
        <Avatar src={user?.avatar} icon={<UserOutlined />} size="small" />
        <Typography.Text style={{ color: 'var(--text-primary)' }}>
          {user?.username}
        </Typography.Text>
      </Space>
    </Dropdown>
  )
}
