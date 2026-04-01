import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Table, Card } from 'antd'


interface UsageSummary {
  period_days: number
  total_tokens: number
  total_sessions: number
  avg_tokens_per_session: number
  peak_session_tokens: number
  peak_session_id: string
}

interface TopSession {
  session_id: string
  agent: string
  model: string
  tokens: number
  created_at: string
  status: string
}

interface ModelUsage {
  model: string
  tokens: number
  sessions: number
}

type Range = 'today' | '7d' | '30d'

const RANGE_DAYS: Record<Range, number> = { today: 1, '7d': 7, '30d': 30 }

const API = '/api/usage'

export function UsagePage() {
  const { t } = useTranslation()
  const [range, setRange] = useState<Range>('7d')
  const [summary, setSummary] = useState<UsageSummary | null>(null)
  const [topSessions, setTopSessions] = useState<TopSession[]>([])
  const [modelUsage, setModelUsage] = useState<ModelUsage[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async (r: Range) => {
    setLoading(true)
    const days = RANGE_DAYS[r]
    try {
      const [sRes, tRes, mRes] = await Promise.all([
        fetch(`${API}/summary?days=${days}`),
        fetch(`${API}/sessions?days=${days}`),
        fetch(`${API}/by-model?days=${days}`),
      ])
      if (sRes.ok) setSummary(await sRes.json())
      if (tRes.ok) {
        const tData = await tRes.json()
        setTopSessions(tData.sessions || [])
      }
      if (mRes.ok) {
        const mData = await mRes.json()
        setModelUsage(mData.models || [])
      }
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  useEffect(() => { fetchData(range) }, [range])

  const fmtTokens = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : String(n)
  const maxModelTokens = Math.max(...modelUsage.map(m => m.tokens), 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
        <div>
          <p className="eyebrow">{t('usage.eyebrow', '用量统计')}</p>
          <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 600 }}>{t('usage.title', 'Usage 统计')}</h1>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-1)', background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', padding: 2 }}>
          {(['today', '7d', '30d'] as const).map(r => (
            <Button key={r} className={`btn ${range === r ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setRange(r)} style={{ fontSize: 'var(--text-sm)' }}>
              {t(`usage.range_${r}`, r === 'today' ? '今日' : r === '7d' ? '7天' : '30天')}
            </Button>
          ))}
        </div>
      </div>

      {loading ? <div className="skeleton" style={{ height: 200 }} /> : (
        <>
          {/* Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
            <div className="card" style={{ padding: 'var(--space-4)' }}>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>{t('usage.total_tokens', '总 Token 数')}</div>
              <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700 }}>{summary ? fmtTokens(summary.total_tokens) : '-'}</div>
            </div>
            <div className="card" style={{ padding: 'var(--space-4)' }}>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>{t('usage.avg_per_session', 'Session 均值')}</div>
              <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700 }}>{summary ? fmtTokens(summary.avg_tokens_per_session) : '-'}</div>
            </div>
            <div className="card" style={{ padding: 'var(--space-4)' }}>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>{t('usage.total_sessions', '总 Session 数')}</div>
              <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700 }}>{summary ? String(summary.total_sessions) : '-'}</div>
            </div>
            <div className="card" style={{ padding: 'var(--space-4)' }}>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>{t('usage.peak_session', '峰值 Session')}</div>
              <div style={{ fontSize: 'var(--text-base)', fontWeight: 600 }}>{summary?.peak_session_id || '-'}</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{summary ? fmtTokens(summary.peak_session_tokens) + ' tokens' : ''}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
            {/* Top Sessions Table */}
            <div className="card" style={{ padding: 'var(--space-4)' }}>
              <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, marginBottom: 'var(--space-3)' }}>{t('usage.top_sessions', 'Top Session 排行')}</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
                      <th style={{ textAlign: 'left', padding: 'var(--space-2)', color: 'var(--text-muted)' }}>{t('usage.session', 'Session')}</th>
                      <th style={{ textAlign: 'left', padding: 'var(--space-2)', color: 'var(--text-muted)' }}>{t('usage.agent', 'Agent')}</th>
                      <th style={{ textAlign: 'left', padding: 'var(--space-2)', color: 'var(--text-muted)' }}>{t('usage.model', '模型')}</th>
                      <th style={{ textAlign: 'right', padding: 'var(--space-2)', color: 'var(--text-muted)' }}>{t('usage.tokens', 'Tokens')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topSessions.map((s, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border-default)' }}>
                        <td style={{ padding: 'var(--space-2)' }}>{s.session_id}</td>
                        <td style={{ padding: 'var(--space-2)', color: 'var(--text-secondary)' }}>{s.agent}</td>
                        <td style={{ padding: 'var(--space-2)', color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>{s.model}</td>
                        <td style={{ padding: 'var(--space-2)', textAlign: 'right' }}>{fmtTokens(s.tokens)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {topSessions.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>{t('usage.no_sessions', '暂无数据')}</p>}
            </div>

            {/* Model Distribution */}
            <div className="card" style={{ padding: 'var(--space-4)' }}>
              <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, marginBottom: 'var(--space-3)' }}>{t('usage.model_distribution', '模型用量分布')}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {modelUsage.map((m, i) => (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', marginBottom: 4 }}>
                      <span>{m.model}</span>
                      <span style={{ color: 'var(--text-muted)' }}>{fmtTokens(m.tokens)} ({m.sessions} sessions)</span>
                    </div>
                    <div style={{ height: 8, background: 'var(--bg-surface-hover)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(m.tokens / maxModelTokens) * 100}%`, background: `hsl(${i * 60}, 70%, 60%)`, borderRadius: 4, transition: 'width var(--transition-normal)' }} />
                    </div>
                  </div>
                ))}
              </div>
              {modelUsage.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>{t('usage.no_models', '暂无数据')}</p>}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
