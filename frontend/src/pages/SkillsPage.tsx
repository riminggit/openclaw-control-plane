import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'

interface Skill {
  name: string
  description: string
  version?: string
  status: 'eligible' | 'missing' | 'disabled' | 'blocked'
  bundled?: boolean
}

interface StoreSkill {
  name: string
  description: string
  version?: string
  source: 'skillhub' | 'clawhub'
}

const API = '/api/skills'

export function SkillsPage() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<'installed' | 'store'>('installed')
  const [installed, setInstalled] = useState<Skill[]>([])
  const [storeResults, setStoreResults] = useState<StoreSkill[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchSource, setSearchSource] = useState<'skillhub' | 'clawhub'>('skillhub')
  const [searching, setSearching] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const fetchInstalled = useCallback(async () => {
    try {
      const res = await fetch(`${API}/installed`)
      if (res.ok) setInstalled(await res.json())
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    fetchInstalled().finally(() => setLoading(false))
  }, [])

  const handleUninstall = async (name: string) => {
    setActionLoading(name)
    try {
      await fetch(`${API}/uninstall`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) })
      await fetchInstalled()
    } catch { /* ignore */ }
    setActionLoading(null)
  }

  const handleUpdate = async (name: string) => {
    setActionLoading(name)
    try {
      await fetch(`${API}/update`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) })
      await fetchInstalled()
    } catch { /* ignore */ }
    setActionLoading(null)
  }

  const handleInstall = async (skill: StoreSkill) => {
    setActionLoading(skill.name)
    try {
      await fetch(`${API}/install`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: skill.name, source: skill.source }) })
      await fetchInstalled()
    } catch { /* ignore */ }
    setActionLoading(null)
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    setSearching(true)
    try {
      const res = await fetch(`${API}/search?q=${encodeURIComponent(searchQuery)}&source=${searchSource}`)
      if (res.ok) setStoreResults(await res.json())
    } catch { /* ignore */ }
    setSearching(false)
  }

  const statusBadge = (status: string) => {
    const map: Record<string, string> = { eligible: 'badge-green', missing: 'badge-red', disabled: 'badge-yellow', blocked: 'badge-gray' }
    const labels: Record<string, string> = { eligible: t('skills.ready', '就绪'), missing: t('skills.missing', '缺失'), disabled: t('skills.disabled', '已禁用'), blocked: t('skills.blocked', '已阻止') }
    return <span className={`badge ${map[status] || 'badge-gray'}`}>{labels[status] || status}</span>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div>
        <p className="eyebrow">{t('skills.eyebrow', '插件管理')}</p>
        <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 600 }}>{t('skills.title', 'Skill 管理')}</h1>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', borderBottom: '1px solid var(--border-default)', paddingBottom: 'var(--space-2)' }}>
        {(['installed', 'store'] as const).map(key => (
          <button key={key} className={`btn ${tab === key ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab(key)} style={{ borderBottom: tab === key ? '2px solid var(--accent)' : 'none', borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0' }}>
            {t(`skills.tab_${key}`, key === 'installed' ? '已安装' : '商店搜索')}
          </button>
        ))}
      </div>

      {tab === 'installed' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 'var(--space-4)' }}>
          {loading ? <div className="skeleton" style={{ height: 120 }} /> : installed.map(skill => (
            <div key={skill.name} className="card" style={{ padding: 'var(--space-4)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 'var(--text-base)' }}>{skill.name}</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 2 }}>{skill.version || '-'}</div>
                </div>
                {statusBadge(skill.status)}
              </div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginTop: 'var(--space-2)' }}>{skill.description || '-'}</div>
              {!skill.bundled && (
                <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-3)' }}>
                  <button className="btn btn-secondary" onClick={() => handleUpdate(skill.name)} disabled={actionLoading === skill.name} style={{ fontSize: 'var(--text-xs)' }}>
                    {actionLoading === skill.name ? '...' : t('skills.update', '更新')}
                  </button>
                  <button className="btn btn-danger" onClick={() => handleUninstall(skill.name)} disabled={actionLoading === skill.name} style={{ fontSize: 'var(--text-xs)' }}>
                    {t('skills.uninstall', '卸载')}
                  </button>
                </div>
              )}
            </div>
          ))}
          {!loading && installed.length === 0 && <p style={{ color: 'var(--text-muted)' }}>{t('skills.no_installed', '暂无已安装 Skill')}</p>}
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} placeholder={t('skills.search_placeholder', '搜索 Skill...')} style={{ flex: 1, minWidth: 200, padding: 'var(--space-2) var(--space-3)', background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)' }} />
            <select value={searchSource} onChange={e => setSearchSource(e.target.value as any)} style={{ padding: 'var(--space-2) var(--space-3)', background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)' }}>
              <option value="skillhub">SkillHub</option>
              <option value="clawhub">ClawHub</option>
            </select>
            <button className="btn btn-primary" onClick={handleSearch} disabled={searching}>{searching ? '...' : t('app.search')}</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 'var(--space-4)' }}>
            {storeResults.map(skill => (
              <div key={`${skill.source}:${skill.name}`} className="card" style={{ padding: 'var(--space-4)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{skill.name}</div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{skill.version} · {skill.source}</div>
                  </div>
                  <button className="btn btn-primary" onClick={() => handleInstall(skill)} disabled={actionLoading === skill.name} style={{ fontSize: 'var(--text-xs)' }}>
                    {actionLoading === skill.name ? '...' : t('skills.install', '安装')}
                  </button>
                </div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginTop: 'var(--space-2)' }}>{skill.description}</div>
              </div>
            ))}
          </div>
          {storeResults.length === 0 && !searching && searchQuery && <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>{t('skills.no_results', '无搜索结果')}</p>}
        </div>
      )}
    </div>
  )
}
