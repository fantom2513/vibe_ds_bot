import './styles/tokens.css'
import './styles/global.css'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { theme } from './styles/theme'
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
import KickTargets from './pages/KickTargets'
import StackingPairs from './pages/StackingPairs'

ReactDOM.createRoot(document.getElementById('root')).render(
  <ThemeProvider theme={theme}>
    <CssBaseline />
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/rules" element={<Rules />} />
              <Route path="/users" element={<Users />} />
              <Route path="/kick-targets" element={<KickTargets />} />
              <Route path="/stacking-pairs" element={<StackingPairs />} />
              <Route path="/schedules" element={<Schedules />} />
              <Route path="/logs" element={<Logs />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </ThemeProvider>
)
