import { useEffect, useState } from 'react'
import { Outlet, NavLink, useLocation } from 'react-router-dom'
import {
  Box, Drawer, List, ListItemButton, ListItemIcon, ListItemText,
  Avatar, IconButton, Tooltip, useMediaQuery,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { AnimatePresence } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import BrandMark from './BrandMark'
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
  QueryStatsOutlined,
} from '@mui/icons-material'

const RAIL_WIDTH = 208
const RAIL_WIDTH_COLLAPSED = 72
const TOPBAR_HEIGHT = 56
const CONTENT_MAX_WIDTH = 1440
const SIDEBAR_COLLAPSED_STORAGE_KEY = 'vibe.admin.sidebarCollapsed'

const navItems = [
  { path: '/', label: 'Обзор', Icon: DashboardOutlined },
  { path: '/rules', label: 'Правила', Icon: ListAltOutlined },
  { path: '/users', label: 'Участники', Icon: GroupOutlined },
  { path: '/kick-targets', label: 'Кик-цели', Icon: FlashOnOutlined },
  { path: '/stacking-pairs', label: 'Стаки', Icon: PeopleOutlined },
  { path: '/tracking', label: 'Отслеживание', Icon: QueryStatsOutlined },
  { path: '/schedules', label: 'Расписания', Icon: AccessTimeOutlined },
  { path: '/logs', label: 'Журнал', Icon: ArticleOutlined },
  { path: '/settings', label: 'Настройки', Icon: SettingsOutlined },
]

