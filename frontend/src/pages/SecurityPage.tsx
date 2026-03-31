import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useConnectionState } from '../hooks/useGateway'

const API = '/api/security'

interface SecurityOverview {
  hasPassword: boolean
  isDefaultPassword: boolean
  passwordStrength: number // 0-4
  riskCount: number
}

interface AuditLog {
  id: string
  time: string
  action: string
  ip: string
  result: 'success' | 'failure'
}

function PasswordStrengthBar({ strength }: { strength: number }) {
  const { t } = useTranslation()
  const levels = [t('security.strength_none'), t('security.strength_weak'), t('security.strength_medium'), t('security.strength_strong'), t('security.strength_very_strong')]
  const colors = ['#ef4444', '#ef4444', '#eab308', '#22c55e', '#22c55e']
  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= strength ? colors[strength] : 'var(--border-default)', transition: 'var(--transition-fast)' }} />
        ))}
      </div>
      <span style={{ fontSize: 'var(--text-xs)', color: colors[strength] || 'var(--text-muted)' }}>{levels[strength] || levels[0]}</span>
    </div>
  )
}

function calcStrength(pwd: string): number {
  if (!pwd) return 0
  let s = 0
  if (pwd.length >= 6) s++
  if (pwd.length >= 10) s++
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) s++
  if (/\d/.test(pwd)) s++
  if (/[^A-Za-z0-9]/.test(pwd)) s++
  return Math.min(4, s)
}

