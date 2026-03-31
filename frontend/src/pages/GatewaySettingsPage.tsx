import { useTranslation } from 'react-i18next'
import { useConnectionState } from '../hooks/useGateway'

export function GatewaySettingsPage() {
  const { t } = useTranslation()
  const connState = useConnectionState()

  const stateLabels: Record<string, string> = {
    connected: t('gateway.state_connected'),
    connecting: t('gateway.state_connecting'),
    disconnected: t('gateway.state_disconnected'),
    error: t('gateway.state_error'),
  }
  const stateColors: Record<string, string> = {
    connected: 'var(--status-green)',
    connecting: 'var(--status-yellow)',
    disconnected: 'var(--text-muted)',
    error: 'var(--status-red)',
  }
  const stateIcons: Record<string, string> = {
    connected: '🟢',
    connecting: '🟡',
    disconnected: '⚫',
    error: '🔴',
  }

  return (
    <div>
      <div className="page-header">
        <p className="page-header-eyebrow">{t('gateway.eyebrow')}</p>
        <h1>{t('gateway.title')}</h1>
        <p className="page-header-desc">{t('gateway.subtitle')}</p>
      </div>

      <div style={{ maxWidth: 600 }}>
        <div className="card">
          <div className="card-header">
            <h2>{t('gateway.status')}</h2>
          </div>
          <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <span style={{ fontSize: 20 }}>{stateIcons[connState]}</span>
            <span style={{ fontWeight: 500, color: stateColors[connState] }}>{stateLabels[connState]}</span>
          </div>
          <div className="card-body" style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
            {t('gateway.proxy_note')}
          </div>
        </div>
      </div>
    </div>
  )
}
