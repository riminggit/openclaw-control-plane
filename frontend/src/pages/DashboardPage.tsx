import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useGatewayStatus, useSessions } from '../hooks/useGateway'
import { useConnectionState } from '../hooks/useGateway'
import { Link } from 'react-router-dom'

export function DashboardPage() {
  const { t } = useTranslation()
  const connState = useConnectionState()
  const { status, health, loading } = useGatewayStatus()
  const { sessions, loading: sessionsLoading } = useSessions(20)

  if (connState !== 'connected') {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🔌</div>
        <div className="empty-state-title">{t('dashboard.not_connected')}</div>
        <div className="empty-state-desc">{t('dashboard.connect_hint')}</div>
        <Link to="/settings" className="btn btn-primary" style={{ textDecoration: 'none' }}>{t('gateway.go_settings')}</Link>
      </div>
    )
  }

  const activeSessions = (sessions || []).filter((s: any) => s.active || s.state === 'active')
  const modelInfo = status?.model || status?.config?.model || '-'

  return (
    <div>
      <div className="page-header">
        <p className="page-header-eyebrow">{t('dashboard.eyebrow')}</p>
        <h1>{t('dashboard.title')}</h1>
        <p className="page-header-desc">{t('dashboard.subtitle')}</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-icon projects">💬</div>
          <div className="stat-card-label">{t('dashboard.active_sessions')}</div>
          <div className="stat-card-value">{activeSessions.length}</div>
          <div className="stat-card-bg" style={{ background: 'var(--status-blue)' }} />
        </div>
        <div className="stat-card">
          <div className="stat-card-icon tasks">🤖</div>
          <div className="stat-card-label">{t('dashboard.total_sessions')}</div>
          <div className="stat-card-value">{(sessions || []).length}</div>
          <div className="stat-card-bg" style={{ background: 'var(--status-purple)' }} />
        </div>
        <div className="stat-card">
          <div className="stat-card-icon progress">🧠</div>
          <div className="stat-card-label">{t('dashboard.model')}</div>
          <div className="stat-card-value" style={{ fontSize: 'var(--text-sm)' }}>{modelInfo}</div>
          <div className="stat-card-bg" style={{ background: 'var(--status-green)' }} />
        </div>
        <div className="stat-card">
          <div className="stat-card-icon blocked">💚</div>
          <div className="stat-card-label">{t('gateway.health')}</div>
          <div className="stat-card-value" style={{ color: health ? 'var(--status-green)' : 'var(--status-red)' }}>
            {health ? 'OK' : '-'}
          </div>
          <div className="stat-card-bg" style={{ background: health ? 'var(--status-green)' : 'var(--status-red)' }} />
        </div>
      </div>

      <div className="card" style={{ marginTop: 'var(--space-4)' }}>
        <div className="card-header">
          <h2>{t('dashboard.recent_sessions')}</h2>
          <Link to="/sessions" className="btn btn-ghost" style={{ fontSize: 'var(--text-sm)' }}>{t('dashboard.view_all')}</Link>
        </div>
        {sessionsLoading ? (
          <div className="card-body" style={{ textAlign: 'center', padding: 'var(--space-10)' }}>{t('app.loading')}</div>
        ) : (!sessions || sessions.length === 0) ? (
          <div className="card-body empty-state" style={{ padding: 'var(--space-10)' }}>
            <div className="empty-state-desc">{t('dashboard.no_sessions')}</div>
          </div>
        ) : (
          <div className="table-wrapper" style={{ borderRadius: 0, border: 'none' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('sessions.key')}</th>
                  <th>{t('sessions.agent')}</th>
                  <th>{t('sessions.state')}</th>
                  <th>{t('sessions.messages')}</th>
                  <th>{t('sessions.last_active')}</th>
                </tr>
              </thead>
              <tbody>
                {sessions.slice(0, 10).map((s: any, i: number) => (
                  <tr key={s.key || s.sessionKey || i}>
                    <td className="mono"><Link to={`/sessions/${encodeURIComponent(s.key || s.sessionKey)}`}>{s.key || s.sessionKey}</Link></td>
                    <td>{s.agent || s.kind || '-'}</td>
                    <td><span className={`badge badge-${s.active || s.state === 'active' ? 'active' : 'archived'}`}>{s.active ? 'Active' : (s.state || '-')}</span></td>
                    <td>{s.messageCount ?? s.messages ?? '-'}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>{s.lastActive ? new Date(s.lastActive).toLocaleString() : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
