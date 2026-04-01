import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useConnectionState } from '../hooks/useGateway'
import { gatewayClient } from '../lib/gateway-client'
import { Button, Input, Tag, Card, Empty, Switch, Checkbox } from 'antd'


interface ChatMsg {
  role: string
  content: string
  toolCalls?: any[]
  timestamp?: string
  _type?: 'user' | 'assistant' | 'tool'
  session_key?: string
}

type Tab = 'chat' | 'all' | 'search' | 'broadcast' | 'bookmarks'

export function ChatPage() {
  const { t } = useTranslation()
  const connState = useConnectionState()
  const [tab, setTab] = useState<Tab>('chat')
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [aborting, setAborting] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)

  // All messages state
  const [allMessages, setAllMessages] = useState<any[]>([])

  // Broadcast state
  const [broadcastMsg, setBroadcastMsg] = useState('')
  const [broadcastKeys, setBroadcastKeys] = useState('')
  const [broadcastSessions, setBroadcastSessions] = useState<any[]>([])
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set())
  const [broadcastSent, setBroadcastSent] = useState(false)

  // Bookmarks state
  const [bookmarks, setBookmarks] = useState<any[]>([])

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

  // Tab change: load data
  const switchTab = async (newTab: Tab) => {
    setTab(newTab)
    if (newTab === 'all') {
      try {
        const res = await fetch('/api/chat/all-messages?limit=200')
        setAllMessages(await res.json())
      } catch { /* */ }
    } else if (newTab === 'bookmarks') {
      try {
        const res = await fetch('/api/chat/bookmarks')
        setBookmarks(await res.json())
      } catch { /* */ }
    } else if (newTab === 'broadcast' && broadcastSessions.length === 0) {
      try {
        if (connState === 'connected') {
          const res = await gatewayClient.call('sessions.list')
          const list = res?.items || res || []
          setBroadcastSessions(list)
        }
      } catch { /* */ }
    }
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    setSearching(true)
    try {
      const res = await fetch(`/api/chat/search?q=${encodeURIComponent(searchQuery)}&limit=50`)
      setSearchResults(await res.json())
    } catch { setSearchResults([]) }
    setSearching(false)
  }

  // Safely extract session key from various field names
  const getSessionKey = (s: any): string | undefined =>
    s?.key ?? s?.sessionKey ?? s?.id ?? undefined

  const handleBroadcast = async () => {
    if (!broadcastMsg.trim() || selectedSessions.size === 0) return
    try {
      await fetch('/api/chat/broadcast', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_keys: Array.from(selectedSessions), message: broadcastMsg.trim() }),
      })
      // Also try real Gateway sends
      if (connState === 'connected') {
        for (const key of selectedSessions) {
          try { await gatewayClient.call('chat.send', { sessionKey: key, message: broadcastMsg.trim() }) } catch { /* */ }
        }
      }
      setBroadcastSent(true)
      setTimeout(() => setBroadcastSent(false), 3000)
      setBroadcastMsg('')
    } catch { /* */ }
  }

  const toggleSessionSelect = (key: string | undefined) => {
    if (!key) return
    const next = new Set(selectedSessions)
    next.has(key) ? next.delete(key) : next.add(key)
    setSelectedSessions(next)
  }

  const selectAllSessions = () => {
    const allKeys = broadcastSessions.map(getSessionKey).filter(Boolean) as string[]
    const all = new Set(allKeys)
    setSelectedSessions(all.size === selectedSessions.size && allKeys.every(k => selectedSessions.has(k)) ? new Set() : all)
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

  const tabs: { key: Tab; label: string }[] = [
    { key: 'chat', label: t('chat.title') },
    { key: 'all', label: t('chat.allMessages') },
    { key: 'search', label: t('chat.search').replace('...', '') },
    { key: 'broadcast', label: t('chat.broadcast') },
    { key: 'bookmarks', label: t('chat.bookmarks') },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - var(--topbar-height, 56px) - 80px)' }}>
      <div className="page-header" style={{ flexShrink: 0 }}>
        <h1>{t('chat.title')}</h1>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 12, borderBottom: '1px solid var(--border-color)', flexShrink: 0 }}>
        {tabs.map(tb => (
          <Button key={tb.key} onClick={() => switchTab(tb.key)} style={{
            padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer',
            borderBottom: tab === tb.key ? '2px solid var(--status-blue)' : '2px solid transparent',
            color: tab === tb.key ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: tab === tb.key ? 600 : 400,
            fontSize: 13, transition: 'all 0.15s',
          }}>
            {tb.label}
          </Button>
        ))}
      </div>

      {/* Chat Tab */}
      {tab === 'chat' && (
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
                padding: 'var(--space-3)', marginBottom: 'var(--space-2)',
                borderRadius: 'var(--radius-md)',
                background: msg._type === 'user' ? 'var(--accent-bg, rgba(59,130,246,0.1))' : 'var(--bg-secondary, rgba(255,255,255,0.05))',
                maxWidth: '85%', marginLeft: msg._type === 'user' ? 'auto' : 0,
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
            <Input style={{ flex: 1 }} value={input} onChange={e => setInput(e.target.value)}
              placeholder={t('chat.placeholder')} onPressEnter={e => !e.shiftKey && handleSend()} disabled={sending} />
            {sending && <Button danger onClick={handleAbort} disabled={aborting}>{t('chat.abort')}</Button>}
            <Button type="primary" onClick={handleSend} disabled={sending || !input.trim()}>{t('chat.send')}</Button>
          </div>
        </div>
      )}

      {/* All Messages Tab */}
      {tab === 'all' && (
        <div className="card" style={{ flex: 1, overflow: 'auto' }}>
          <div className="card-body">
            {allMessages.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 32 }}>{t('app.no_data')}</div>
            ) : allMessages.map((m: any, i: number) => (
              <div key={i} style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: m.role === 'user' ? 'var(--status-blue)' : 'var(--status-green)' }}>
                    {m.role || 'assistant'}
                    {m.session_key && <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>{m.session_key}</span>}
                  </span>
                  {m.timestamp && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{new Date(m.timestamp).toLocaleTimeString()}</span>}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
                  {(m.content || '').substring(0, 200)}{(m.content || '').length > 200 ? '...' : ''}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search Tab */}
      {tab === 'search' && (
        <div className="card" style={{ flex: 1, overflow: 'auto' }}>
          <div className="card-body">
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <Input style={{ flex: 1 }} value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder={t('chat.searchPlaceholder')} onPressEnter={handleSearch} />
              <Button type="primary" onClick={handleSearch} disabled={searching}>{t('app.search')}</Button>
            </div>
            {searchResults.length === 0 && searchQuery && !searching && (
              <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 32 }}>{t('chat.noResults')}</div>
            )}
            {searchResults.map((r: any, i: number) => (
              <div key={i} style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--status-blue)' }}>
                    {r.session_key || r.role || 'unknown'}
                  </span>
                  {r.timestamp && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{new Date(r.timestamp).toLocaleTimeString()}</span>}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
                  {(r.content || '').substring(0, 300)}{(r.content || '').length > 300 ? '...' : ''}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Broadcast Tab */}
      {tab === 'broadcast' && (
        <div className="card" style={{ flex: 1, overflow: 'auto' }}>
          <div className="card-body">
            {broadcastSent && (
              <div style={{ padding: '8px 12px', marginBottom: 12, borderRadius: 'var(--radius-md)', background: 'var(--status-green)', color: '#fff', fontSize: 13 }}>
                ✓ Broadcast sent to {selectedSessions.size} sessions
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <h3 style={{ color: 'var(--text-primary)', fontSize: 14, margin: 0 }}>{t('chat.selectSessions')}</h3>
              {broadcastSessions.length > 0 && (
                <Checkbox
                  checked={broadcastSessions.length > 0 && broadcastSessions.every((s: any) => { const k = getSessionKey(s); return !!k && selectedSessions.has(k) })}
                  indeterminate={broadcastSessions.some((s: any) => { const k = getSessionKey(s); return !!k && selectedSessions.has(k) }) && !broadcastSessions.every((s: any) => { const k = getSessionKey(s); return !!k && selectedSessions.has(k) })}
                  onChange={selectAllSessions}
                >
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('app.select_all', 'Select All')}</span>
                </Checkbox>
              )}
            </div>
            <div style={{ maxHeight: 200, overflow: 'auto', marginBottom: 12, border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: 4 }}>
              {broadcastSessions.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', padding: 12, fontSize: 13 }}>{t('app.no_data')}</div>
              ) : broadcastSessions.map((s: any, idx: number) => {
                const sKey = getSessionKey(s)
                return (
                  <div key={sKey || idx} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px',
                    borderRadius: 'var(--radius-sm)',
                    background: sKey && selectedSessions.has(sKey) ? 'var(--accent-bg, rgba(59,130,246,0.1))' : undefined,
                  }}>
                    <Checkbox
                      checked={!!sKey && selectedSessions.has(sKey)}
                      disabled={!sKey}
                      onChange={() => toggleSessionSelect(sKey)}
                    />
                    <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                      {s?.displayName || s?.label || sKey || `${t('app.no_data')} #${idx + 1}`}
                    </span>
                  </div>
                )
              })}
            </div>
            {selectedSessions.size > 0 && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>{selectedSessions.size} selected</div>
            )}
            <Input.TextArea
              style={{ width: '100%', minHeight: 80, marginBottom: 8 }}
              value={broadcastMsg}
              onChange={e => setBroadcastMsg(e.target.value)}
              placeholder={t('chat.broadcastMessage')}
              autoSize={{ minRows: 3, maxRows: 6 }}
            />
            <Button type="primary" onClick={handleBroadcast} disabled={!broadcastMsg.trim() || selectedSessions.size === 0}>
              {t('chat.sendBroadcast')}
            </Button>
          </div>
        </div>
      )}

      {/* Bookmarks Tab */}
      {tab === 'bookmarks' && (
        <div className="card" style={{ flex: 1, overflow: 'auto' }}>
          <div className="card-body">
            {bookmarks.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 32 }}>{t('app.no_data')}</div>
            ) : bookmarks.map((b: any) => (
              <div key={b.id} style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--status-blue)' }}>{b.session_key}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{new Date(b.bookmarked_at).toLocaleString()}</span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>{b.content}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
