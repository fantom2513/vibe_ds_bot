import { useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import {
  Box, List, ListItemButton, ListItemIcon, ListItemText,
  Avatar, Typography, IconButton, Tooltip,
} from '@mui/material'
import { AnimatePresence } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import {
  DashboardOutlined,
  ListAltOutlined,
  GroupOutlined,
  AccessTimeOutlined,
  ArticleOutlined,
  SettingsOutlined,
  FlashOnOutlined,
  PeopleOutlined,
  ChevronLeftOutlined,
  MenuOutlined,
  LogoutOutlined,
} from '@mui/icons-material'

const SIDEBAR_WIDTH = 220
const SIDEBAR_COLLAPSED = 64

const navItems = [
  { path: '/',               label: 'Dashboard',      Icon: DashboardOutlined },
  { path: '/rules',          label: 'Rules',           Icon: ListAltOutlined },
  { path: '/users',          label: 'Users',           Icon: GroupOutlined },
  { path: '/kick-targets',   label: 'Kick Targets',    Icon: FlashOnOutlined },
  { path: '/stacking-pairs', label: 'Stacking Pairs',  Icon: PeopleOutlined },
  { path: '/schedules',      label: 'Schedules',       Icon: AccessTimeOutlined },
  { path: '/logs',           label: 'Logs',            Icon: ArticleOutlined },
  { path: '/settings',       label: 'Settings',        Icon: SettingsOutlined },
]

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const width = collapsed ? SIDEBAR_COLLAPSED : SIDEBAR_WIDTH

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>

      {/* Sidebar spacer */}
      <Box sx={{
        width,
        flexShrink: 0,
        transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1)',
      }} />

      {/* Sidebar fixed */}
      <Box sx={{
        width,
        height: '100vh',
        position: 'fixed',
        top: 0,
        left: 0,
        backgroundColor: 'rgba(6,8,16,0.85)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        backdropFilter: 'blur(20px)',
        transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        zIndex: 100,
      }}>

        {/* Logo */}
        <Box sx={{
          height: 60,
          display: 'flex',
          alignItems: 'center',
          px: collapsed ? 0 : 2,
          justifyContent: collapsed ? 'center' : 'space-between',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          flexShrink: 0,
        }}>
          {!collapsed && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{
                width: 28, height: 28, borderRadius: '8px',
                background: 'linear-gradient(135deg, #5865F2, #8b5cf6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '14px',
                boxShadow: '0 0 16px rgba(88,101,242,0.40)',
              }}>
                🤖
              </Box>
              <Typography sx={{
                fontFamily: "'Syne', sans-serif",
                fontWeight: 700,
                fontSize: '0.9rem',
                background: 'linear-gradient(135deg, #f0f2ff, #8892b0)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>
                Bot Admin
              </Typography>
            </Box>
          )}
          <IconButton
            size="small"
            onClick={() => setCollapsed(!collapsed)}
            sx={{ color: 'text.secondary', '&:hover': { color: 'text.primary' } }}
          >
            {collapsed
              ? <MenuOutlined fontSize="small" />
              : <ChevronLeftOutlined fontSize="small" />
            }
          </IconButton>
        </Box>

        {/* Nav */}
        <List sx={{ flex: 1, pt: 1, px: collapsed ? 0.5 : 1, overflowY: 'auto', overflowX: 'hidden' }}>
          {navItems.map(({ path, label, Icon }) => {
            const active = location.pathname === path
            return (
              <Tooltip key={path} title={collapsed ? label : ''} placement="right">
                <ListItemButton
                  onClick={() => navigate(path)}
                  sx={{
                    borderRadius: 2,
                    mb: 0.5,
                    minHeight: 38,
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    px: collapsed ? 1 : 1.5,
                    position: 'relative',
                    transition: 'all 0.15s ease',
                    backgroundColor: active ? 'rgba(88,101,242,0.12)' : 'transparent',
                    '&:hover': {
                      backgroundColor: active
                        ? 'rgba(88,101,242,0.16)'
                        : 'rgba(255,255,255,0.04)',
                    },
                    '&::before': active ? {
                      content: '""',
                      position: 'absolute',
                      left: 0, top: '20%', bottom: '20%',
                      width: 3,
                      borderRadius: '0 3px 3px 0',
                      backgroundColor: '#5865F2',
                      boxShadow: '0 0 8px rgba(88,101,242,0.6)',
                    } : {},
                  }}
                >
                  <ListItemIcon sx={{
                    minWidth: collapsed ? 0 : 32,
                    color: active ? '#7c85f5' : 'text.secondary',
                    transition: 'color 0.15s',
                  }}>
                    <Icon sx={{ fontSize: 17 }} />
                  </ListItemIcon>
                  {!collapsed && (
                    <ListItemText
                      primary={label}
                      primaryTypographyProps={{
                        fontSize: '0.82rem',
                        fontFamily: "'Syne', sans-serif",
                        fontWeight: active ? 600 : 400,
                        color: active ? '#e8eaff' : '#8892b0',
                      }}
                    />
                  )}
                </ListItemButton>
              </Tooltip>
            )
          })}
        </List>

        {/* User footer */}
        <Box sx={{
          p: collapsed ? 1 : 1.5,
          borderTop: '1px solid rgba(255,255,255,0.06)',
        }}>
          {collapsed ? (
            <Tooltip title={`${user?.username} — Logout`} placement="right">
              <IconButton
                onClick={logout}
                size="small"
                sx={{ color: 'text.secondary', '&:hover': { color: 'var(--red)' } }}
              >
                <LogoutOutlined fontSize="small" />
              </IconButton>
            </Tooltip>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, overflow: 'hidden' }}>
                <Avatar
                  src={user?.avatar}
                  sx={{ width: 26, height: 26, border: '1px solid rgba(255,255,255,0.10)' }}
                />
                <Typography sx={{
                  fontSize: '0.78rem',
                  color: 'text.secondary',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {user?.username}
                </Typography>
              </Box>
              <Tooltip title="Выйти">
                <IconButton
                  size="small"
                  onClick={logout}
                  sx={{ color: 'text.secondary', flexShrink: 0, '&:hover': { color: 'var(--red)' } }}
                >
                  <LogoutOutlined sx={{ fontSize: 15 }} />
                </IconButton>
              </Tooltip>
            </Box>
          )}
        </Box>

      </Box>

      {/* Main content */}
      <Box sx={{
        flex: 1,
        minWidth: 0,
        p: 3,
      }}>
        <AnimatePresence mode="wait">
          <Outlet />
        </AnimatePresence>
      </Box>

    </Box>
  )
}
