import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { apiGet, apiPost, apiPatch } from '../api/client'
import { Button, Input, Select, Card, InputNumber, Form, Table, Empty, Tag, Progress, Statistic, Row, Col, Typography, message, Spin } from 'antd'
import { DollarOutlined, ClockCircleOutlined, CalendarOutlined, FieldTimeOutlined, ThunderboltOutlined, WalletOutlined, AlertOutlined, SyncOutlined, ReloadOutlined } from '@ant-design/icons'

const { Text } = Typography

interface CostSummary { today: { tokens: number; cost_usd: number }; week: { tokens: number; cost_usd: number }; month: { tokens: number; cost_usd: number } }
interface TrendPoint { date: string; total_tokens: number; estimated_cost_usd: number }
interface AgentCost { agent_id: string; total_tokens: number; estimated_cost_usd: number }
interface Budget { id: string; name: string; budget_type: string; budget_limit_usd: number; current_usage_usd: number; alert_threshold_pct: number; is_active: boolean; usage_pct: number }
interface RealtimeData { total_tokens: number; total_cost_usd: number; active_sessions: number; active_tokens: number; active_cost_usd: number; by_agent: Record<string, { total_tokens: number; estimated_cost_usd: number; sessions: number }> }

export function AnalyticsPage() {
  const { t } = useTranslation()
  const [summary, setSummary] = useState<CostSummary | null>(null)
  const [trend, setTrend] = useState<TrendPoint[]>([])
  const [agents, setAgents] = useState<AgentCost[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [realtimeData, setRealtimeData] = useState<RealtimeData | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [loadingRealtime, setLoadingRealtime] = useState(false)
  const [form] = Form.useForm()

  useEffect(() => {
    // 优先获取实时数据
    fetchRealtimeData()
    // 同时获取历史数据
    apiGet<CostSummary>('/analytics/cost/summary').then(setSummary).catch(() => {})
    apiGet<TrendPoint[]>('/analytics/cost/trend?period_days=30').then(setTrend).catch(() => {})
    apiGet<AgentCost[]>('/analytics/cost/by-agent?period_days=7').then(setAgents).catch(() => {})
    apiGet<Budget[]>('/analytics/cost/budget').then(setBudgets).catch(() => {})
  }, [])

  const fetchRealtimeData = async () => {
    setLoadingRealtime(true)
    try {
      const data = await apiGet<RealtimeData>('/analytics/cost/realtime')
      setRealtimeData(data)
    } catch (e) {
      console.error('Failed to fetch realtime data:', e)
    } finally {
      setLoadingRealtime(false)
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    try {
      const result = await apiPost<{ ok: boolean; synced_sessions?: number; historical_records?: number; error?: string }>('/analytics/cost/sync', {})
      if (result.ok) {
        message.success(`同步成功: ${result.synced_sessions || 0} 个会话, ${result.historical_records || 0} 条历史记录`)
        // 刷新数据
        fetchRealtimeData()
        apiGet<CostSummary>('/analytics/cost/summary').then(setSummary).catch(() => {})
        apiGet<TrendPoint[]>('/analytics/cost/trend?period_days=30').then(setTrend).catch(() => {})
        apiGet<AgentCost[]>('/analytics/cost/by-agent?period_days=7').then(setAgents).catch(() => {})
      } else {
        message.error(`同步失败: ${result.error || '未知错误'}`)
      }
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : '未知错误'
      message.error(`同步失败: ${errorMessage}`)
    } finally {
      setSyncing(false)
    }
  }

  const createBudget = async (values: { name: string; budget_type: string; budget_limit_usd: number; alert_threshold_pct: number }) => {
    await apiPost('/analytics/cost/budget', values)
    const b = await apiGet<Budget[]>('/analytics/cost/budget')
    setBudgets(b)
    form.resetFields()
  }

  const toggleBudget = async (id: string, active: boolean) => {
    await apiPatch(`/analytics/cost/budget/${id}`, { is_active: !active })
    const b = await apiGet<Budget[]>('/analytics/cost/budget')
    setBudgets(b)
  }

  const summaryCards = [
    { key: 'today', icon: <ClockCircleOutlined />, color: 'var(--accent)' },
    { key: 'week', icon: <FieldTimeOutlined />, color: 'var(--status-blue)' },
    { key: 'month', icon: <CalendarOutlined />, color: 'var(--status-green)' },
  ]

  const budgetColumns = [
    { title: t('analytics.budgetName'), dataIndex: 'name', key: 'name', render: (v: string) => <Text strong>{v}</Text> },
    { title: t('analytics.budgetType'), dataIndex: 'budget_type', key: 'budget_type', render: (v: string) => <Tag>{v}</Tag> },
    {
      title: t('analytics.usage'), key: 'usage',
      render: (_: unknown, r: Budget) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Progress
            percent={Math.min(r.usage_pct, 100)}
            size="small"
            strokeColor={r.usage_pct >= r.alert_threshold_pct ? 'var(--status-red)' : 'var(--status-green)'}
            style={{ flex: 1, marginBottom: 0 }}
          />
          <Text type="secondary" style={{ whiteSpace: 'nowrap' }}>${r.current_usage_usd.toFixed(2)} / ${r.budget_limit_usd.toFixed(2)}</Text>
        </div>
      ),
    },
    {
      title: 'Status', dataIndex: 'is_active', key: 'is_active',
      render: (active: boolean, r: Budget) => (
        <Tag color={active ? 'green' : 'default'} onClick={() => toggleBudget(r.id, active)} style={{ cursor: 'pointer' }}>
          {active ? '● Active' : '○ Paused'}
        </Tag>
      ),
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <div className="page-eyebrow">{t('analytics.eyebrow')}</div>
          <h1 className="page-title">{t('analytics.title')}</h1>
          <p className="page-subtitle">{t('analytics.subtitle')}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button icon={<ReloadOutlined />} onClick={fetchRealtimeData} loading={loadingRealtime}>
            刷新实时数据
          </Button>
          <Button type="primary" icon={<SyncOutlined />} onClick={handleSync} loading={syncing}>
            同步数据
          </Button>
        </div>
      </div>

      {/* Realtime Data Card */}
      <Card
        style={{ borderTop: '3px solid var(--accent)' }}
        title={<span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><ThunderboltOutlined />实时数据</span>}
      >
        {loadingRealtime ? (
          <Spin />
        ) : realtimeData ? (
          <Row gutter={[16, 16]}>
            <Col xs={12} sm={6}>
              <Statistic
                title="总 Tokens"
                value={realtimeData.total_tokens}
                valueStyle={{ color: 'var(--text-primary)', fontWeight: 700 }}
              />
            </Col>
            <Col xs={12} sm={6}>
              <Statistic
                title="总成本 (USD)"
                value={realtimeData.total_cost_usd}
                precision={4}
                prefix={<DollarOutlined />}
                valueStyle={{ color: 'var(--accent)', fontWeight: 700 }}
              />
            </Col>
            <Col xs={12} sm={6}>
              <Statistic
                title="活跃会话"
                value={realtimeData.active_sessions}
                valueStyle={{ color: 'var(--status-blue)', fontWeight: 700 }}
              />
            </Col>
            <Col xs={12} sm={6}>
              <Statistic
                title="活跃成本 (USD)"
                value={realtimeData.active_cost_usd}
                precision={4}
                prefix={<DollarOutlined />}
                valueStyle={{ color: 'var(--status-green)', fontWeight: 700 }}
              />
            </Col>
          </Row>
        ) : (
          <Empty description="无法获取实时数据" />
        )}
      </Card>

      {/* Cost Summary Cards (Historical) */}
      <Row gutter={[16, 16]}>
        {summaryCards.map(card => {
          const data = summary?.[card.key as keyof CostSummary]
          const isEmpty = !data || (data.tokens === 0 && data.cost_usd === 0)
          return (
            <Col xs={24} sm={8} key={card.key}>
              <Card
                style={{ borderTop: `3px solid ${card.color}`, height: '100%' }}
                styles={{ body: { display: 'flex', flexDirection: 'column', gap: 8 } }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: '1.2rem', color: card.color }}>{card.icon}</span>
                  <Text type="secondary">{t(`analytics.${card.key === 'today' ? 'today' : card.key === 'week' ? 'thisWeek' : 'thisMonth'}`)}</Text>
                </div>
                {isEmpty ? (
                  <div style={{ padding: '8px 0' }}>
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('analytics.noData')} />
                  </div>
                ) : (
                  <>
                    <Statistic
                      value={data.cost_usd}
                      precision={2}
                      prefix={<DollarOutlined />}
                      valueStyle={{ color: 'var(--text-primary)', fontWeight: 700 }}
                    />
                    <Text type="secondary" style={{ fontSize: 'var(--text-xs)' }}>
                      {data.tokens.toLocaleString()} tokens
                    </Text>
                  </>
                )}
              </Card>
            </Col>
          )
        })}
      </Row>

      {/* Trend Chart */}
      <Card
        title={<span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><ThunderboltOutlined />{t('analytics.costTrend')}</span>}
      >
        {trend.length === 0 ? (
          <Empty description={t('analytics.noData')} style={{ padding: '40px 0' }} />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="var(--text-muted)" />
              <YAxis tick={{ fontSize: 11 }} stroke="var(--text-muted)" />
              <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 8 }} />
              <Line type="monotone" dataKey="estimated_cost_usd" stroke="var(--accent)" strokeWidth={2} dot={false} name={t('analytics.cost_usd')} />
              <Line type="monotone" dataKey="total_tokens" stroke="var(--status-blue)" strokeWidth={1} dot={false} name="Tokens" yAxisId={1} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Agent Ranking (Realtime) */}
      <Card
        title={<span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><AlertOutlined />Agent 成本排行 (实时)</span>}
      >
        {realtimeData && Object.keys(realtimeData.by_agent).length > 0 ? (
          <ResponsiveContainer width="100%" height={Math.max(200, Object.keys(realtimeData.by_agent).length * 36)}>
            <BarChart
              data={Object.entries(realtimeData.by_agent)
                .map(([agent_id, data]) => ({ agent_id, ...data }))
                .sort((a, b) => b.estimated_cost_usd - a.estimated_cost_usd)}
              layout="vertical"
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
              <XAxis type="number" tick={{ fontSize: 11 }} stroke="var(--text-muted)" />
              <YAxis type="category" dataKey="agent_id" width={140} tick={{ fontSize: 11 }} stroke="var(--text-muted)" />
              <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 8 }} />
              <Bar dataKey="estimated_cost_usd" fill="var(--accent)" name="Cost (USD)" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <Empty description={t('analytics.noData')} style={{ padding: '40px 0' }} />
        )}
      </Card>

      {/* Budget Management */}
      <Card
        title={<span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><WalletOutlined />{t('analytics.budgetAlerts')}</span>}
      >
        {budgets.length > 0 && (
          <Table
            dataSource={budgets}
            columns={budgetColumns}
            rowKey="id"
            pagination={false}
            size="middle"
            style={{ marginBottom: 24 }}
          />
        )}

        <div style={{ borderTop: '1px solid var(--border-default)', paddingTop: 16 }}>
          <Text strong style={{ display: 'block', marginBottom: 12 }}>{t('analytics.createBudget')}</Text>
          <Form
            form={form}
            layout="inline"
            onFinish={createBudget}
            initialValues={{ budget_type: 'daily', budget_limit_usd: 10, alert_threshold_pct: 80 }}
          >
            <Form.Item name="name" rules={[{ required: true, message: t('analytics.budgetName') }]}>
              <Input placeholder={t('analytics.budgetName')} style={{ minWidth: 140 }} />
            </Form.Item>
            <Form.Item name="budget_type">
              <Select style={{ minWidth: 120 }}>
                <Select.Option value="daily">{t('analytics.daily')}</Select.Option>
                <Select.Option value="weekly">{t('analytics.weekly')}</Select.Option>
                <Select.Option value="monthly">{t('analytics.monthly')}</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item name="budget_limit_usd">
              <InputNumber min={0} step={0.1} prefix="$" style={{ width: 130 }} />
            </Form.Item>
            <Form.Item name="alert_threshold_pct">
              <InputNumber min={0} max={100} step={5} suffix="%" style={{ width: 110 }} />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit">{t('analytics.createBudget')}</Button>
            </Form.Item>
          </Form>
        </div>
      </Card>
    </div>
  )
}
