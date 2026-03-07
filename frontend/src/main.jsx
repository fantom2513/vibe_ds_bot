import './styles/global.css'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ConfigProvider, theme } from 'antd'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import AppLayout from './components/AppLayout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Rules from './pages/Rules'
import Users from './pages/Users'
import Schedules from './pages/Schedules'
import Logs from './pages/Logs'
import Settings from './pages/Settings'

ReactDOM.createRoot(document.getElementById('root')).render(
  <ConfigProvider
    theme={{
      algorithm: theme.darkAlgorithm,
      token: {
        colorPrimary:         '#5865F2',
        colorBgBase:          '#0d0e11',
        colorBgContainer:     '#13151a',
        colorBgElevated:      '#1a1d24',
        colorBgLayout:        '#0d0e11',
        colorBorder:          '#2a2d36',
        colorBorderSecondary: '#1f2229',
        colorText:            '#e8eaf0',
        colorTextSecondary:   '#8b8fa8',
        colorTextDisabled:    '#4a4d5e',
        fontFamily:           "-apple-system, 'Segoe UI', sans-serif",
        fontSize:             13,
        borderRadius:         6,
        borderRadiusLG:       8,
        paddingLG:            16,
        paddingMD:            12,
        lineHeight:           1.5,
      },
      components: {
        Layout: {
          siderBg:   '#13151a',
          headerBg:  '#13151a',
          bodyBg:    '#0d0e11',
          triggerBg: '#1a1d24',
        },
        Menu: {
          darkItemBg:            '#13151a',
          darkSubMenuItemBg:     '#13151a',
          darkItemSelectedBg:    '#1a1d24',
          darkItemSelectedColor: '#5865F2',
          darkItemColor:         '#8b8fa8',
          darkItemHoverColor:    '#e8eaf0',
          itemHeight:            40,
          fontSize:              13,
        },
        Table: {
          colorBgContainer:  '#13151a',
          headerBg:          '#0d0e11',
          rowHoverBg:        '#1a1d24',
          borderColor:       '#2a2d36',
          headerSplitColor:  '#2a2d36',
          fontSize:          13,
          cellPaddingBlock:  8,
          cellPaddingInline: 12,
        },
        Card: {
          colorBgContainer:    '#13151a',
          colorBorderSecondary:'#2a2d36',
          paddingLG:           16,
        },
        Drawer: { colorBgElevated: '#1a1d24' },
        Modal:  { colorBgElevated: '#1a1d24' },
        Input: {
          colorBgContainer:  '#1e2128',
          activeBorderColor: '#5865F2',
          hoverBorderColor:  '#4a4d5e',
          fontSize:          13,
        },
        Select: {
          colorBgContainer: '#1e2128',
          colorBgElevated:  '#1a1d24',
          optionSelectedBg: '#2a2d36',
        },
        Switch: {
          colorPrimary:      '#5865F2',
          colorPrimaryHover: '#4752c4',
        },
        Tag: {
          fontSize:   11,
          fontFamily: "'IBM Plex Mono', monospace",
        },
        Badge: { colorBgContainer: '#13151a' },
      },
    }}
  >
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/rules" element={<Rules />} />
              <Route path="/users" element={<Users />} />
              <Route path="/schedules" element={<Schedules />} />
              <Route path="/logs" element={<Logs />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </ConfigProvider>
)
