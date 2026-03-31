import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { channelsApi, type Channel } from '../api/modules/channels'

const CHANNEL_TYPES: { type: string; name: string; icon: string; fields: { key: string; label: string; placeholder: string; type?: 'password' }[] }[] = [
  { type: 'telegram', name: 'Telegram', icon: '✈️', fields: [
    { key: 'botToken', label: 'Bot Token', placeholder: '123456:ABC-DEF...' },
  ]},
  { type: 'discord', name: 'Discord', icon: '🎮', fields: [
    { key: 'botToken', label: 'Bot Token', placeholder: 'Bot token from Discord Developer Portal' },
    { key: 'guildId', label: 'Guild ID', placeholder: 'Server ID' },
  ]},
  { type: 'qqbot', name: 'QQ Bot', icon: '🐧', fields: [
    { key: 'appId', label: 'App ID', placeholder: 'QQ Bot App ID' },
    { key: 'token', label: 'Token', placeholder: 'Access Token', type: 'password' },
    { key: 'secret', label: 'Secret', placeholder: 'App Secret', type: 'password' },
  ]},
  { type: 'feishu', name: '飞书', icon: '🐦', fields: [
    { key: 'appId', label: 'App ID', placeholder: '飞书应用 App ID' },
    { key: 'appSecret', label: 'App Secret', placeholder: '飞书应用 Secret', type: 'password' },
  ]},
  { type: 'dingtalk', name: '钉钉', icon: '💬', fields: [
    { key: 'clientKey', label: 'Client Key', placeholder: '钉钉应用 ClientKey' },
    { key: 'clientSecret', label: 'Client Secret', placeholder: 'Client Secret', type: 'password' },
  ]},
  { type: 'signal', name: 'Signal', icon: '🔒', fields: [
    { key: 'phoneNumber', label: 'Phone Number', placeholder: '+1234567890' },
  ]},
  { type: 'slack', name: 'Slack', icon: '📱', fields: [
    { key: 'botToken', label: 'Bot Token', placeholder: 'xoxb-...', type: 'password' },
    { key: 'appToken', label: 'App Token', placeholder: 'xapp-...', type: 'password' },
  ]},
]

export function ChannelsPage() {
  const { t } = useTranslation()
  const [channels, setChannels] = useState<Channel[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedType, setExpandedType] = useState<string | null>(null)
  const [formValues, setFormValues] = useState<Record<string, Record<string, string>>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [testing, setTesting] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; msg: string }>>({})

  const fetchChannels = useCallback(async () => {
    try {
      setLoading(true)
      const [list, statusList] = await Promise.all([
        channelsApi.list().catch(() => []),
        channelsApi.status().catch(() => []),
      ])
      // Merge status into list
      const statusMap = new Map((statusList as Channel[]).map(c => [c.type, c.status]))
      const merged = (list as Channel[]).map(c => ({ ...c, status: statusMap.get(c.type) || c.status || 'unconfigured' }))
      setChannels(merged)
      // Init form values from existing config
      const fv: Record<string, Record<string, string>> = {}
      for (const c of merged) {
        if (c.config) fv[c.type] = { ...c.config }
      }
      setFormValues(fv)
    } catch {
      setChannels([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchChannels() }, [fetchChannels])

  const updateForm = (type: string, key: string, value: string) => {
    setFormValues(prev => ({
      ...prev,
      [type]: { ...(prev[type] || {}), [key]: value },
    }))
  }

  const handleSave = async (type: string) => {
    setSaving(type)
    try {
      await channelsApi.save(type, formValues[type] || {})
      fetchChannels()
    } catch (e: any) {
      alert(e.message)
    } finally {
      setSaving(null)
    }
  }

  const handleTest = async (type: string) => {
    setTesting(type)
    try {
      const res = await channelsApi.test(type)
      setTestResults(prev => ({ ...prev, [type]: { ok: res.success, msg: res.message || (res.success ? '✅ Connected' : '❌ Failed') } }))
    } catch (e: any) {
      setTestResults(prev => ({ ...prev, [type]: { ok: false, msg: e.message } }))
    } finally {
      setTesting(null)
    }
  }

  const getStatusColor = (status: string) => {
    if (status === 'connected') return 'var(--status-green)'
    if (status === 'disconnected') return 'var(--status-red)'
    return 'var(--status-gray)'
  }

  const getStatusLabel = (status: string) => {
    if (status === 'connected') return t('channels.status_connected')
    if (status === 'disconnected') return t('channels.status_disconnected')
    return t('channels.status_unconfigured')
  }

  // Build channel map from API
  const channelMap = new Map(channels.map(c => [c.type, c]))

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <div className="page-eyebrow">{t('channels.eyebrow')}</div>
          <h1 className="page-title">{t('channels.title')}</h1>
          <p className="page-subtitle">{t('channels.subtitle')}</p>
        </div>
        <button className="btn btn-ghost" onClick={fetchChannels}>🔄 {t('channels.refresh')}</button>
      </div>

      {loading ? (
        <div className="skeleton-grid"><div className="skeleton-card" /><div className="skeleton-card" /><div className="skeleton-card" /></div>
      ) : (
        <div className="card-grid">
          {CHANNEL_TYPES.map(ch => {
            const existing = channelMap.get(ch.type)
            const isExpanded = expandedType === ch.type
            const status = existing?.status || 'unconfigured'

            return (
              <div key={ch.type} className="card" style={{ cursor: 'pointer' }} onClick={() => setExpandedType(isExpanded ? null : ch.type)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                  <span style={{ fontSize: 32 }}>{ch.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 'var(--text-lg)' }}>{ch.name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginTop: 4 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: getStatusColor(status) }} />
                      <span style={{ fontSize: 'var(--text-sm)', color: getStatusColor(status) }}>{getStatusLabel(status)}</span>
                    </div>
                  </div>
                  <span style={{ color: 'var(--text-muted)', transition: 'transform 150ms', transform: isExpanded ? 'rotate(180deg)' : 'none' }}>▼</span>
                </div>

                {isExpanded && (
                  <div style={{ marginTop: 'var(--space-4)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--border-default)' }} onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                      {ch.fields.map(f => (
                        <div key={f.key}>
                          <label style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', display: 'block', marginBottom: 'var(--space-1)' }}>{f.label}</label>
                          <input
                            className="input"
                            type={f.type || 'text'}
                            value={formValues[ch.type]?.[f.key] || ''}
                            onChange={e => updateForm(ch.type, f.key, e.target.value)}
                            placeholder={f.placeholder}
                          />
                        </div>
                      ))}
                      {testResults[ch.type] && (
                        <div style={{
                          padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-sm)',
                          background: testResults[ch.type].ok ? 'var(--status-green-bg)' : 'var(--status-red-bg)',
                          color: testResults[ch.type].ok ? 'var(--status-green)' : 'var(--status-red)',
                          fontSize: 'var(--text-sm)',
                        }}>
                          {testResults[ch.type].msg}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
                        <button className="btn btn-ghost" onClick={() => handleTest(ch.type)} disabled={testing === ch.type}>
                          {testing === ch.type ? '⏳...' : `🔌 ${t('channels.test_conn')}`}
                        </button>
                        <button className="btn btn-primary" onClick={() => handleSave(ch.type)} disabled={saving === ch.type}>
                          {saving === ch.type ? t('app.saving') : t('app.save')}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
