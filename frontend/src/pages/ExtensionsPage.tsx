import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'

const API = '/api/extensions'

interface Extension {
  id: string
  name: string
  description: string
  version: string
  enabled: boolean
  type: 'plugin' | 'tunnel'
}

interface TunnelInfo {
  status: 'connected' | 'disconnected' | 'connecting'
  url: string
  bytesIn: number
  bytesOut: number
}

export function ExtensionsPage() {
  const { t } = useTranslation()
  const [extensions, setExtensions] = useState<Extension[]>([])
  const [tunnel, setTunnel] = useState<TunnelInfo | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchExtensions = useCallback(async () => {
    try { const r = await fetch(API); if (r.ok) setExtensions(await r.json()) } catch {}
  }, [])

  const fetchTunnel = useCallback(async () => {
    try { const r = await fetch(`${API}/tunnel`); if (r.ok) setTunnel(await r.json()) } catch {}
  }, [])

  useEffect(() => { Promise.all([fetchExtensions(), fetchTunnel()]).finally(() => setLoading(false)) }, [])

  const toggleExtension = async (id: string, enabled: boolean) => {
    try {
      const r = await fetch(`${API}/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled }) })
      if (r.ok) fetchExtensions()
    } catch {}
  }

  const formatBytes = (b: number) => {
    if (b < 1024) return `${b} B`
    if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`
    return `${(b / 1048576).toFixed(1)} MB`
  }

  if (loading) return <div className="skeleton" style={{ height: 200 }} />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div>
        <p className="eyebrow">{t('extensions.eyebrow')}</p>
        <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 600 }}>{t('extensions.title')}</h1>
      </div>

      {/* Tunnel Card */}
      {tunnel && (
        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 600 }}>CFTunnel</h3>
              <span className={`badge ${tunnel.status === 'connected' ? 'badge-green' : tunnel.status === 'connecting' ? 'badge-yellow' : 'badge-red'}`}>
                {t(`extensions.tunnel_${tunnel.status}`)}
              </span>
            </div>
            {tunnel.url && (
              <a href={tunnel.url} target="_blank" rel="noopener" className="btn btn-secondary" style={{ fontSize: 'var(--text-xs)' }}>
                {tunnel.url} ↗
              </a>
            )}
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-6)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
            <div>↓ {formatBytes(tunnel.bytesIn)}</div>
            <div>↑ {formatBytes(tunnel.bytesOut)}</div>
          </div>
        </div>
      )}

      {/* Extensions Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
        {extensions.map(ext => (
          <div key={ext.id} className="card" style={{ padding: 'var(--space-4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-2)' }}>
              <div>
                <h4 style={{ fontWeight: 600, fontSize: 'var(--text-base)' }}>{ext.name}</h4>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>v{ext.version}</div>
              </div>
              <label style={{ position: 'relative', display: 'inline-block', width: 36, height: 20 }}>
                <input type="checkbox" checked={ext.enabled} onChange={() => toggleExtension(ext.id, !ext.enabled)} style={{ opacity: 0, width: 0, height: 0 }} />
                <span style={{ position: 'absolute', inset: 0, borderRadius: 'var(--radius-full)', background: ext.enabled ? 'var(--accent)' : 'var(--border-default)', transition: 'var(--transition-fast)', cursor: 'pointer' }}>
                  <span style={{ position: 'absolute', top: 2, left: ext.enabled ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: 'white', transition: 'var(--transition-fast)' }} />
                </span>
              </label>
            </div>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{ext.description}</p>
            <div style={{ marginTop: 'var(--space-2)' }}>
              <span className={`badge ${ext.enabled ? 'badge-green' : 'badge-gray'}`} style={{ fontSize: 'var(--text-xs)' }}>
                {ext.enabled ? t('extensions.enabled') : t('extensions.disabled')}
              </span>
            </div>
          </div>
        ))}
        {extensions.length === 0 && !tunnel && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 'var(--space-8)', color: 'var(--text-muted)' }}>
            {t('extensions.no_extensions')}
          </div>
        )}
      </div>
    </div>
  )
}
