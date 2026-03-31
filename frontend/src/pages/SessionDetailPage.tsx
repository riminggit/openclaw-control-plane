import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useConnectionState } from '../hooks/useGateway'
import { gatewayClient } from '../lib/gateway-client'

export function SessionDetailPage() {
  const { t } = useTranslation()
  const { key } = useParams<{ key: string }>()
  const connState = useConnectionState()
  const [messages, setMessages] = useState<any[]>([])
  const [sessionInfo, setSessionInfo] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [inputMsg, setInputMsg] = useState('')
  const [sending, setSending] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editModel, setEditModel] = useState('')
  const [editThinking, setEditThinking] = useState('')

  const fetchHistory = useCallback(async () => {
    if (!key) return
    try {
      const res = await gatewayClient.call('sessions.get', { sessionKey: key, limit: 100, includeTools: true })
      setMessages(res?.messages || [])
    } catch { /* */ } finally { setLoading(false) }
  }, [key])

  useEffect(() => { if (connState === 'connected') fetchHistory() }, [connState, fetchHistory])

  const handleSend = async () => {
    if (!inputMsg.trim() || !key) return
    setSending(true)
    try {
      await gatewayClient.call('sessions.send', { sessionKey: key, message: inputMsg.trim() })
      setInputMsg('')
      setTimeout(fetchHistory, 1500)
    } catch { /* */ } finally { setSending(false) }
  }

  const handleAbort = async () => {
    try { await gatewayClient.call('sessions.abort', { sessionKey: key }) } catch { /* */ }
  }

  const handlePatch = async () => {
    if (!key) return
    const patch: any = {}
    if (editModel) patch.model = editModel
    if (editThinking) patch.thinking = editThinking === 'on'
    try {
      await gatewayClient.call('sessions.patch', { sessionKey: key, ...patch })
      setEditing(false)
      fetchHistory()
    } catch { /* */ }
  }

  if (connState !== 'connected') {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🔌</div>
        <div className="empty-state-title">{t('dashboard.not_connected')}</div>
        <Link to="/settings" className="btn btn-primary" style={{ textDecoration: 'none' }}>{t('gateway.go_settings')}</Link>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <Link to="/sessions" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: 'var(--text-sm)' }}>{t('app.back')}</Link>
        <h1 style={{ marginTop: 'var(--space-2)', wordBreak: 'break-all' }}>{t('session_detail.title')}：{key}</h1>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
        <button className="btn btn-danger" onClick={handleAbort}>{t('session_detail.abort')}</button>
        <button className="btn btn-secondary" onClick={() => { setEditModel(''); setEditThinking('off'); setEditing(!editing) }}>
          {t('session_detail.edit_config')}
        </button>
      </div>

      {editing && (
        <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
          <div className="card-body" style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'end', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={{ display: 'block', fontWeight: 500, marginBottom: 'var(--space-1)' }}>{t('session_detail.model')}</label>
              <input className="form-input" style={{ width: '100%' }} value={editModel} onChange={e => setEditModel(e.target.value)} placeholder="model name" />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 500, marginBottom: 'var(--space-1)' }}>{t('session_detail.thinking')}</label>
              <select className="form-input" value={editThinking} onChange={e => setEditThinking(e.target.value)}>
                <option value="on">{t("app.on")}</option>
                <option value="off">{t("app.off")}</option>
              </select>
            </div>
            <button className="btn btn-primary" onClick={handlePatch}>{t('app.save')}</button>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="card">
        <div className="card-header">
          <h2>{t('session_detail.history')}</h2>
          <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>{t('app.total', { count: messages.length })}</span>
        </div>
        {loading ? (
          <div className="card-body" style={{ textAlign: 'center', padding: 'var(--space-10)' }}>{t('app.loading')}</div>
        ) : messages.length === 0 ? (
          <div className="card-body empty-state" style={{ padding: 'var(--space-10)' }}>
            <div className="empty-state-desc">{t('session_detail.no_history')}</div>
          </div>
        ) : (
          <div className="card-body" style={{ maxHeight: 600, overflow: 'auto' }}>
            {messages.map((msg: any, i: number) => (
              <div key={i} style={{ padding: 'var(--space-3)', borderBottom: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-1)' }}>
                  <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                    {msg.role === 'user' ? '👤' : msg.role === 'assistant' ? '🤖' : '🔧'} {msg.role}
                    {msg.toolName && <span className="badge badge-active" style={{ marginLeft: 'var(--space-2)', fontSize: 'var(--text-xs)' }}>{msg.toolName}</span>}
                  </span>
                  <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>{msg.timestamp ? new Date(msg.timestamp).toLocaleString() : ''}</span>
                </div>
                <div style={{ fontSize: 'var(--text-sm)', whiteSpace: 'pre-wrap', color: 'var(--text-primary)', wordBreak: 'break-word' }}>
                  {typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content, null, 2)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Send message */}
      <div className="card" style={{ marginTop: 'var(--space-4)' }}>
        <div className="card-body" style={{ display: 'flex', gap: 'var(--space-3)' }}>
          <input className="form-input" style={{ flex: 1 }} value={inputMsg} onChange={e => setInputMsg(e.target.value)} placeholder={t('session_detail.send_placeholder')} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()} />
          <button className="btn btn-primary" onClick={handleSend} disabled={sending || !inputMsg.trim()}>{sending ? '...' : t('session_detail.send')}</button>
        </div>
      </div>
    </div>
  )
}
