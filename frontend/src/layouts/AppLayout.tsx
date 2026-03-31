import { NavLink, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { NavbarRight } from '../components/NavbarRight'

export function AppLayout() {
  const { t } = useTranslation()

  const links = [
    { to: '/', label: t('nav.dashboard') },
    { to: '/projects', label: t('nav.projects') },
    { to: '/tasks', label: t('nav.tasks') },
    { to: '/kanban', label: t('nav.kanban') },
  ]

  return (
    <>
      <nav className="app-nav">
        <div className="nav-brand">{t('app.brand')}</div>
        {links.map(l => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.to === '/'}
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
          >
            {l.label}
          </NavLink>
        ))}
        <NavbarRight />
      </nav>
      <main className="page">
        <Outlet />
      </main>
    </>
  )
}