function readStoredCollapsed() {
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

function NavList({ collapsed }) {
  const location = useLocation()

  return (
    <List
      component="nav"
      aria-label="Основная навигация"
      sx={{ flex: 1, pt: 1, px: collapsed ? 0.75 : 1.25, overflowY: 'auto', overflowX: 'hidden' }}
    >
      {navItems.map(({ path, label, Icon }) => {
        const active = location.pathname === path
        const item = (
          <ListItemButton
            component={NavLink}
            to={path}
            end={path === '/'}
            aria-label={collapsed ? label : undefined}
            sx={{
              borderRadius: 2,
              mb: 0.5,
              minHeight: 44,
              justifyContent: collapsed ? 'center' : 'flex-start',
              px: collapsed ? 1 : 1.5,
              color: 'var(--color-text-secondary)',
              textDecoration: 'none',
              border: '1px solid transparent',
              transition: 'background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease',
              '&:hover': {
                backgroundColor: 'var(--color-bg-elevated)',
                color: 'var(--color-text-primary)',
              },
              ...(active && {
                backgroundColor: 'rgba(101, 198, 156, 0.10)',
                borderColor: 'var(--color-action-primary)',
                color: 'var(--color-text-primary)',
              }),
            }}
          >
            <ListItemIcon sx={{ minWidth: collapsed ? 0 : 32, color: 'inherit' }}>
              <Icon sx={{ fontSize: 18 }} />
            </ListItemIcon>
            {!collapsed && (
              <ListItemText
                primary={label}
                primaryTypographyProps={{ fontSize: '0.85rem', fontWeight: active ? 600 : 500 }}
              />
            )}
          </ListItemButton>
        )

        return collapsed ? (
          <Tooltip key={path} title={label} placement="right">
            {item}
          </Tooltip>
        ) : (
          <Box key={path}>{item}</Box>
        )
      })}
    </List>
  )
}

function SidebarHeader({ collapsed, onToggle }) {
  return (
    <Box sx={{
      height: TOPBAR_HEIGHT,
      display: 'flex',
      alignItems: 'center',
      px: collapsed ? 0 : 2,
      justifyContent: collapsed ? 'center' : 'space-between',
      borderBottom: '1px solid var(--color-border)',
      flexShrink: 0,
    }}>
      {!collapsed && <BrandMark />}
      {onToggle && (
        <IconButton
          size="small"
          onClick={onToggle}
          aria-label={collapsed ? 'Развернуть меню' : 'Свернуть меню'}
          sx={{ color: 'var(--color-text-secondary)', '&:hover': { color: 'var(--color-text-primary)' } }}
        >
          {collapsed ? <MenuOutlined fontSize="small" /> : <ChevronLeftOutlined fontSize="small" />}
        </IconButton>
      )}
    </Box>
  )
}

function SidebarFooter({ collapsed, user, logout }) {
  if (collapsed) {
    return (
      <Box sx={{ p: 1, borderTop: '1px solid var(--color-border)' }}>
        <Tooltip title={`${user?.username ?? ''} — Выйти`} placement="right">
          <IconButton
            onClick={logout}
            size="small"
            aria-label="Выйти"
            sx={{ color: 'var(--color-text-secondary)', '&:hover': { color: 'var(--color-status-danger)' } }}
          >
            <LogoutOutlined fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    )
  }

  return (
    <Box sx={{
      p: 1.5,
      borderTop: '1px solid var(--color-border)',
      display: 'flex',
      alignItems: 'center',
      gap: 1,
      justifyContent: 'space-between',
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, overflow: 'hidden' }}>
        <Avatar src={user?.avatar} sx={{ width: 26, height: 26, border: '1px solid var(--color-border)' }} />
        <Box sx={{
          fontSize: '0.78rem',
          color: 'var(--color-text-secondary)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {user?.username}
        </Box>
      </Box>
      <Tooltip title="Выйти">
        <IconButton
          size="small"
          onClick={logout}
          aria-label="Выйти"
          sx={{ color: 'var(--color-text-secondary)', flexShrink: 0, '&:hover': { color: 'var(--color-status-danger)' } }}
        >
          <LogoutOutlined sx={{ fontSize: 15 }} />
        </IconButton>
      </Tooltip>
    </Box>
  )
}

function SidebarContent({ collapsed, onToggle, user, logout }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <SidebarHeader collapsed={collapsed} onToggle={onToggle} />
      <NavList collapsed={collapsed} />
      <SidebarFooter collapsed={collapsed} user={user} logout={logout} />
    </Box>
  )
}

function MobileTopBar({ onMenuClick, user }) {
  return (
    <Box sx={{
      height: TOPBAR_HEIGHT,
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      px: 2,
      gap: 1,
      borderBottom: '1px solid var(--color-border)',
      backgroundColor: 'var(--color-bg-sidebar)',
      position: 'sticky',
      top: 0,
      zIndex: 10,
    }}>
      <IconButton
        onClick={onMenuClick}
        aria-label="Открыть меню"
        sx={{ color: 'var(--color-text-secondary)', minWidth: 44, minHeight: 44 }}
      >
        <MenuOutlined />
      </IconButton>
      <BrandMark size={20} />
      <Avatar src={user?.avatar} sx={{ width: 28, height: 28, border: '1px solid var(--color-border)' }} />
    </Box>
  )
}

export default function AppLayout() {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const { user, logout } = useAuth()
  const location = useLocation()

  const [collapsed, setCollapsed] = useState(readStoredCollapsed)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(collapsed))
    } catch {
      // localStorage unavailable (e.g. private mode) — collapsed state just
      // won't persist across reloads.
    }
  }, [collapsed])

  // Close the mobile drawer whenever the route changes via a nav click.
  useEffect(() => { setMobileOpen(false) }, [location.pathname])

  const contentSx = {
    flex: 1,
    minWidth: 0,
    px: { xs: 2, sm: 3, md: 4 },
    py: { xs: 2, sm: 3, md: 4 },
  }

  const contentInner = (
    <Box sx={{ maxWidth: CONTENT_MAX_WIDTH, mx: 'auto' }}>
      <AnimatePresence mode="wait">
        <Outlet key={location.pathname} />
      </AnimatePresence>
    </Box>
  )

  if (isMobile) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: 'var(--color-bg-canvas)' }}>
        <MobileTopBar onMenuClick={() => setMobileOpen(true)} user={user} />
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: false }}
          sx={{ '& .MuiDrawer-paper': { width: RAIL_WIDTH, boxSizing: 'border-box' } }}
        >
          <SidebarContent collapsed={false} onToggle={null} user={user} logout={logout} />
        </Drawer>
        <Box component="main" sx={contentSx}>
          {contentInner}
        </Box>
      </Box>
    )
  }

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--color-bg-canvas)' }}>
      <Drawer
        variant="permanent"
        sx={{
          width: collapsed ? RAIL_WIDTH_COLLAPSED : RAIL_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: collapsed ? RAIL_WIDTH_COLLAPSED : RAIL_WIDTH,
            boxSizing: 'border-box',
            position: 'relative',
            backgroundColor: 'var(--color-bg-sidebar)',
            borderRight: '1px solid var(--color-border)',
            transition: 'width 0.2s ease',
          },
        }}
      >
        <SidebarContent
          collapsed={collapsed}
          onToggle={() => setCollapsed(c => !c)}
          user={user}
          logout={logout}
        />
      </Drawer>
      <Box component="main" sx={contentSx}>
        {contentInner}
      </Box>
    </Box>
  )
}
