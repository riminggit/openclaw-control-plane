import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { gatewayClient, GatewayClient } from '../lib/gateway-client'
import { useConnectionState } from '../hooks/useGateway'

export function GatewaySettingsPage() {
  const { t } = useTranslation()
  const connState = useConnectionState()
  const [url, setUrl] = useState(GatewayClient.loadConfig().url)
  const [token, setToken] = useState(GatewayClient.loadConfig().token)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => { setSaved(false); setTestResult(null) }, [])

  const handleSave = () => {
    GatewayClient.saveConfig(url, token)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleTest = async () => {
    setTesting(true); setTestResult(null)
    try {
      await new Promise<void>((resolve, reject) => {
        const testClient = new GatewayClient()
        testClient.onStateChange((s) => {
          if (s === 'connected') { testClient.disconnect(); resolve() }
          if (s === 'error') { testClient.disconnect(); reject(new Error('Connection failed')) }
        })
        testClient.connect(url, token)
        setTimeout(() => { testClient.disconnect(); reject(new Error('Timeout')) }, 10000)
      })
      setTestResult('ok')
    } catch (e: any) {
      setTestResult(e.message)
    } finally { setTesting(false) }
  }

  const handleConnect = () => {
    if (!token) return
    GatewayClient.saveConfig(url, token)
    gatewayClient.connect(url, token)
  }

  const handleDisconnect = () => {
    gatewayClient.disconnect()
  }

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

  return (
    <div>
      <div className="page-header">
        <p className="page-header-eyebrow">{t('gateway.eyebrow')}</p>
        <h1>{t('gateway.title')}</h1>
        <p className="page-header-desc">{t('gateway.subtitle')}</p>
      </div>

      <div style={{ maxWidth: 600 }}>
        <div className="card">
          <div className="card-header"><h2>{t('gateway.config')}</h2></div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 500, marginBottom: 'var(--space-1)' }}>{t('gateway.url_label')}</label>
              <input className="form-input" style={{ width: '100%' }} value={url} onChange={e => setUrl(e.target.value)} placeholder="ws://127.0.0.1:18789/" />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 500, marginBottom: 'var(--space-1)' }}>{t('gateway.token_label')}</label>
              <input className="form-input" style={{ width: '100%' }} type="password" value={token} onChange={e => setToken(e.target.value)} placeholder="Gateway Token" />
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
              <button className="btn btn-primary" onClick={handleSave} disabled={!url}>{t('app.save')}</button>
              <button className="btn btn-secondary" onClick={handleTest} disabled={testing || !url}>
                {testing ? t('app.loading') : t('gateway.test_btn')}
              </button>
              {connState === 'connected' ? (
                <button className="btn btn-danger" onClick={handleDisconnect}>{t('gateway.disconnect')}</button>
              ) : (
                <button className="btn btn-primary" onClick={handleConnect} disabled={!url || !token}>{t('gateway.connect')}</button>
              )}
            </div>
            {saved && <span style={{ color: 'var(--status-green)', fontSize: 'var(--text-sm)' }}>✓ {t('gateway.saved')}</span>}
            {testResult && (
              <span style={{ color: testResult === 'ok' ? 'var(--status-green)' : 'var(--status-red)', fontSize: 'var(--text-sm)' }}>
                {testResult === 'ok' ? `✓ ${t('gateway.test_ok')}` : `✗ ${testResult}`}
              </span>
            )}
          </div>
        </div>

        <div className="card" style={{ marginTop: 'var(--space-4)' }}>
          <div className="card-header">
            <h2>{t('gateway.status')}</h2>
          </div>
          <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: stateColors[connState], display: 'inline-block' }} />
            <span>{stateLabels[connState]}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