export function SecurityPage() {
  const { t } = useTranslation()
  const connState = useConnectionState()
  const [overview, setOverview] = useState<SecurityOverview>({ hasPassword: false, isDefaultPassword: true, passwordStrength: 0, riskCount: 0 })
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [whitelist, setWhitelist] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [newIp, setNewIp] = useState('')
  const [currentPwd, setCurrentPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [logRange, setLogRange] = useState<'1h' | '24h' | '7d'>('24h')

  const fetchOverview = useCallback(async () => {
    try { const r = await fetch(`${API}/overview`); if (r.ok) setOverview(await r.json()) } catch {}
  }, [])

  const fetchLogs = useCallback(async () => {
    try { const r = await fetch(`${API}/audit-logs?range=${logRange}`); if (r.ok) setLogs(await r.json()) } catch {}
  }, [logRange])

  const fetchWhitelist = useCallback(async () => {
    try { const r = await fetch(`${API}/whitelist`); if (r.ok) setWhitelist(await r.json()) } catch {}
  }, [])

  useEffect(() => { Promise.all([fetchOverview(), fetchLogs(), fetchWhitelist()]).finally(() => setLoading(false)) }, [fetchOverview, fetchLogs, fetchWhitelist])

  const handleChangePassword = async () => {
    if (newPwd !== confirmPwd) { setMsg({ type: 'err', text: t('security.err_mismatch') }); return }
    if (newPwd.length < 6) { setMsg({ type: 'err', text: t('security.err_too_short') }); return }
    setSaving(true); setMsg(null)
    try {
      const r = await fetch(`${API}/password`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ current: currentPwd, new: newPwd }) })
      if (r.ok) { setMsg({ type: 'ok', text: t('security.pwd_changed') }); setCurrentPwd(''); setNewPwd(''); setConfirmPwd(''); fetchOverview() }
      else { const d = await r.json(); setMsg({ type: 'err', text: d.error || 'Failed' }) }
    } catch { setMsg({ type: 'err', text: 'Network error' }) }
    setSaving(false)
  }

  const handleAddIp = async () => {
    if (!newIp.trim()) return
    try {
      const r = await fetch(`${API}/whitelist`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ip: newIp.trim() }) })
      if (r.ok) { setNewIp(''); fetchWhitelist() }
    } catch {}
  }

  const handleRemoveIp = async (ip: string) => {
    try {
      const r = await fetch(`${API}/whitelist`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ip }) })
      if (r.ok) fetchWhitelist()
    } catch {}
  }

  if (loading) return <div className="skeleton" style={{ height: 200 }} />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div>
        <p className="eyebrow">{t('security.eyebrow')}</p>
        <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 600 }}>{t('security.title')}</h1>
      </div>

      {/* Overview Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>{t('security.password_status')}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: overview.hasPassword && !overview.isDefaultPassword ? 'var(--status-green)' : 'var(--status-yellow)' }} />
            <span style={{ fontWeight: 600 }}>{overview.hasPassword && !overview.isDefaultPassword ? t('security.pwd_set') : overview.isDefaultPassword ? t('security.pwd_default') : t('security.pwd_not_set')}</span>
          </div>
          {overview.hasPassword && <PasswordStrengthBar strength={overview.passwordStrength} />}
        </div>
        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>{t('security.risk_items')}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <span style={{ fontWeight: 600, fontSize: 'var(--text-xl)' }}>{overview.riskCount}</span>
            {overview.riskCount > 0 && <span className="badge badge-yellow" style={{ fontSize: 'var(--text-xs)' }}>{t('security.has_risks')}</span>}
          </div>
        </div>
      </div>

      {/* Change Password */}
      <div className="card" style={{ padding: 'var(--space-4)' }}>
        <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, marginBottom: 'var(--space-4)' }}>{t('security.change_password')}</h3>
        {msg && <div className={`toast ${msg.type === 'ok' ? 'toast-success' : 'toast-error'}`} style={{ marginBottom: 'var(--space-3)', padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-sm)' }}>{msg.text}</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', maxWidth: 400 }}>
          <div>
            <label style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>{t('security.current_password')}</label>
            <input type="password" value={currentPwd} onChange={e => setCurrentPwd(e.target.value)} className="input" style={{ width: '100%' }} />
          </div>
          <div>
            <label style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>{t('security.new_password')}</label>
            <input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} className="input" style={{ width: '100%' }} />
            <PasswordStrengthBar strength={calcStrength(newPwd)} />
          </div>
          <div>
            <label style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>{t('security.confirm_password')}</label>
            <input type="password" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} className="input" style={{ width: '100%' }} />
          </div>
          <button className="btn btn-primary" onClick={handleChangePassword} disabled={saving || !currentPwd || !newPwd} style={{ alignSelf: 'flex-start' }}>
            {saving ? t('app.saving') : t('app.save')}
          </button>
        </div>
      </div>

      {/* IP Whitelist */}
      <div className="card" style={{ padding: 'var(--space-4)' }}>
        <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, marginBottom: 'var(--space-4)' }}>{t('security.ip_whitelist')}</h3>
        <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)', maxWidth: 400 }}>
          <input value={newIp} onChange={e => setNewIp(e.target.value)} placeholder={t('security.ip_placeholder')} className="input" style={{ flex: 1 }} onKeyDown={e => e.key === 'Enter' && handleAddIp()} />
          <button className="btn btn-secondary" onClick={handleAddIp}>{t('app.create')}</button>
        </div>
        {whitelist.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>{t('security.no_whitelist')}</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {whitelist.map(ip => (
              <div key={ip} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-2) var(--space-3)', background: 'var(--bg-surface-hover)', borderRadius: 'var(--radius-sm)' }}>
                <code style={{ fontSize: 'var(--text-sm)' }}>{ip}</code>
                <button className="btn btn-danger" onClick={() => handleRemoveIp(ip)} style={{ fontSize: 'var(--text-xs)' }}>{t('app.delete')}</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Audit Logs */}
      <div className="card" style={{ padding: 'var(--space-4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
          <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 600 }}>{t('security.audit_logs')}</h3>
          <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
            {(['1h', '24h', '7d'] as const).map(r => (
              <button key={r} className={`btn ${logRange === r ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setLogRange(r)} style={{ fontSize: 'var(--text-xs)' }}>{t(`security.range_${r}`)}</button>
            ))}
          </div>
        </div>
        {logs.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>{t('security.no_logs')}</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', fontSize: 'var(--text-sm)' }}>
              <thead>
                <tr>
                  <th>{t('security.col_time')}</th>
                  <th>{t('security.col_action')}</th>
                  <th>{t('security.col_ip')}</th>
                  <th>{t('security.col_result')}</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(l => (
                  <tr key={l.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{l.time}</td>
                    <td>{l.action}</td>
                    <td><code style={{ fontSize: 'var(--text-xs)' }}>{l.ip}</code></td>
                    <td><span className={`badge ${l.result === 'success' ? 'badge-green' : 'badge-red'}`}>{l.result === 'success' ? '✓' : '✗'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
