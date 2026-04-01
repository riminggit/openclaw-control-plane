import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Card, Table, Statistic, Row, Col, Tag, Progress, Spin, Segmented, Empty, Typography } from 'antd'
import { ThunderboltOutlined, ClockCircleOutlined, TeamOutlined, BarChartOutlined } from '@ant-design/icons'


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
        fetch(`${API}/sessions?days=${days}&limit=20`),
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

  const fmtTokens = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
    return String(n)
  }

  const maxModelTokens = Math.max(...modelUsage.map(m => m.tokens), 1)

  const statusColors: Record<string, string> = {
    running: 'processing',
    idle: 'default',
    unknown: 'default',
  }

  const sessionColumns = [
    {
      title: t('usage.rank', '#'),
      key: 'rank',
      width: 50,
      render: (_: unknown, __: unknown, i: number) => i + 1,
    },
    {
      title: t('usage.agent', 'Agent'),
      dataIndex: 'agent',
      key: 'agent',
      render: (v: string) => <Tag>{v}</Tag>,
    },
    {
      title: t('usage.model', 'Model'),
      dataIndex: 'model',
      key: 'model',
      render: (v: string) => <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-xs)' }}>{v}</span>,
    },
    {
      title: t('usage.tokens', 'Tokens'),
      dataIndex: 'tokens',
      key: 'tokens',
      sorter: (a: TopSession, b: TopSession) => b.tokens - a.tokens,
      defaultSortOrder: 'descend',
      render: (v: number) => <span style={{ fontWeight: 600 }}>{fmtTokens(v)}</span>,
    },
    {
      title: t('usage.status', 'Status'),
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (v: string) => <Tag color={statusColors[v] || 'default'}>{v}</Tag>,
    },
    {
      title: t('usage.last_active', 'Last Active'),
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (v: string) => v ? new Date(v).toLocaleString() : '-',
    },
  ]

  const barColors = ['#1677ff', '#52c41a', '#faad14', '#eb2f96', '#722ed1', '#13c2c2', '#fa8c16', '#2f54eb']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <div className="page-eyebrow">{t('usage.eyebrow')}</div>
          <h1 className="page-title">{t('usage.title')}</h1>
          <p className="page-subtitle">{t('usage.subtitle')}</p>
        </div>
        <Segmented
          value={range}
          onChange={v => setRange(v as Range)}
          options={[
            { label: t('usage.range_today', 'Today'), value: 'today' },
            { label: t('usage.range_7d', '7 Days'), value: '7d' },
            { label: t('usage.range_30d', '30 Days'), value: '30d' },
          ]}
        />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>
      ) : (
        <>
          {/* Summary Cards */}
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} lg={6}>
              <Card size="small">
                <Statistic
                  title={t('usage.total_tokens')}
                  value={summary ? summary.total_tokens : 0}
                  formatter={v => fmtTokens(v as number)}
                  prefix={<ThunderboltOutlined />}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card size="small">
                <Statistic
                  title={t('usage.total_sessions')}
                  value={summary ? summary.total_sessions : 0}
                  prefix={<TeamOutlined />}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card size="small">
                <Statistic
                  title={t('usage.avg_per_session')}
                  value={summary ? summary.avg_tokens_per_session : 0}
                  formatter={v => fmtTokens(v as number)}
                  prefix={<BarChartOutlined />}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card size="small">
                <Statistic
                  title={t('usage.peak_session')}
                  value={summary ? summary.peak_session_tokens : 0}
                  formatter={v => fmtTokens(v as number)}
                  suffix={summary?.peak_session_id ? `tokens` : undefined}
                  prefix={<ClockCircleOutlined />}
                />
                {summary?.peak_session_id && (
                  <Typography.Text type="secondary" style={{ fontSize: 'var(--text-xs)' }}>
                    {summary.peak_session_id}
                  </Typography.Text>
                )}
              </Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]}>
            {/* Top Sessions Table */}
            <Col xs={24} lg={14}>
              <Card title={t('usage.top_sessions')} size="small">
                {topSessions.length > 0 ? (
                  <Table
                    dataSource={topSessions}
                    columns={sessionColumns}
                    rowKey="session_id"
                    pagination={false}
                    size="small"
                    scroll={{ y: 400 }}
                  />
                ) : (
                  <Empty description={t('usage.no_sessions')} style={{ padding: 40 }} />
                )}
              </Card>
            </Col>

            {/* Model Distribution */}
            <Col xs={24} lg={10}>
              <Card title={t('usage.model_distribution')} size="small">
                {modelUsage.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    {modelUsage.map((m, i) => (
                      <div key={m.model}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 'var(--text-sm)' }}>{m.model}</span>
                          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                            {fmtTokens(m.tokens)} · {m.sessions} sessions
                          </span>
                        </div>
                        <Progress
                          percent={Math.round((m.tokens / maxModelTokens) * 100)}
                          strokeColor={barColors[i % barColors.length]}
                          size="small"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <Empty description={t('usage.no_models')} style={{ padding: 40 }} />
                )}
              </Card>
            </Col>
          </Row>
        </>
      )}
    </div>
  )
}
