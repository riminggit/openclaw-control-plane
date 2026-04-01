import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Tag, Table, Switch, Popconfirm, Checkbox, Empty, Card, Row, Col, Statistic, Typography, Progress, message, Space } from 'antd'
import { gatewayClient } from '../lib/gateway-client'
import { useConnectionState } from '../hooks/useGateway'

const { Text } = Typography

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
  const [syncing, setSyncing] = useState(false)
  const connState = useConnectionState()

  const fetchData = useCallback(async (skipSync = false) => {
    try {
      // Sync sessions from Gateway first (if connected)
      if (!skipSync && connState === 'connected') {
        try {
          setSyncing(true)
          const res = await gatewayClient.call('sessions.list', { limit: 200, activeMinutes: 1440 })
          const sessions = res?.sessions || (Array.isArray(res) ? res : [])
          if (sessions.length > 0) {
            await fetch('/api/agents/lifecycle/sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sessions }),
            })
          }
        } catch { /* sync failed, still load data */ }
        finally { setSyncing(false) }
      }

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
  }, [connState])

  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => {
    const timer = setInterval(() => fetchData(true), 30000)
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
      message.success(t('lifecycle.cleanupSuccess'))
      setSelected(new Set())
      setTimeout(() => fetchData(true), 500)
    } catch {
      message.error(t('lifecycle.cleanupFailed'))
    }
  }

  const autoCleanup = async () => {
    try {
      await fetch('/api/agents/lifecycle/cleanup/auto', { method: 'POST' })
      message.success(t('lifecycle.cleanupSuccess'))
      setTimeout(() => fetchData(true), 500)
    } catch {
      message.error(t('lifecycle.cleanupFailed'))
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

  const statusCards = [
    { key: 'ACTIVE', color: '#52c41a' },
    { key: 'IDLE', color: '#1890ff' },
    { key: 'STALE', color: '#faad14' },
    { key: 'ZOMBIE', color: '#ff4d4f' },
    { key: 'COMPLETED', color: '#6b7280' },
    { key: 'FAILED', color: '#ff4d4f' },
  ]

  const agentColumns = [
    {
      title: '', dataIndex: 'session_key', width: 48,
      render: (key: string) => <Checkbox checked={selected.has(key)} onChange={() => toggleSelect(key)} />,
    },
    { title: t('lifecycle.label'), dataIndex: 'agent_label', key: 'label',
      render: (label: string | null, r: LifecycleAgent) => (
        <a href={`/sessions/${r.session_key}`} style={{ color: 'var(--text-primary)', textDecoration: 'none' }}>
          {label || r.agent_id || r.session_key}
        </a>
      ),
    },
    { title: t('lifecycle.status'), dataIndex: 'status', key: 'status',
      render: (status: string) => (
        <Tag color={
          status === 'ACTIVE' ? 'green' : status === 'IDLE' ? 'blue' : status === 'STALE' ? 'warning' : status === 'ZOMBIE' ? 'red' : 'default'
        }>{status}</Tag>
      ),
    },
    { title: t('lifecycle.channel'), dataIndex: 'channel', key: 'channel', render: (v: string) => v || '—' },
    { title: t('lifecycle.model'), dataIndex: 'model', key: 'model', render: (v: string) => v || '—', width: 160 },
    { title: t('lifecycle.tokens'), dataIndex: 'total_tokens', key: 'tokens', align: 'right' as const,
      render: (v: number) => v > 0 ? v.toLocaleString() : '—',
    },
    { title: t('lifecycle.lastActive'), dataIndex: 'last_active_at', key: 'lastActive', width: 160,
      render: (v: string) => v ? new Date(v).toLocaleString() : '—',
    },
  ]

  const logColumns = [
    { title: t('lifecycle.agent'), dataIndex: 'agent_label', key: 'agent',
      render: (v: string | null, r: CleanupLogEntry) => v || r.session_key,
    },
    { title: t('lifecycle.status'), dataIndex: 'lifecycle_state', key: 'state',
      render: (v: string) => <Tag>{v}</Tag>,
    },
    { title: t('lifecycle.action'), dataIndex: 'action', key: 'action' },
    { title: t('lifecycle.detail'), dataIndex: 'detail', key: 'detail',
      render: (v: string | null) => v || '—', ellipsis: true,
    },
    { title: t('lifecycle.cleanedAt'), dataIndex: 'cleaned_at', key: 'cleaned', width: 160,
      render: (v: string) => new Date(v).toLocaleString(),
    },
  ]

  if (loading) {
    return (
      <div>
        <div className="page-header">
          <div className="page-eyebrow">{t('lifecycle.eyebrow')}</div>
          <h1 className="page-title">{t('lifecycle.title')}</h1>
        </div>
        <Card loading style={{ marginBottom: 16 }} />
        <Card loading />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <div className="page-eyebrow">{t('lifecycle.eyebrow')}</div>
          <h1 className="page-title">{t('lifecycle.title')}</h1>
          <p className="page-subtitle">{t('lifecycle.subtitle')}</p>
        </div>
        <Space>
          <Button onClick={() => fetchData(false)} loading={syncing} icon={<span>🔄</span>}>
            {syncing ? 'Syncing...' : 'Sync Gateway'}
          </Button>
          <Button onClick={autoCleanup}>Run Cleanup</Button>
          <Tag color={autoConfig?.enabled ? 'green' : 'default'} style={{ cursor: 'pointer', padding: '4px 12px' }} onClick={toggleAutoCleanup}>
            Auto: {autoConfig?.enabled ? 'ON' : 'OFF'}
          </Tag>
        </Space>
      </div>

      {/* Status Summary */}
      <Row gutter={[12, 12]}>
        {statusCards.map(sc => (
          <Col xs={8} sm={4} key={sc.key}>
            <Card size="small" style={{ borderLeft: `3px solid ${sc.color}` }}>
              <Statistic
                title={<span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{sc.key}</span>}
                value={statusCounts[sc.key] || 0}
                valueStyle={{ fontSize: 20, fontWeight: 700, color: sc.color }}
              />
            </Card>
          </Col>
        ))}
      </Row>

      {/* Actions Bar */}
      {selected.size > 0 && (
        <Card size="small" style={{ borderColor: 'var(--status-blue)' }}>
          <Space>
            <Text>{selected.size} selected</Text>
            <Button type="primary" onClick={cleanupSelected}>{t('lifecycle.cleanupSelected')}</Button>
            <Button onClick={() => setSelected(new Set())}>{t('app.cancel')}</Button>
          </Space>
        </Card>
      )}

      {/* Agent Table */}
      {agents.length === 0 ? (
        <Empty description={t('lifecycle.noAgents')} />
      ) : (
        <Card>
          <Table
            dataSource={agents}
            columns={agentColumns}
            rowKey="session_key"
            size="middle"
            pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (total) => `${total} sessions` }}
            rowSelection={{
              selectedRowKeys: Array.from(selected),
              onChange: (keys) => setSelected(new Set(keys as string[])),
            }}
          />
        </Card>
      )}

      {/* Cleanup History */}
      {logs.length > 0 && (
        <Card title={t('lifecycle.cleanupHistory')}>
          <Table
            dataSource={logs}
            columns={logColumns}
            rowKey="id"
            size="small"
            pagination={{ pageSize: 10 }}
          />
        </Card>
      )}
    </div>
  )
}
