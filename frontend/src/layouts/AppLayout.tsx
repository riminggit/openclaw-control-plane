import { useState, useEffect } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Dropdown, Button } from 'antd'
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
  { to: '/agent-skills', labelKey: 'nav.agent_skills', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
  { to: '/channels', labelKey: 'nav.channels', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
  { to: '/logs', labelKey: 'nav.logs', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { to: '/services', labelKey: 'nav.services', icon: 'M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01' },
  { to: '/skills', labelKey: 'nav.skills', icon: 'M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z' },
  { to: '/memory', labelKey: 'nav.memory', icon: 'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4' },
  { to: '/usage', labelKey: 'nav.usage', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  { to: '/security', labelKey: 'nav.security', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
  { to: '/extensions', labelKey: 'nav.extensions', icon: 'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4' },
  { to: '/communication', labelKey: 'nav.communication', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
  { to: '/settings', labelKey: 'nav.settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c-.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573-1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
]

export function AppLayout() {
  const { t, i18n } = useTranslation()
  const { theme, setTheme } = useTheme()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const connState = useConnectionState()

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  const switchLang = (lang: string) => {
    i18n.changeLanguage(lang)
  }

  const switchTheme = (th: ThemeName) => {
    setTheme(th)
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
    '/agent-skills': t('nav.agent_skills'),
    '/channels': t('nav.channels'),
    '/logs': t('nav.logs'),
    '/settings': t('nav.settings'),
    '/services': t('nav.services'),
    '/skills': t('nav.skills'),
    '/memory': t('nav.memory'),
    '/usage': t('nav.usage'),
    '/security': t('nav.security'),
    '/extensions': t('nav.extensions'),
    '/communication': t('nav.communication'),
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
          <Button className="sidebar-toggle" type="text" icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: collapsed ? 'rotate(180deg)' : 'none', transition: 'transform var(--transition-fast)' }}><path d="M9 5l7 7-7 7" /></svg>} onClick={() => setCollapsed(!collapsed)} title={t("nav.toggle_sidebar")} />
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
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'currentColor', display: 'inline-block', flexShrink: 0 }} />
            {!collapsed && <span style={{ fontSize: 'var(--text-xs)' }}>{connState === 'connected' ? t('gateway.state_connected') : connState === 'connecting' ? t('gateway.state_connecting') : t('gateway.state_disconnected')}</span>}
          </div>
          <Dropdown
            menu={{
              items: THEMES.map(th => ({
                key: th.name,
                label: (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="theme-swatch" style={{ background: th.preview }} />
                    {t(`theme.${th.name}`)}
                  </span>
                ),
                onClick: () => switchTheme(th.name),
              })),
              selectedKeys: [theme],
            }}
            trigger={['click']}
            placement="topRight"
            overlayStyle={{ minWidth: collapsed ? 140 : 160 }}
          >
            <button className="sidebar-footer-btn" type="button">
              <span style={{ fontSize: 16, lineHeight: 1, flexShrink: 0 }}>🎨</span>
              {!collapsed && <span>{t('theme.label')}</span>}
            </button>
          </Dropdown>
          <Dropdown
            menu={{
              items: [
                { key: 'zh', label: '中文', onClick: () => switchLang('zh') },
                { key: 'en', label: 'English', onClick: () => switchLang('en') },
              ],
              selectedKeys: [i18n.language?.startsWith('zh') ? 'zh' : 'en'],
            }}
            trigger={['click']}
            placement="topRight"
            overlayStyle={{ minWidth: collapsed ? 120 : 140 }}
          >
            <button className="sidebar-footer-btn" type="button">
              <span style={{ fontSize: 16, lineHeight: 1, flexShrink: 0 }}>🌐</span>
              {!collapsed && <span>{i18n.language?.startsWith('zh') ? '中文' : 'English'}</span>}
            </button>
          </Dropdown>
        </div>
      </aside>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 99 }} onClick={() => setMobileOpen(false)} />
      )}
      <div className="main-wrapper" style={{ marginLeft: collapsed ? 'var(--sidebar-collapsed-width)' : 'var(--sidebar-width)' }}>
        <div className="topbar">
          <Button className="topbar-hamburger" type="text" icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 12h18M3 6h18M3 18h18" /></svg>} onClick={() => setMobileOpen(true)} />
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
