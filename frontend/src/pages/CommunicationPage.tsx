import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'

const API = '/api/communication'

interface Message {
  id: string
  session: string
  role: 'user' | 'assistant' | 'system'
  content: string
  time: string
  channel: string
}

interface Webhook {
  id: string
  url: string
  events: string[]
  created: string
}

interface Approval {
  id: string
  description: string
  time: string
  status: 'pending' | 'approved' | 'rejected'
}

interface Command {
  id: string
  name: string
  description: string
}

type Tab = 'messages' | 'broadcast' | 'commands' | 'hooks' | 'approvals'

export function CommunicationPage() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<Tab>('messages')
  const [messages, setMessages] = useState<Message[]>([])
  const [webhooks, setWebhooks] = useState<Webhook[]>([])
  const [approvals, setApprovals] = useState<Approval[]>([])
  const [commands, setCommands] = useState<Command[]>([])
  const [loading, setLoading] = useState(true)

  // Broadcast
  const [bcTarget, setBcTarget] = useState('all')
  const [bcMessage, setBcMessage] = useState('')
  const [bcSending, setBcSending] = useState(false)

  // Commands
  const [execResult, setExecResult] = useState<Record<string, string>>({})
  const [execLoading, setExecLoading] = useState<Record<string, boolean>>({})

  // Hooks form
  const [hookUrl, setHookUrl] = useState('')
  const [hookEvents, setHookEvents] = useState('message')

  // Auto-refresh
  const timerRef = useRef<ReturnType<typeof setInterval>>()

  const fetchMessages = useCallback(async () => {
    try { const r = await fetch(`${API}/messages`); if (r.ok) setMessages(await r.json()) } catch {}
  }, [])

  const fetchWebhooks = useCallback(async () => {
    try { const r = await fetch(`${API}/hooks`); if (r.ok) setWebhooks(await r.json()) } catch {}
  }, [])

  const fetchApprovals = useCallback(async () => {
    try { const r = await fetch(`${API}/approvals`); if (r.ok) setApprovals(await r.json()) } catch {}
  }, [])

  const fetchCommands = useCallback(async () => {
    try { const r = await fetch(`${API}/commands`); if (r.ok) setCommands(await r.json()) } catch {}
  }, [])

  useEffect(() => {
    Promise.all([fetchMessages(), fetchWebhooks(), fetchApprovals(), fetchCommands()]).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (activeTab === 'messages') {
      timerRef.current = setInterval(fetchMessages, 30000)
      return () => { if (timerRef.current) clearInterval(timerRef.current) }
    }
  }, [activeTab, fetchMessages])

  const handleBroadcast = async () => {
    if (!bcMessage.trim()) return
    setBcSending(true)
    try {
      const r = await fetch(`${API}/broadcast`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target: bcTarget, message: bcMessage }) })
      if (r.ok) setBcMessage('')
    } catch {}
    setBcSending(false)
  }

  const handleExecCommand = async (id: string, name: string) => {
    setExecLoading(p => ({ ...p, [id]: true }))
    try {
      const r = await fetch(`${API}/commands/${name}`, { method: 'POST' })
      if (r.ok) { const d = await r.json(); setExecResult(p => ({ ...p, [id]: d.result || d.message || 'OK' })) }
      else { const d = await r.json(); setExecResult(p => ({ ...p, [id]: d.error || 'Failed' })) }
    } catch { setExecResult(p => ({ ...p, [id]: 'Network error' })) }
    setExecLoading(p => ({ ...p, [id]: false }))
  }

  const handleCreateHook = async () => {
    if (!hookUrl.trim()) return
    try {
      const r = await fetch(`${API}/hooks`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: hookUrl, events: hookEvents.split(',').map(e => e.trim()) }) })
      if (r.ok) { setHookUrl(''); setHookEvents('message'); fetchWebhooks() }
    } catch {}
  }

  const handleDeleteHook = async (id: string) => {
    try {
      const r = await fetch(`${API}/hooks/${id}`, { method: 'DELETE' })
      if (r.ok) fetchWebhooks()
    } catch {}
  }

  const handleApproval = async (id: string, action: 'approve' | 'reject') => {
    try {
      const r = await fetch(`${API}/approvals/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) })
      if (r.ok) fetchApprovals()
    } catch {}
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'messages', label: t('comm.tab_messages') },
    { key: 'broadcast', label: t('comm.tab_broadcast') },
    { key: 'commands', label: t('comm.tab_commands') },
    { key: 'hooks', label: t('comm.tab_hooks') },
    { key: 'approvals', label: t('comm.tab_approvals') },
  ]

  if (loading) return <div className="skeleton" style={{ height: 200 }} />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div>
        <p className="eyebrow">{t('comm.eyebrow')}</p>
        <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 600 }}>{t('comm.title')}</h1>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 'var(--space-1)', borderBottom: '1px solid var(--border-default)', paddingBottom: 'var(--space-2)' }}>
        {tabs.map(tab => (
          <button key={tab.key} className={`btn ${activeTab === tab.key ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab(tab.key)} style={{ borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0' }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Messages Tab */}
      {activeTab === 'messages' && (
        <div className="card" style={{ padding: 'var(--space-4)' }}>
          {messages.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>{t('comm.no_messages')}</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {messages.map(m => (
                <div key={m.id} style={{ display: 'flex', gap: 'var(--space-3)', padding: 'var(--space-2)', borderRadius: 'var(--radius-sm)', background: m.role === 'user' ? 'var(--accent-muted)' : 'transparent' }}>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', minWidth: 80, flexShrink: 0 }}>
                    <div>{m.time}</div>
                    <div style={{ marginTop: 2 }}><span className={`badge ${m.role === 'user' ? 'badge-blue' : m.role === 'assistant' ? 'badge-green' : 'badge-gray'}`} style={{ fontSize: '10px' }}>{m.role}</span></div>
                    <div style={{ marginTop: 2 }}>{m.channel}</div>
                  </div>
                  <div style={{ fontSize: 'var(--text-sm)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.content}</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', flexShrink: 0 }}>{m.session}</div>
                </div>
              ))}
            </div>
          )}
          <div style={{ marginTop: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{t('comm.auto_refresh')}</div>
        </div>
      )}

      {/* Broadcast Tab */}
      {activeTab === 'broadcast' && (
        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', maxWidth: 500 }}>
            <div>
              <label style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>{t('comm.target')}</label>
              <select value={bcTarget} onChange={e => setBcTarget(e.target.value)} className="input" style={{ width: '100%' }}>
                <option value="all">{t('comm.target_all')}</option>
                <option value="channel">{t('comm.target_channel')}</option>
                <option value="session">{t('comm.target_session')}</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>{t('comm.message')}</label>
              <textarea value={bcMessage} onChange={e => setBcMessage(e.target.value)} placeholder={t('comm.broadcast_placeholder')} className="input" style={{ width: '100%', minHeight: 80, resize: 'vertical' }} />
            </div>
            <button className="btn btn-primary" onClick={handleBroadcast} disabled={bcSending || !bcMessage.trim()} style={{ alignSelf: 'flex-start' }}>
              {bcSending ? t('app.saving') : t('comm.send')}
            </button>
          </div>
        </div>
      )}

      {/* Commands Tab */}
      {activeTab === 'commands' && (
        <div className="card" style={{ padding: 'var(--space-4)' }}>
          {commands.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>{t('comm.no_commands')}</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {commands.map(cmd => (
                <div key={cmd.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-2) var(--space-3)', background: 'var(--bg-surface-hover)', borderRadius: 'var(--radius-sm)' }}>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 'var(--text-sm)' }}>{cmd.name}</div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{cmd.description}</div>
                    {execResult[cmd.id] && (
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--accent)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>{execResult[cmd.id]}</div>
                    )}
                  </div>
                  <button className="btn btn-secondary" onClick={() => handleExecCommand(cmd.id, cmd.name)} disabled={execLoading[cmd.id]} style={{ fontSize: 'var(--text-xs)' }}>
                    {execLoading[cmd.id] ? '...' : t('comm.execute')}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Hooks Tab */}
      {activeTab === 'hooks' && (
        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>URL</label>
              <input value={hookUrl} onChange={e => setHookUrl(e.target.value)} placeholder="https://..." className="input" style={{ width: '100%' }} />
            </div>
            <div style={{ width: 200 }}>
              <label style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>{t('comm.events')}</label>
              <input value={hookEvents} onChange={e => setHookEvents(e.target.value)} placeholder="message,session" className="input" style={{ width: '100%' }} />
            </div>
            <button className="btn btn-primary" onClick={handleCreateHook}>{t('app.create')}</button>
          </div>
          {webhooks.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>{t('comm.no_hooks')}</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {webhooks.map(wh => (
                <div key={wh.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-2) var(--space-3)', background: 'var(--bg-surface-hover)', borderRadius: 'var(--radius-sm)' }}>
                  <div>
                    <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>{wh.url}</div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{wh.events.join(', ')} · {wh.created}</div>
                  </div>
                  <button className="btn btn-danger" onClick={() => handleDeleteHook(wh.id)} style={{ fontSize: 'var(--text-xs)' }}>{t('app.delete')}</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Approvals Tab */}
      {activeTab === 'approvals' && (
        <div className="card" style={{ padding: 'var(--space-4)' }}>
          {approvals.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>{t('comm.no_approvals')}</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {approvals.map(ap => (
                <div key={ap.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-2) var(--space-3)', background: 'var(--bg-surface-hover)', borderRadius: 'var(--radius-sm)' }}>
                  <div>
                    <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>{ap.description}</div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{ap.time}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    {ap.status === 'pending' ? (
                      <>
                        <button className="btn btn-primary" onClick={() => handleApproval(ap.id, 'approve')} style={{ fontSize: 'var(--text-xs)' }}>{t('comm.approve')}</button>
                        <button className="btn btn-danger" onClick={() => handleApproval(ap.id, 'reject')} style={{ fontSize: 'var(--text-xs)' }}>{t('comm.reject')}</button>
                      </>
                    ) : (
                      <span className={`badge ${ap.status === 'approved' ? 'badge-green' : 'badge-red'}`} style={{ fontSize: 'var(--text-xs)' }}>
                        {ap.status === 'approved' ? '✓' : '✗'} {t(`comm.status_${ap.status}`)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
