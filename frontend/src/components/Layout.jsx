import { Outlet, NavLink } from 'react-router-dom'
import LiveIndicator from './LiveIndicator'

export default function Layout() {
  return (
    <>
      <nav className="nav">
        <NavLink to="/dashboard" className={({ isActive }) => (isActive ? 'active' : '')}>
          Дашборд
        </NavLink>
        <NavLink to="/rules" className={({ isActive }) => (isActive ? 'active' : '')}>
          Правила
        </NavLink>
        <NavLink to="/users" className={({ isActive }) => (isActive ? 'active' : '')}>
          Списки
        </NavLink>
        <NavLink to="/schedules" className={({ isActive }) => (isActive ? 'active' : '')}>
          Расписания
        </NavLink>
        <NavLink to="/logs" className={({ isActive }) => (isActive ? 'active' : '')}>
          Логи
        </NavLink>
        <NavLink to="/mute-levels" className={({ isActive }) => (isActive ? 'active' : '')}>
          Мут XP
        </NavLink>
        <LiveIndicator />
        <NavLink to="/settings" className="settings-link">
          Настройки
        </NavLink>
      </nav>
      <Outlet />
    </>
  )
}
