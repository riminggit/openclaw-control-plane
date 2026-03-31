import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useConnectionState } from '../hooks/useGateway'
import { gatewayClient } from '../lib/gateway-client'

interface ChatMsg {
  role: string
  content: string
  toolCalls?: any[]
  timestamp?: string
  _type?: 'user' | 'assistant' | 'tool'
}

export function ChatPage() {
  const { t } = useTranslation()
  const connState = useConnectionState()
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [aborting, setAborting] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  // Subscribe to chat events
  useEffect(() => {
    if (connState !== 'connected') return
    const off = gatewayClient.on('chat', (payload: any) => {
      const msg: ChatMsg = {
        role: payload.role || payload.author || 'assistant',
        content: typeof payload.content === 'string' ? payload.content : JSON.stringify(payload.content, null, 2),
        toolCalls: payload.toolCalls,
        timestamp: payload.timestamp || new Date().toISOString(),
        _type: payload.role === 'user' ? 'user' : 'assistant',
      }
      setMessages(prev => [...prev, msg])
      setSending(false)
    })
    return off
  }, [connState])

  // Subscribe to agent events for tool call outputs
  useEffect(() => {
    if (connState !== 'connected') return
    const off = gatewayClient.on('agent', (payload: any) => {
      // Append tool output as system message
      const text = typeof payload === 'string' ? payload : (payload.text || payload.output || JSON.stringify(payload))
      setMessages(prev => [...prev, { role: 'system', content: `🔧 ${text}`, timestamp: new Date().toISOString() }])
    })
    return off
  }, [connState])

  const handleSend = async () => {
    if (!input.trim()) return
    const msg = input.trim()
    setInput('')
    setSending(true)
    setMessages(prev => [...prev, { role: 'user', content: msg, timestamp: new Date().toISOString(), _type: 'user' }])
    try {
      await gatewayClient.call('chat.send', { message: msg, idempotencyKey: `${Date.now()}-${Math.random()}` })
    } catch {
      setMessages(prev => [...prev, { role: 'system', content: '❌ Failed to send', timestamp: new Date().toISOString() }])
      setSending(false)
    }
  }

  const handleAbort = async () => {
    setAborting(true)
    try { await gatewayClient.call('chat.abort', {}) } catch { /* */ } finally { setAborting(false) }
  }

  if (connState !== 'connected') {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🔌</div>
        <div className="empty-state-title">{t('dashboard.not_connected')}</div>
        <a href="/settings" className="btn btn-primary" style={{ textDecoration: 'none' }}>{t('gateway.go_settings')}</a>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - var(--topbar-height, 56px) - 80px)' }}>
      <div className="page-header" style={{ flexShrink: 0 }}>
        <h1>{t('chat.title')}</h1>
      </div>

      <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div className="card-body" style={{ flex: 1, overflow: 'auto' }}>
          {messages.length === 0 && (
            <div className="empty-state" style={{ height: '100%' }}>
              <div className="empty-state-icon">💬</div>
              <div className="empty-state-desc">{t('chat.empty')}</div>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} style={{
              padding: 'var(--space-3)',
              marginBottom: 'var(--space-2)',
              borderRadius: 'var(--radius-md)',
              background: msg._type === 'user' ? 'var(--accent-bg, rgba(59,130,246,0.1))' : 'var(--bg-secondary, rgba(255,255,255,0.05))',
              maxWidth: '85%',
              marginLeft: msg._type === 'user' ? 'auto' : 0,
            }}>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, marginBottom: 'var(--space-1)', color: 'var(--text-muted)' }}>
                {msg.role === 'user' ? '👤 You' : msg.role === 'system' ? '⚙️ System' : '🤖 Agent'}
                {msg.timestamp && <span style={{ marginLeft: 'var(--space-2)' }}>{new Date(msg.timestamp).toLocaleTimeString()}</span>}
              </div>
              <div style={{ fontSize: 'var(--text-sm)', whiteSpace: 'pre-wrap', color: 'var(--text-primary)' }}>{msg.content}</div>
              {msg.toolCalls?.map((tc: any, j: number) => (
                <span key={j} className="badge badge-active" style={{ marginRight: 'var(--space-1)', fontSize: 'var(--text-xs)', marginTop: 'var(--space-1)', display: 'inline-block' }}>
                  🔧 {tc.name || tc.function?.name || 'tool'}
                </span>
              ))}
            </div>
          ))}
          {sending && (
            <div style={{ padding: 'var(--space-3)', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
              🤖 <span className="skeleton" style={{ width: 120, height: 14, display: 'inline-block' }} />
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div style={{ borderTop: '1px solid var(--border-color)', padding: 'var(--space-3)', display: 'flex', gap: 'var(--space-2)' }}>
          <input
            className="form-input" style={{ flex: 1 }}
            value={input} onChange={e => setInput(e.target.value)}
            placeholder={t('chat.placeholder')}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
            disabled={sending}
          />
          {sending && (
            <button className="btn btn-danger" onClick={handleAbort} disabled={aborting}>{t('chat.abort')}</button>
          )}
          <button className="btn btn-primary" onClick={handleSend} disabled={sending || !input.trim()}>{t('chat.send')}</button>
        </div>
      </div>
    </div>
  )
}
