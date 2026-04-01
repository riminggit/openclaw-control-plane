import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useConnectionState } from '../hooks/useGateway'
import { gatewayClient } from '../lib/gateway-client'
import { Button, Input, Select, Card, Empty, Spin } from 'antd'


/** Render message content which can be string, array of content blocks, or other */
function renderContent(content: any): string {
  if (!content) return ''
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content.map((block: any) => {
      if (block.type === 'text' && block.text) return block.text
      if (block.type === 'toolCall') return `🔧 ${block.name || 'tool'}(${JSON.stringify(block.arguments || {}).slice(0, 200)})`
      if (block.type === 'toolResult') return block.content ? String(block.content).slice(0, 200) : '✓ (no output)'
      if (block.type === 'thinking') return `💭 ${block.thinking || ''}`
      return JSON.stringify(block).slice(0, 200)
    }).join('\n')
  }
  return JSON.stringify(content, null, 2).slice(0, 2000)
}

export function SessionDetailPage() {
  const { t } = useTranslation()
  const { key } = useParams<{ key: string }>()
  const connState = useConnectionState()
  const [messages, setMessages] = useState<any[]>([])
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
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-16)', gap: 'var(--space-4)' }}>
        <div style={{ fontSize: '48px', opacity: 0.5 }}>🔌</div>
        <div style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--text-primary)' }}>{t('dashboard.not_connected')}</div>
        <Link to="/settings" className="btn btn-primary" style={{ textDecoration: 'none' }}>{t('gateway.go_settings')}</Link>
      </div>
    )
  }

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <Link to="/sessions" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: 'var(--text-sm)', display: 'inline-block', marginBottom: 'var(--space-2)' }}>
            ← {t('sessions.title')}
          </Link>
          <div className="page-eyebrow">{t('session_detail.eyebrow', '会话详情')}</div>
          <h1 className="page-title" style={{ wordBreak: 'break-all' }}>{t('session_detail.title')}：{key}</h1>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
        <Button danger onClick={handleAbort}>{t('session_detail.abort')}</Button>
        <Button type="text" onClick={fetchHistory}>🔄 {t('app.retry')}</Button>
        <Button onClick={() => { setEditModel(''); setEditThinking('off'); setEditing(!editing) }}>
          {t('session_detail.edit_config')}
        </Button>
      </div>

      {editing && (
        <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
          <div className="card-body" style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'end', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={{ display: 'block', fontWeight: 500, marginBottom: 'var(--space-1)' }}>{t('session_detail.model')}</label>
              <Input style={{ width: '100%' }} value={editModel} onChange={e => setEditModel(e.target.value)} placeholder="model name" />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 500, marginBottom: 'var(--space-1)' }}>{t('session_detail.thinking')}</label>
              <Select className="form-input" value={editThinking} onChange={e => setEditThinking(e)}>
                <Select.Option value="on">{t("app.on")}</Select.Option>
                <Select.Option value="off">{t("app.off")}</Select.Option>
              </Select>
            </div>
            <Button type="primary" onClick={handlePatch}>{t('app.save')}</Button>
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
                    {msg.role === 'user' ? '👤' : msg.role === 'assistant' ? '🤖' : msg.role === 'tool' ? '🔧' : '📝'} {msg.role}
                  </span>
                  <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>{msg.ts ? new Date(msg.ts).toLocaleString() : ''}</span>
                </div>
                <pre style={{ fontSize: 'var(--text-sm)', whiteSpace: 'pre-wrap', color: 'var(--text-primary)', wordBreak: 'break-word', fontFamily: 'inherit', margin: 0 }}>
                  {renderContent(msg.content)}
                </pre>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Send message */}
      <div className="card" style={{ marginTop: 'var(--space-4)' }}>
        <div className="card-body" style={{ display: 'flex', gap: 'var(--space-3)' }}>
          <Input style={{ flex: 1 }} value={inputMsg} onChange={e => setInputMsg(e.target.value)} placeholder={t('session_detail.send_placeholder')} onPressEnter={e => !e.shiftKey && handleSend()} />
          <Button type="primary" onClick={handleSend} disabled={sending || !inputMsg.trim()}>{sending ? '...' : t('session_detail.send')}</Button>
        </div>
      </div>
    </div>
  )
}
