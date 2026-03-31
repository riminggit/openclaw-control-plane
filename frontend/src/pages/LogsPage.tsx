import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { logsApi } from '../api/modules/logs'

type LogSource = 'gateway' | 'error' | 'backend'

const SOURCES: { key: LogSource; labelKey: string }[] = [
  { key: 'gateway', labelKey: 'logs.source_gateway' },
  { key: 'error', labelKey: 'logs.source_error' },
  { key: 'backend', labelKey: 'logs.source_backend' },
]

export function LogsPage() {
  const { t } = useTranslation()
  const [source, setSource] = useState<LogSource>('gateway')
  const [lines, setLines] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [autoRefresh, setAutoRefresh] = useState(false)
  const logEndRef = useRef<HTMLDivElement>(null)

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true)
      const raw = await logsApi.tail(source, 200)
      const text = typeof raw === 'string' ? raw : JSON.stringify(raw)
      setLines(text.split('\n'))
    } catch {
      setLines(['[Error fetching logs]'])
    } finally {
      setLoading(false)
    }
  }, [source])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lines])

  useEffect(() => {
    if (!autoRefresh) return
    const id = setInterval(fetchLogs, 5000)
    return () => clearInterval(id)
  }, [autoRefresh, fetchLogs])

  const filtered = search
    ? lines.filter(l => l.toLowerCase().includes(search.toLowerCase()))
    : lines

  const getLineColor = (line: string): string => {
    if (line.includes('ERROR') || line.includes('FATAL')) return 'var(--status-red)'
    if (line.includes('WARN') || line.includes('WARNING')) return 'var(--status-yellow)'
    if (line.includes('INFO')) return 'var(--status-blue)'
    return 'var(--text-secondary)'
  }

  const handleExport = () => {
    const blob = new Blob([filtered.join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `openclaw-${source}-${new Date().toISOString().slice(0, 19)}.log`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="page-header" style={{ flexShrink: 0 }}>
        <div>
          <div className="page-eyebrow">{t('logs.eyebrow')}</div>
          <h1 className="page-title">{t('logs.title')}</h1>
          <p className="page-subtitle">{t('logs.subtitle')}</p>
        </div>
      </div>

      {/* Source tabs */}
      <div style={{ display: 'flex', gap: 2, background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', padding: 3, flexShrink: 0 }}>
        {SOURCES.map(s => (
          <button key={s.key} onClick={() => setSource(s.key)} style={{
            padding: '6px 16px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer',
            background: source === s.key ? 'var(--accent)' : 'transparent',
            color: source === s.key ? '#fff' : 'var(--text-secondary)',
            fontSize: 'var(--text-sm)', fontWeight: 500,
          }}>{t(s.labelKey)}</button>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', marginTop: 'var(--space-3)', flexShrink: 0 }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <input
            className="input"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('logs.search_placeholder')}
            style={{ paddingLeft: 32 }}
          />
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>🔍</span>
        </div>
        <button className="btn btn-ghost" onClick={fetchLogs} disabled={loading}>🔄 {t('logs.refresh')}</button>
        <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
          <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} />
          {t('logs.auto_refresh')}
        </label>
        <button className="btn btn-ghost" onClick={handleExport}>📥 {t('logs.export')}</button>
      </div>

      {/* Log content */}
      <div style={{
        flex: 1, marginTop: 'var(--space-3)', background: '#0a0a0a', borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-default)', overflow: 'auto', fontFamily: 'var(--font-mono)',
        fontSize: 'var(--text-sm)', lineHeight: 1.6, padding: 'var(--space-3)',
        minHeight: 400,
      }}>
        {loading && lines.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 'var(--space-8)' }}>{t('app.loading')}</div>
        ) : filtered.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 'var(--space-8)' }}>{t('logs.no_logs')}</div>
        ) : (
          filtered.map((line, i) => (
            <div key={i} style={{ color: getLineColor(line), whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
              {line || '\u00A0'}
            </div>
          ))
        )}
        <div ref={logEndRef} />
      </div>
    </div>
  )
}
