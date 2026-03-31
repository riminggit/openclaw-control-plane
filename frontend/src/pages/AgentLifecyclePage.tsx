import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'var(--status-green)',
  IDLE: 'var(--status-blue)',
  STALE: 'var(--status-yellow)',
  ZOMBIE: 'var(--status-red)',
  COMPLETED: '#6b7280',
  FAILED: 'var(--status-red)',
}

interface LifecycleAgent {
  session_key: string
  agent_id: string | null
  agent_label: string | null
  status: string
  channel: string | null
  model: string | null
  total_tokens: number
  last_active_at: string
  created_at: string
}

interface CleanupLogEntry {
  id: string
  session_key: string
  agent_label: string | null
  lifecycle_state: string
  action: string
  detail: string | null
  cleaned_at: string
}

interface AutoCleanupConfig {
  enabled: boolean
  rules: Record<string, { max_age_minutes: number; action: string }>
  interval_minutes: number
}

export function AgentLifecyclePage() {
  const { t } = useTranslation()
  const [agents, setAgents] = useState<LifecycleAgent[]>([])
  const [logs, setLogs] = useState<CleanupLogEntry[]>([])
  const [autoConfig, setAutoConfig] = useState<AutoCleanupConfig | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const [agentsRes, logsRes, configRes] = await Promise.all([
        fetch('/api/agents/lifecycle').then(r => r.json()),
        fetch('/api/agents/lifecycle/cleanup-logs?limit=50').then(r => r.json()).catch(() => []),
        fetch('/api/agents/lifecycle/config').then(r => r.json()).catch(() => null),
      ])
      setAgents(Array.isArray(agentsRes) ? agentsRes : [])
      setLogs(Array.isArray(logsRes) ? logsRes : [])
      if (configRes) setAutoConfig(configRes)
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => {
    const timer = setInterval(fetchData, 30000)
    return () => clearInterval(timer)
  }, [fetchData])

  const toggleSelect = (key: string) => {
    const next = new Set(selected)
    next.has(key) ? next.delete(key) : next.add(key)
    setSelected(next)
  }

  const selectAll = () => {
    if (selected.size === agents.length) setSelected(new Set())
    else setSelected(new Set(agents.map(a => a.session_key)))
  }

  const cleanupSelected = async () => {
    if (selected.size === 0) return
    if (!confirm(t('lifecycle.cleanupConfirm', { count: selected.size }))) return
    try {
      await fetch('/api/agents/lifecycle/cleanup', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_keys: Array.from(selected) }),
      })
      setToast({ msg: t('lifecycle.cleanupSuccess'), ok: true })
      setSelected(new Set())
      setTimeout(fetchData, 500)
    } catch {
      setToast({ msg: t('lifecycle.cleanupFailed'), ok: false })
    }
  }

  const autoCleanup = async () => {
    try {
      await fetch('/api/agents/lifecycle/cleanup/auto', { method: 'POST' })
      setToast({ msg: t('lifecycle.cleanupSuccess'), ok: true })
      setTimeout(fetchData, 500)
    } catch {
      setToast({ msg: t('lifecycle.cleanupFailed'), ok: false })
    }
  }

  const toggleAutoCleanup = async () => {
    if (!autoConfig) return
    const updated = { ...autoConfig, enabled: !autoConfig.enabled }
    try {
      await fetch('/api/agents/lifecycle/config', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      })
      setAutoConfig(updated)
    } catch { /* ignore */ }
  }

  const statusCounts = agents.reduce((acc, a) => {
    acc[a.status] = (acc[a.status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  if (loading) {
    return (
      <div>
        <div className="page-header">
          <p className="page-header-eyebrow">{t('lifecycle.eyebrow')}</p>
          <h1>{t('lifecycle.title')}</h1>
        </div>
        <div className="skeleton" style={{ height: 100, borderRadius: 'var(--radius-lg)', marginBottom: 16 }} />
        <div className="skeleton" style={{ height: 300, borderRadius: 'var(--radius-lg)' }} />
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <p className="page-header-eyebrow">{t('lifecycle.eyebrow')}</p>
        <h1>{t('lifecycle.title')}</h1>
        <p className="page-header-desc">{t('lifecycle.subtitle')}</p>
      </div>

      {/* Status Summary */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        {['ACTIVE', 'IDLE', 'STALE', 'ZOMBIE', 'COMPLETED', 'FAILED'].map(s => (
          <div key={s} style={{
            padding: '10px 16px', borderRadius: 'var(--radius-md)',
            background: 'var(--bg-surface)', border: '1px solid var(--border-color)',
            display: 'flex', alignItems: 'center', gap: 8, minWidth: 100,
          }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: STATUS_COLORS[s] }} />
            <span style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 600 }}>
              {t(`lifecycle.status.${s.toLowerCase()}`)}
            </span>
            <span className="badge" style={{ background: 'var(--bg-surface-hover)', color: 'var(--text-muted)', fontSize: 11 }}>
              {statusCounts[s] || 0}
            </span>
          </div>
        ))}
      </div>

      {/* Actions Bar */}
      {selected.size > 0 && (
        <div style={{
          padding: '10px 16px', marginBottom: 16, borderRadius: 'var(--radius-md)',
          background: 'var(--bg-surface)', border: '1px solid var(--status-blue)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{ color: 'var(--text-primary)', fontSize: 13 }}>
            {selected.size} selected
          </span>
          <button className="btn btn-primary" onClick={cleanupSelected} style={{ fontSize: 13 }}>
            {t('lifecycle.cleanupSelected')}
          </button>
          <button className="btn btn-secondary" onClick={() => setSelected(new Set())} style={{ fontSize: 13 }}>
            {t('app.cancel')}
          </button>
        </div>
      )}

      {/* Auto Cleanup */}
      <div style={{
        padding: 16, marginBottom: 16, borderRadius: 'var(--radius-md)',
        background: 'var(--bg-surface)', border: '1px solid var(--border-color)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
      }}>
        <div>
          <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 14, marginBottom: 2 }}>
            {t('lifecycle.autoCleanup')}
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{t('lifecycle.autoCleanupDesc')}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn btn-secondary" onClick={autoCleanup} style={{ fontSize: 12 }}>
            Run Now
          </button>
          <button
            onClick={toggleAutoCleanup}
            style={{
              padding: '6px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)',
              background: autoConfig?.enabled ? 'var(--status-green)' : 'var(--bg-surface-hover)',
              color: '#fff', fontSize: 12, fontWeight: 500, cursor: 'pointer',
            }}
          >
            {autoConfig?.enabled ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {/* Agent Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
              <th style={{ padding: '10px 12px', textAlign: 'left' }}>
                <input type="checkbox" checked={selected.size === agents.length && agents.length > 0} onChange={selectAll} />
              </th>
              <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>{t('lifecycle.label')}</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>{t('lifecycle.status')}</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>{t('lifecycle.channel')}</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>{t('lifecycle.model')}</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 600 }}>{t('lifecycle.tokens')}</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>{t('lifecycle.lastActive')}</th>
            </tr>
          </thead>
          <tbody>
            {agents.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
                {t('lifecycle.noAgents')}
              </td></tr>
            ) : agents.map(a => (
              <tr key={a.session_key} style={{
                borderBottom: '1px solid var(--border-color)',
                background: selected.has(a.session_key) ? 'var(--bg-surface-hover)' : undefined,
              }}>
                <td style={{ padding: '10px 12px' }}>
                  <input type="checkbox" checked={selected.has(a.session_key)} onChange={() => toggleSelect(a.session_key)} />
                </td>
                <td style={{ padding: '10px 12px', color: 'var(--text-primary)' }}>
                  <a href={`/sessions/${a.session_key}`} style={{ color: 'var(--text-primary)', textDecoration: 'none' }}>
                    {a.agent_label || a.agent_id || a.session_key}
                  </a>
                </td>
                <td style={{ padding: '10px 12px' }}>
                  <span style={{
                    padding: '2px 8px', borderRadius: 'var(--radius-sm)', fontSize: 11, fontWeight: 600,
                    background: STATUS_COLORS[a.status] + '22', color: STATUS_COLORS[a.status],
                  }}>
                    {a.status}
                  </span>
                </td>
                <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{a.channel || '-'}</td>
                <td style={{ padding: '10px 12px', color: 'var(--text-muted)', fontSize: 12 }}>{a.model || '-'}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-muted)' }}>
                  {a.total_tokens > 0 ? a.total_tokens.toLocaleString() : '-'}
                </td>
                <td style={{ padding: '10px 12px', color: 'var(--text-muted)', fontSize: 12 }}>
                  {a.last_active_at ? new Date(a.last_active_at).toLocaleString() : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Cleanup History */}
      {logs.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <h3 style={{ color: 'var(--text-primary)', fontSize: 16, marginBottom: 12 }}>{t('lifecycle.cleanupHistory')}</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)' }}>{t('lifecycle.agent')}</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)' }}>{t('lifecycle.status')}</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)' }}>{t('lifecycle.action')}</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)' }}>{t('lifecycle.detail')}</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)' }}>{t('lifecycle.cleanedAt')}</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(l => (
                  <tr key={l.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '8px 12px', color: 'var(--text-primary)' }}>{l.agent_label || l.session_key}</td>
                    <td style={{ padding: '8px 12px' }}>
                      <span style={{ padding: '2px 6px', borderRadius: 'var(--radius-sm)', fontSize: 10, fontWeight: 600,
                        background: STATUS_COLORS[l.lifecycle_state] + '22', color: STATUS_COLORS[l.lifecycle_state] }}>
                        {l.lifecycle_state}
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>{l.action}</td>
                    <td style={{ padding: '8px 12px', color: 'var(--text-muted)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {l.detail || '-'}
                    </td>
                    <td style={{ padding: '8px 12px', color: 'var(--text-muted)', fontSize: 11 }}>
                      {new Date(l.cleaned_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9999, padding: '12px 20px',
          borderRadius: 'var(--radius-md)', fontSize: 14, fontWeight: 500,
          background: toast.ok ? 'var(--status-green)' : 'var(--status-red)',
          color: '#fff', boxShadow: 'var(--shadow-lg)',
        }} onClick={() => setToast(null)}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}
