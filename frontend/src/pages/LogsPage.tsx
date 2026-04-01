import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { logsApi } from '../api/modules/logs'
import { Button, Input, Switch, Checkbox, Radio, Space } from 'antd'


type LogSource = 'gateway' | 'error' | 'backend'
type ViewMode = 'raw' | 'json'

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
  const [viewMode, setViewMode] = useState<ViewMode>('raw')
  const [wordWrap, setWordWrap] = useState(true)
  const logEndRef = useRef<HTMLDivElement>(null)

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true)
      const raw = await logsApi.tail(source, 500)
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
    if (viewMode === 'raw') {
      logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [lines, viewMode])

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

  const tryFormatJson = (line: string): string => {
    try {
      const obj = JSON.parse(line)
      return JSON.stringify(obj, null, 2)
    } catch {
      return line
    }
  }

  const handleExport = () => {
    const content = viewMode === 'json'
      ? filtered.map(tryFormatJson).join('\n\n')
      : filtered.join('\n')
    const ext = viewMode === 'json' ? '.json' : '.log'
    const blob = new Blob([content], { type: viewMode === 'json' ? 'application/json' : 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `openclaw-${source}-${new Date().toISOString().slice(0, 19)}${ext}`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
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
          <Button key={s.key} onClick={() => setSource(s.key)} style={{
            padding: '6px 16px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer',
            background: source === s.key ? 'var(--accent)' : 'transparent',
            color: source === s.key ? '#fff' : 'var(--text-secondary)',
            fontSize: 'var(--text-sm)', fontWeight: 500,
          }}>{t(s.labelKey)}</Button>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', marginTop: 'var(--space-3)', flexShrink: 0, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 200px', minWidth: 200, position: 'relative' }}>
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('logs.search_placeholder')}
            style={{ paddingLeft: 32 }}
          />
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>🔍</span>
        </div>
        <Radio.Group
          value={viewMode}
          onChange={e => setViewMode(e.target.value)}
          optionType="button"
          buttonStyle="solid"
          size="small"
        >
          <Radio.Button value="raw">Raw</Radio.Button>
          <Radio.Button value="json">JSON</Radio.Button>
        </Radio.Group>
        <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
          <Checkbox checked={wordWrap} onChange={(v: any) => setWordWrap(v.checked)} />
          {t('logs.word_wrap')}
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
          <Checkbox checked={autoRefresh} onChange={(v: any) => setAutoRefresh(v.checked)} />
          {t('logs.auto_refresh')}
        </label>
        <Button type="text" onClick={fetchLogs} disabled={loading}>🔄 {t('logs.refresh')}</Button>
        <Button type="text" onClick={handleExport}>📥 {t('logs.export')}</Button>
      </div>

      {/* Log content - fixed height, scrollable */}
      <div style={{
        flex: 1,
        minHeight: 0,
        marginTop: 'var(--space-3)',
        background: '#0a0a0a',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-default)',
        overflowY: 'auto',
        overflowX: 'auto',
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--text-sm)',
        lineHeight: 1.6,
        padding: 'var(--space-3)',
      }}>
        {loading && lines.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 'var(--space-8)' }}>{t('app.loading')}</div>
        ) : filtered.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 'var(--space-8)' }}>{t('logs.no_logs')}</div>
        ) : viewMode === 'json' ? (
          <pre style={{ margin: 0, color: 'var(--text-secondary)' }}>
            {filtered.map((line, i) => {
              const formatted = tryFormatJson(line)
              return (
                <div key={i} style={{
                  color: getLineColor(line),
                  marginBottom: 8,
                  padding: 'var(--space-2)',
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: 'var(--radius-sm)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: wordWrap ? 'break-all' : 'normal',
                }}>
                  {formatted || '\u00A0'}
                </div>
              )
            })}
          </pre>
        ) : (
          filtered.map((line, i) => (
            <div key={i} style={{
              color: getLineColor(line),
              whiteSpace: wordWrap ? 'pre-wrap' : 'pre',
              wordBreak: wordWrap ? 'break-all' : 'normal',
            }}>
              {line || '\u00A0'}
            </div>
          ))
        )}
        <div ref={logEndRef} />
      </div>
    </div>
  )
}
