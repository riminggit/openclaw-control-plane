import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useGatewayStatus, useSessions, useCronJobs, useModels, useConnectionState } from '../hooks/useGateway'
import { Link } from 'react-router-dom'

/** Auto-refresh hook: calls fn every intervalMs, returns refetch manually */
function useAutoRefresh(fn: () => void, intervalMs: number, deps: any[]) {
  useEffect(() => {
    fn()
    const timer = setInterval(fn, intervalMs)
    return () => clearInterval(timer)
  }, deps)
}

export function DashboardPage() {
  const { t } = useTranslation()
  const connState = useConnectionState()
  const { status, health, loading: statusLoading, refetch: refetchStatus } = useGatewayStatus()
  const { sessions, count, defaults, loading: sessionsLoading, refetch: refetchSessions } = useSessions(20)
  const { jobs, total: cronTotal, refetch: refetchCron } = useCronJobs()
  const { models } = useModels()

  // Auto-refresh every 30s
  useAutoRefresh(() => {
    refetchStatus()
    refetchSessions()
    refetchCron()
  }, 30000, [connState])

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
  const modelInfo = defaults?.model || status?.model || status?.config?.model || '-'
  const runtimeVersion = status?.runtimeVersion || '-'
  const enabledCronJobs = (jobs || []).filter((j: any) => j.enabled !== false).length

  // Helpers for session field mapping
  const sessionAgent = (s: any) => s.displayName || s.label || s.kind || s.agent || '-'
  const sessionUpdated = (s: any) => s.updatedAtMs || s.updatedAt || s.lastActive || null

  return (
    <div>
      <div className="page-header">
        <p className="page-header-eyebrow">{t('dashboard.eyebrow')}</p>
        <h1>{t('dashboard.title')}</h1>
        <p className="page-header.subtitle">{t('dashboard.subtitle')}</p>
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 'var(--space-1)' }}>
          Runtime {runtimeVersion} · Auto-refresh 30s
        </div>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
        <div className="stat-card">
          <div className="stat-card-icon projects">💬</div>
          <div className="stat-card-label">{t('dashboard.active_sessions')}</div>
          <div className="stat-card-value">{activeSessions.length}</div>
          <div className="stat-card-bg" style={{ background: 'var(--status-blue)' }} />
        </div>
        <div className="stat-card">
          <div className="stat-card-icon tasks">🤖</div>
          <div className="stat-card-label">{t('dashboard.total_sessions')}</div>
          <div className="stat-card-value">{count}</div>
          <div className="stat-card-bg" style={{ background: 'var(--status-purple)' }} />
        </div>
        <div className="stat-card">
          <div className="stat-card-icon progress">⏰</div>
          <div className="stat-card-label">{t('dashboard.cron_jobs')}</div>
          <div className="stat-card-value">{enabledCronJobs}/{cronTotal || (jobs || []).length}</div>
          <div className="stat-card-bg" style={{ background: 'var(--status-orange, #f59e0b)' }} />
        </div>
        <div className="stat-card">
          <div className="stat-card-icon blocked">🧠</div>
          <div className="stat-card-label">{t('dashboard.model')}</div>
          <div className="stat-card-value" style={{ fontSize: 'var(--text-sm)' }}>{modelInfo}</div>
          <div className="stat-card-bg" style={{ background: 'var(--status-green)' }} />
        </div>
        <div className="stat-card">
          <div className="stat-card-icon projects">💚</div>
          <div className="stat-card-label">{t('gateway.health')}</div>
          <div className="stat-card-value" style={{ color: health ? 'var(--status-green)' : 'var(--status-red)' }}>
            {health ? 'OK' : '-'}
          </div>
          <div className="stat-card-bg" style={{ background: health ? 'var(--status-green)' : 'var(--status-red)' }} />
        </div>
        <div className="stat-card">
          <div className="stat-card-icon tasks">📦</div>
          <div className="stat-card-label">{t('dashboard.runtime_version')}</div>
          <div className="stat-card-value" style={{ fontSize: 'var(--text-sm)' }}>{runtimeVersion}</div>
          <div className="stat-card-bg" style={{ background: 'var(--status-blue)' }} />
        </div>
      </div>

      {/* Models Card */}
      {models.length > 0 && (
        <div className="card" style={{ marginTop: 'var(--space-4)' }}>
          <div className="card-header">
            <h2>{t('dashboard.available_models')}</h2>
            <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>{t('app.total', { count: models.length })}</span>
          </div>
          <div className="card-body" style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            {models.slice(0, 20).map((m: any, i: number) => (
              <div key={m.id || i} style={{
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--surface-secondary, var(--card-bg, #1e1e2e))',
                border: '1px solid var(--border-color)',
                fontSize: 'var(--text-sm)',
              }}>
                <span style={{ fontWeight: 500 }}>{m.name || m.id}</span>
                {m.provider && <span style={{ color: 'var(--text-muted)', marginLeft: 'var(--space-2)' }}>({m.provider})</span>}
                {m.reasoning && <span style={{ marginLeft: 'var(--space-1)' }}>🧠</span>}
                {m.contextWindow && <span style={{ color: 'var(--text-muted)', marginLeft: 'var(--space-2)', fontSize: 'var(--text-xs)' }}>{(m.contextWindow / 1000).toFixed(0)}k</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Sessions */}
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
                  <th>{t('sessions.channel')}</th>
                  <th>{t('sessions.state')}</th>
                  <th>{t('sessions.last_active')}</th>
                </tr>
              </thead>
              <tbody>
                {sessions.slice(0, 10).map((s: any, i: number) => (
                  <tr key={s.key || s.sessionKey || i}>
                    <td className="mono"><Link to={`/sessions/${encodeURIComponent(s.key || s.sessionKey)}`}>{s.key || s.sessionKey}</Link></td>
                    <td>{sessionAgent(s)}</td>
                    <td>{s.channel || '-'}</td>
                    <td><span className={`badge badge-${s.active || s.state === 'active' ? 'active' : 'archived'}`}>{s.active ? 'Active' : (s.state || '-')}</span></td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                      {sessionUpdated(s) ? new Date(sessionUpdated(s)).toLocaleString() : '-'}
                    </td>
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
