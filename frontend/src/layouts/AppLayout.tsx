import { useState, useEffect, useRef } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useTheme, THEMES, type ThemeName } from '../components/ThemeProvider'
import { useConnectionState } from '../hooks/useGateway'

const navItems = [
  { to: '/', labelKey: 'nav.dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1' },
  { to: '/projects', labelKey: 'nav.projects', icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z' },
  { to: '/tasks', labelKey: 'nav.tasks', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
  { to: '/kanban', labelKey: 'nav.kanban', icon: 'M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7' },
  { to: '/sessions', labelKey: 'nav.sessions', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
  { to: '/cron', labelKey: 'nav.cron', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
  { to: '/chat', labelKey: 'nav.chat', icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z' },
  { to: '/analytics/cost', labelKey: 'nav.analytics', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  { to: '/agents/lifecycle', labelKey: 'nav.lifecycle', icon: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z' },
  { to: '/agents-mgmt', labelKey: 'nav.agents_mgmt', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
  { to: '/channels', labelKey: 'nav.channels', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
  { to: '/logs', labelKey: 'nav.logs', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { to: '/settings', labelKey: 'nav.settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c-.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573-1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
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

  const connState = useConnectionState()

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) setLangOpen(false)
      if (themeRef.current && !themeRef.current.contains(e.target as Node)) setThemeOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const switchLang = (lang: string) => {
    i18n.changeLanguage(lang)
    setLangOpen(false)
  }

  const switchTheme = (t: ThemeName) => {
    setTheme(t)
    setThemeOpen(false)
  }

  const breadcrumbMap: Record<string, string> = {
    '/': t('nav.dashboard'),
    '/projects': t('nav.projects'),
    '/tasks': t('nav.tasks'),
    '/kanban': t('nav.kanban'),
    '/sessions': t('nav.sessions'),
    '/cron': t('nav.cron'),
    '/chat': t('nav.chat'),
    '/analytics/cost': t('nav.analytics'),
    '/agents/lifecycle': t('nav.lifecycle'),
    '/agents-mgmt': t('nav.agents_mgmt'),
    '/channels': t('nav.channels'),
    '/logs': t('nav.logs'),
    '/settings': t('nav.settings'),
  }
  const breadcrumbItems = location.pathname === '/' ? [{ label: breadcrumbMap['/'] }]
    : [{ label: breadcrumbMap['/'] || 'Home', path: '/' }, { label: breadcrumbMap[location.pathname] || location.pathname }]

  return (
    <div className={`app-shell${mobileOpen ? ' mobile-open' : ''}`}>
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
          <button className="sidebar-toggle" onClick={() => setCollapsed(!collapsed)} title={t("nav.toggle_sidebar")}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: collapsed ? 'rotate(180deg)' : 'none', transition: 'transform var(--transition-fast)' }}>
              <path d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        <nav className="sidebar-nav">
          {navItems.map(item => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`} onClick={() => setMobileOpen(false)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                <path d={item.icon} />
              </svg>
              {!collapsed && <span>{t(item.labelKey)}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="conn-indicator" style={{ color: connState === 'connected' ? 'var(--status-green)' : connState === 'connecting' ? 'var(--status-yellow)' : 'var(--text-muted)' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
            {!collapsed && <span style={{ fontSize: 'var(--text-xs)' }}>{connState === 'connected' ? t('gateway.state_connected') : connState === 'connecting' ? t('gateway.state_connecting') : t('gateway.state_disconnected')}</span>}
          </div>
          <div className="dropdown">
            <button className="dropdown-trigger" onClick={() => setThemeOpen(!themeOpen)}>
              🎨
              {!collapsed && <span>{t('theme.label')}</span>}
            </button>
            {themeOpen && (
              <div className="dropdown-menu">
                {THEMES.map((th) => (
                  <button key={th.name} className={`dropdown-item ${theme === th.name ? 'active' : ''}`} onClick={() => switchTheme(th.name)}>
                    <span className="color-dot" style={{ background: th.preview }} />
                    {!collapsed && <span>{t(`theme.${th.name}`)}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="dropdown">
            <button className="dropdown-trigger" onClick={() => setLangOpen(!langOpen)}>
              🌐
              {!collapsed && <span>{t('language.label')}</span>}
            </button>
            {langOpen && (
              <div className="dropdown-menu" ref={langRef}>
                <button className="dropdown-item" onClick={() => switchLang('zh')}>中文</button>
                <button className="dropdown-item" onClick={() => switchLang('en')}>English</button>
              </div>
            )}
          </div>
        </div>
      </aside>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 99 }} onClick={() => setMobileOpen(false)} />
      )}
      <div className="main-wrapper" style={{ marginLeft: collapsed ? 'var(--sidebar-collapsed-width)' : 'var(--sidebar-width)' }}>
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
        <div className="page-content">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
