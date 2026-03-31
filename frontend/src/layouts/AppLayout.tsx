import { useState, useEffect, useRef } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useTheme, THEMES, type ThemeName } from '../components/ThemeProvider'

const navItems = [
  { to: '/', labelKey: 'nav.dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1' },
  { to: '/projects', labelKey: 'nav.projects', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
  { to: '/tasks', labelKey: 'nav.tasks', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
  { to: '/kanban', labelKey: 'nav.kanban', icon: 'M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2' },
]

export function AppLayout() {
  const { t, i18n } = useTranslation()
  const { theme, setTheme } = useTheme()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [langOpen, setLangOpen] = useState(false)
  const [themeOpen, setThemeOpen] = useState(false)
  const langRef = useRef<HTMLDivElement>(null)
  const themeRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) setLangOpen(false)
      if (themeRef.current && !themeRef.current.contains(e.target as Node)) setThemeOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const breadcrumbMap: Record<string, string> = {
    '/': t('nav.dashboard'),
    '/projects': t('nav.projects'),
    '/tasks': t('nav.tasks'),
    '/kanban': t('nav.kanban'),
  }

  const pathname = location.pathname
  let breadcrumbItems: { label: string; path?: string }[] = []
  if (pathname.startsWith('/projects/') && pathname.length > '/projects/'.length) {
    breadcrumbItems = [
      { label: t('nav.projects'), path: '/projects' },
      { label: 'Detail' },
    ]
  } else if (pathname.startsWith('/tasks/') && pathname.length > '/tasks/'.length) {
    breadcrumbItems = [
      { label: t('nav.tasks'), path: '/tasks' },
      { label: 'Detail' },
    ]
  } else {
    const label = breadcrumbMap[pathname]
    if (label) breadcrumbItems = [{ label }]
  }

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <aside className="sidebar" style={{ width: collapsed ? 'var(--sidebar-collapsed-width)' : 'var(--sidebar-width)' }}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
            {!collapsed && <span>{t('app.brand')}</span>}
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-nav-group-label">Main</div>
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
              title={collapsed ? t(item.labelKey) : undefined}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d={item.icon} />
              </svg>
              {!collapsed && <span>{t(item.labelKey)}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button className="sidebar-footer-btn" onClick={() => setCollapsed(v => !v)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: collapsed ? 'rotate(180deg)' : 'none', transition: 'transform var(--transition-fast)' }}>
              <path d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
            {!collapsed && <span>Collapse</span>}
          </button>

          {/* Theme */}
          <div ref={themeRef} style={{ position: 'relative' }}>
            <button className="sidebar-footer-btn" onClick={() => setThemeOpen(v => !v)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
              </svg>
              {!collapsed && <span>{t('theme.label')}</span>}
            </button>
            {themeOpen && (
              <div className="dropdown-menu">
                {THEMES.map(th => (
                  <button
                    key={th.name}
                    className={`dropdown-item${theme === th.name ? ' active' : ''}`}
                    onClick={() => { setTheme(th.name); setThemeOpen(false) }}
                  >
                    <span className="theme-swatch" style={{ background: th.preview }} />
                    {t(`theme.${th.name}`)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Language */}
          <div ref={langRef} style={{ position: 'relative' }}>
            <button className="sidebar-footer-btn" onClick={() => setLangOpen(v => !v)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {!collapsed && <span>{t('language.label')}</span>}
            </button>
            {langOpen && (
              <div className="dropdown-menu">
                {['zh', 'en'].map(lng => (
                  <button
                    key={lng}
                    className={`dropdown-item${i18n.language === lng ? ' active' : ''}`}
                    onClick={() => { i18n.changeLanguage(lng); localStorage.setItem('lang', lng); setLangOpen(false) }}
                  >
                    {t(`language.${lng}`)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 99 }} onClick={() => setMobileOpen(false)} />
      )}

      {/* Main */}
      <div className="main-wrapper" style={{ marginLeft: collapsed ? 'var(--sidebar-collapsed-width)' : 'var(--sidebar-width)' }}>
        {/* Topbar */}
        <div className="topbar">
          <button className="topbar-hamburger" onClick={() => setMobileOpen(true)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 12h18M3 6h18M3 18h18" />
            </svg>
          </button>
          <div className="breadcrumb">
            {breadcrumbItems.map((item, i) => (
              <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                {i > 0 && <span className="breadcrumb-sep">/</span>}
                {item.path ? (
                  <a href={item.path}>{item.label}</a>
                ) : (
                  <span className="breadcrumb-current">{item.label}</span>
                )}
              </span>
            ))}
          </div>
        </div>

        {/* Page */}
        <div className="page-content">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
