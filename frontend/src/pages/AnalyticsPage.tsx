import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { apiGet, apiPost, apiPatch } from '../api/client'

interface CostSummary { today: { tokens: number; cost_usd: number }; week: { tokens: number; cost_usd: number }; month: { tokens: number; cost_usd: number } }
interface TrendPoint { date: string; total_tokens: number; estimated_cost_usd: number }
interface AgentCost { agent_id: string; total_tokens: number; estimated_cost_usd: number }
interface Budget { id: string; name: string; budget_type: string; budget_limit_usd: number; current_usage_usd: number; alert_threshold_pct: number; is_active: boolean; usage_pct: number }

export function AnalyticsPage() {
  const { t } = useTranslation()
  const [summary, setSummary] = useState<CostSummary | null>(null)
  const [trend, setTrend] = useState<TrendPoint[]>([])
  const [agents, setAgents] = useState<AgentCost[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [newBudget, setNewBudget] = useState({ name: '', budget_type: 'daily', budget_limit_usd: 10, alert_threshold_pct: 80 })

  useEffect(() => {
    apiGet<CostSummary>('/analytics/cost/summary').then(setSummary).catch(() => {})
    apiGet<TrendPoint[]>('/analytics/cost/trend?period_days=30').then(setTrend).catch(() => {})
    apiGet<AgentCost[]>('/analytics/cost/by-agent?period_days=7').then(setAgents).catch(() => {})
    apiGet<Budget[]>('/analytics/cost/budget').then(setBudgets).catch(() => {})
  }, [])

  const createBudget = async () => {
    if (!newBudget.name) return
    await apiPost('/analytics/cost/budget', newBudget)
    const b = await apiGet<Budget[]>('/analytics/cost/budget')
    setBudgets(b)
    setNewBudget({ name: '', budget_type: 'daily', budget_limit_usd: 10, alert_threshold_pct: 80 })
  }

  const toggleBudget = async (id: string, active: boolean) => {
    await apiPatch(`/analytics/cost/budget/${id}`, { is_active: !active })
    const b = await apiGet<Budget[]>('/analytics/cost/budget')
    setBudgets(b)
  }

  const cards = summary ? [
    { label: t('analytics.today'), tokens: summary.today.tokens, cost: summary.today.cost_usd, color: 'var(--accent)' },
    { label: t('analytics.this_week'), tokens: summary.week.tokens, cost: summary.week.cost_usd, color: 'var(--info)' },
    { label: t('analytics.this_month'), tokens: summary.month.tokens, cost: summary.month.cost_usd, color: 'var(--success)' },
  ] : []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <h2 style={{ margin: 0 }}>{t('analytics.title')}</h2>

      {/* Cost cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)' }}>
        {cards.map(c => (
          <div key={c.label} className="card" style={{ borderTop: `3px solid ${c.color}` }}>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{c.label}</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 700 }}>${c.cost.toFixed(2)}</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{c.tokens.toLocaleString()} tokens</div>
          </div>
        ))}
      </div>

      {/* Trend chart */}
      <div className="card">
        <h3 style={{ margin: '0 0 var(--space-4)' }}>{t('analytics.trend')}</h3>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={trend}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="var(--text-muted)" />
            <YAxis tick={{ fontSize: 11 }} stroke="var(--text-muted)" />
            <Tooltip contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 8 }} />
            <Line type="monotone" dataKey="estimated_cost_usd" stroke="var(--accent)" strokeWidth={2} dot={false} name={t('analytics.cost_usd')} />
            <Line type="monotone" dataKey="total_tokens" stroke="var(--info)" strokeWidth={1} dot={false} name="Tokens" yAxisId={1} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Agent ranking */}
      <div className="card">
        <h3 style={{ margin: '0 0 var(--space-4)' }}>{t('analytics.agent_ranking')}</h3>
        {agents.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>{t('analytics.no_data')}</div>}
        <ResponsiveContainer width="100%" height={Math.max(200, agents.length * 36)}>
          <BarChart data={agents} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis type="number" tick={{ fontSize: 11 }} stroke="var(--text-muted)" />
            <YAxis type="category" dataKey="agent_id" width={140} tick={{ fontSize: 11 }} stroke="var(--text-muted)" />
            <Tooltip contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 8 }} />
            <Bar dataKey="estimated_cost_usd" fill="var(--accent)" name={t('analytics.cost_usd')} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Budget */}
      <div className="card">
        <h3 style={{ margin: '0 0 var(--space-4)' }}>{t('analytics.budget')}</h3>
        {budgets.map(b => (
          <div key={b.id} style={{ marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <span style={{ minWidth: 120, fontWeight: 500 }}>{b.name}</span>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{b.budget_type}</span>
            <div style={{ flex: 1, height: 12, background: 'var(--border)', borderRadius: 6, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min(b.usage_pct, 100)}%`, background: b.usage_pct >= b.alert_threshold_pct ? 'var(--danger)' : 'var(--success)', borderRadius: 6, transition: 'width 0.3s' }} />
            </div>
            <span style={{ fontSize: 'var(--text-sm)' }}>${b.current_usage_usd.toFixed(2)} / ${b.budget_limit_usd.toFixed(2)}</span>
            <button className={`btn btn-sm ${b.is_active ? 'btn-primary' : ''}`} onClick={() => toggleBudget(b.id, b.is_active)}>
              {b.is_active ? '✓' : '○'}
            </button>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-3)', flexWrap: 'wrap' }}>
          <input className="form-input" placeholder={t('analytics.budget_name')} value={newBudget.name} onChange={e => setNewBudget({ ...newBudget, name: e.target.value })} />
          <select className="form-input" value={newBudget.budget_type} onChange={e => setNewBudget({ ...newBudget, budget_type: e.target.value })}>
            <option value="daily">{t('analytics.daily')}</option>
            <option value="weekly">{t('analytics.weekly')}</option>
            <option value="monthly">{t('analytics.monthly')}</option>
          </select>
          <input className="form-input" type="number" step="0.1" value={newBudget.budget_limit_usd} onChange={e => setNewBudget({ ...newBudget, budget_limit_usd: parseFloat(e.target.value) || 0 })} style={{ width: 100 }} />
          <button className="btn btn-primary" onClick={createBudget}>{t('analytics.create_budget')}</button>
        </div>
      </div>
    </div>
  )
}
