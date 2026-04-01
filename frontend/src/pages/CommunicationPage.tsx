import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Input, Select, Card, Tabs, Tooltip, Empty, Tag } from 'antd'
import { QuestionCircleOutlined, SendOutlined, CodeOutlined, LinkOutlined, SafetyCertificateOutlined } from '@ant-design/icons'


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

  /** Defensively unwrap API responses that may be { items: [...] } or { messages: [...] } or plain array */
  const unwrap = (raw: any, ...keys: string[]): any[] => {
    if (Array.isArray(raw)) return raw
    for (const k of keys) {
      if (raw?.[k] && Array.isArray(raw[k])) return raw[k]
    }
    return []
  }

  const fetchMessages = useCallback(async () => {
    try { const r = await fetch(`${API}/messages`); if (r.ok) setMessages(unwrap(await r.json(), 'messages', 'items')) } catch {}
  }, [])

  const fetchWebhooks = useCallback(async () => {
    try { const r = await fetch(`${API}/hooks`); if (r.ok) setWebhooks(unwrap(await r.json(), 'hooks', 'items', 'webhooks')) } catch {}
  }, [])

  const fetchApprovals = useCallback(async () => {
    try { const r = await fetch(`${API}/approvals`); if (r.ok) setApprovals(unwrap(await r.json(), 'approvals', 'items')) } catch {}
  }, [])

  const fetchCommands = useCallback(async () => {
    try { const r = await fetch(`${API}/commands`); if (r.ok) setCommands(unwrap(await r.json(), 'commands', 'items')) } catch {}
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

  const InfoIcon = ({ text }: { text: string }) => (
    <Tooltip title={text}>
      <QuestionCircleOutlined style={{ color: 'var(--text-muted)', fontSize: 14, marginLeft: 4, cursor: 'help' }} />
    </Tooltip>
  )

  const tabs: { key: Tab; label: React.ReactNode }[] = [
    { key: 'messages', label: <>{t('comm.tab_messages')} <InfoIcon text={t('comm.tip_messages')} /></> },
    { key: 'broadcast', label: <>{t('comm.tab_broadcast')} <InfoIcon text={t('comm.tip_broadcast')} /></> },
    { key: 'commands', label: <>{t('comm.tab_commands')} <InfoIcon text={t('comm.tip_commands')} /></> },
    { key: 'hooks', label: <>{t('comm.tab_hooks')} <InfoIcon text={t('comm.tip_hooks')} /></> },
    { key: 'approvals', label: <>{t('comm.tab_approvals')} <InfoIcon text={t('comm.tip_approvals')} /></> },
  ]

  if (loading) return <div className="skeleton" style={{ height: 200 }} />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <div className="page-eyebrow">{t('comm.eyebrow')}</div>
          <h1 className="page-title">{t('comm.title')}</h1>
          <p className="page-subtitle">{t('comm.subtitle', '管理消息通讯和Webhook')}</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
        {tabs.map(tab => (
          <Button key={tab.key} type={activeTab === tab.key ? 'primary' : 'default'} onClick={() => setActiveTab(tab.key)}>
            {tab.label}
          </Button>
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
              <Select value={bcTarget} onChange={e => setBcTarget(e)} className="input" style={{ width: '100%' }}>
                <Select.Option value="all">{t('comm.target_all')}</Select.Option>
                <Select.Option value="channel">{t('comm.target_channel')}</Select.Option>
                <Select.Option value="session">{t('comm.target_session')}</Select.Option>
              </Select>
            </div>
            <div>
              <label style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>{t('comm.message')}</label>
              <Input.TextArea value={bcMessage} onChange={e => setBcMessage(e.target.value)} placeholder={t('comm.broadcast_placeholder')} className="input" style={{ width: '100%', minHeight: 80, resize: 'vertical' }} />
            </div>
            <Button type="primary" onClick={handleBroadcast} disabled={bcSending || !bcMessage.trim()} style={{ alignSelf: 'flex-start' }}>
              {bcSending ? t('app.saving') : t('comm.send')}
            </Button>
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
                  <Button onClick={() => handleExecCommand(cmd.id, cmd.name)} disabled={execLoading[cmd.id]} style={{ fontSize: 'var(--text-xs)' }}>
                    {execLoading[cmd.id] ? '...' : t('comm.execute')}
                  </Button>
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
              <Input value={hookUrl} onChange={e => setHookUrl(e.target.value)} placeholder="https://..." />
            </div>
            <div style={{ width: 200 }}>
              <label style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>{t('comm.events')}</label>
              <Input value={hookEvents} onChange={e => setHookEvents(e.target.value)} placeholder="message,session" />
            </div>
            <Button type="primary" onClick={handleCreateHook}>{t('app.create')}</Button>
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
                  <Button danger onClick={() => handleDeleteHook(wh.id)} style={{ fontSize: 'var(--text-xs)' }}>{t('app.delete')}</Button>
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
                        <Button type="primary" onClick={() => handleApproval(ap.id, 'approve')} style={{ fontSize: 'var(--text-xs)' }}>{t('comm.approve')}</Button>
                        <Button danger onClick={() => handleApproval(ap.id, 'reject')} style={{ fontSize: 'var(--text-xs)' }}>{t('comm.reject')}</Button>
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
