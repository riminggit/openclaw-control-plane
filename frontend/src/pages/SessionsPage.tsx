import { useTranslation } from 'react-i18next'
import { useSessions, useConnectionState } from '../hooks/useGateway'
import { Link } from 'react-router-dom'

export function SessionsPage() {
  const { t } = useTranslation()
  const connState = useConnectionState()
  const { sessions, loading } = useSessions(50)

  if (connState !== 'connected') {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🔌</div>
        <div className="empty-state-title">{t('dashboard.not_connected')}</div>
        <Link to="/settings" className="btn btn-primary" style={{ textDecoration: 'none' }}>{t('gateway.go_settings')}</Link>
      </div>
    )
  }

  const total = sessions.length

  return (
    <div>
      <div className="page-header">
        <p className="page-header-eyebrow">{t('sessions.eyebrow')}</p>
        <h1>{t('sessions.title')}</h1>
        <p className="page-header-desc">{t('sessions.subtitle')}</p>
      </div>

      <div className="card">
        {loading ? (
          <div className="card-body" style={{ textAlign: 'center', padding: 'var(--space-10)' }}>{t('app.loading')}</div>
        ) : total === 0 ? (
          <div className="card-body empty-state" style={{ padding: 'var(--space-10)' }}>
            <div className="empty-state-icon">💬</div>
            <div className="empty-state-desc">{t('sessions.no_sessions')}</div>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('sessions.key')}</th>
                  <th>{t('sessions.agent')}</th>
                  <th>{t('sessions.channel')}</th>
                  <th>{t('sessions.tokens')}</th>
                  <th>{t('sessions.last_active')}</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s: any, i: number) => {
                  const key = s.key || s.sessionKey
                  return (
                    <tr key={key || i}>
                      <td className="mono" style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <Link to={`/sessions/${encodeURIComponent(key)}`}>{key}</Link>
                      </td>
                      <td>{s.kind || s.label || '-'}</td>
                      <td>{s.channel || '-'}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                        {s.totalTokens ? `${(s.totalTokens / 1000).toFixed(1)}k` : '-'}
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                        {s.updatedAt ? new Date(s.updatedAt).toLocaleString() : '-'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
