import { useEffect, useState, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Button, Tag, Table, Popconfirm, Empty, Card, Row, Col, Statistic,
  Typography, message, Space, Input, Select, Segmented, Drawer,
  Steps, Timeline, Descriptions, Badge, Tooltip, Modal, Divider,
  Alert, Spin,
} from 'antd'
import {
  CheckCircleOutlined, ReloadOutlined, EyeOutlined,
  SyncOutlined, DeleteOutlined, PlayCircleOutlined, PauseCircleOutlined,
  ExclamationCircleOutlined, SendOutlined, ClockCircleOutlined,
  ThunderboltOutlined, BugOutlined, TeamOutlined,
  RobotOutlined, CloudServerOutlined, FileTextOutlined,
} from '@ant-design/icons'
import { gatewayClient } from '../lib/gateway-client'
import { useConnectionState } from '../hooks/useGateway'
import { apiGet, apiPost, apiPut } from '../api/client'

const { Text } = Typography

// ─── Status config ───────────────────────────────────────────────────────────

const STATUS_META: Record<string, { color: string; dotColor: string; label: string }> = {
  ACTIVE:    { color: '#52c41a', dotColor: '#52c41a', label: '活跃' },
  IDLE:      { color: '#1890ff', dotColor: '#1890ff', label: '空闲' },
  STALE:     { color: '#faad14', dotColor: '#faad14', label: '陈旧' },
  ZOMBIE:    { color: '#ff4d4f', dotColor: '#ff4d4f', label: '僵尸' },
  COMPLETED: { color: '#6b7280', dotColor: '#6b7280', label: '已完成' },
  FAILED:    { color: '#ff4d4f', dotColor: '#ff4d4f', label: '失败' },
}

const TASK_STATUS_META: Record<string, { color: string; bg: string; label: string }> = {
  planned:     { color: '#8c8c8c', bg: '#f5f5f5', label: '待规划' },
  approved:    { color: '#1890ff', bg: '#e6f7ff', label: '已审批' },
  dispatched:  { color: '#722ed1', bg: '#f9f0ff', label: '已分派' },
  in_progress: { color: '#fa8c16', bg: '#fff7e6', label: '进行中' },
  review:      { color: '#faad14', bg: '#fffbe6', label: '评审中' },
  blocked:     { color: '#f5222d', bg: '#fff1f0', label: '已阻塞' },
  stopped:     { color: '#52c41a', bg: '#f6ffed', label: '已暂停' },
  done:        { color: '#52c41a', bg: '#f6ffed', label: '已完成' },
  cancelled:   { color: '#8c8c8c', bg: '#f5f5f5', label: '已取消' },
  rejected:    { color: '#f5222d', bg: '#fff1f0', label: '已驳回' },
}

// ─── Agent grouping ─────────────────────────────────────────────────────────

const TEAM_GROUPS = [
  {
    key: 'rd', label: '研发团队', icon: <TeamOutlined />,
    roles: ['rd-lead', 'rd-commander', 'rd-backend-arch', 'rd-backend-dev', 'rd-backend-dev-02',
      'rd-backend-dev-03', 'rd-frontend-arch', 'rd-frontend-dev', 'rd-frontend-dev-02',
      'rd-frontend-dev-03', 'rd-dba', 'rd-tester-func', 'rd-tester-auto', 'test-leader',
      'ui-designer', 'ui-checker', 'rd-product-manager', 'rd-pm-checker', 'rd-product-researcher'],
  },
  { key: 'doc', label: '文档团队', icon: <FileTextOutlined />, roles: ['doc-commander'] },
  { key: 'devops', label: '运维', icon: <CloudServerOutlined />, roles: ['devops'] },
  { key: 'data', label: '交易监控', icon: <ThunderboltOutlined />, roles: ['data-oracle'] },
  { key: 'other', label: '其他', icon: <RobotOutlined />, roles: [] },
]

// ─── Task flow steps ─────────────────────────────────────────────────────────

const TASK_STEPS = [
  { status: 'planned',     label: '待规划' },
  { status: 'approved',    label: '已审批' },
  { status: 'dispatched',  label: '已分派' },
  { status: 'in_progress', label: '进行中' },
  { status: 'review',      label: '评审中' },
  { status: 'done',        label: '已完成' },
]

// ─── Types ───────────────────────────────────────────────────────────────────

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

interface TaskItem {
  id: string
  title: string
  description?: string
  projectId: string
  category: string
  phase: string
  priority: string
  status: string
  ownerRole: string
  ownerAgentId?: string
  riskLevel: string
  docSyncRisk: string
  updatedAt: string
}

interface Transition {
  id: string
  from_status: string
  to_status: string
  actor: string
  reason: string
  created_at: string
}

// ─── Helper ──────────────────────────────────────────────────────────────────

function _formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${s % 60}s`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ${m % 60}m`
  return `${Math.floor(h / 24)}d ${h % 24}h`
}

// ─── Agent Status Dot ────────────────────────────────────────────────────────

function AgentStatusDot({ status }: { status: string }) {
  const meta = STATUS_META[status] || { dotColor: '#999', label: status }
  return (
    <Tooltip title={meta.label}>
      <span style={{
        display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
        backgroundColor: meta.dotColor,
        boxShadow: `0 0 4px ${meta.dotColor}`,
        flexShrink: 0,
      }} />
    </Tooltip>
  )
}

// ─── Agent Card ───────────────────────────────────────────────────────────────

function AgentCard({
  agent, onDetail, onCleanup, syncing,
}: {
  agent: LifecycleAgent
  onDetail: (a: LifecycleAgent) => void
  onCleanup: (key: string) => void
  syncing: boolean
}) {
  const meta = STATUS_META[agent.status] || { color: '#999', label: agent.status }
  const minsAgo = agent.last_active_at
    ? Math.round((Date.now() - new Date(agent.last_active_at).getTime()) / 60000)
    : null
  const runtime = agent.created_at
    ? _formatDuration(Date.now() - new Date(agent.created_at).getTime())
    : null
  const isDanger = agent.status === 'ZOMBIE' || agent.status === 'FAILED'

  return (
    <Card
      size="small"
      style={{
        borderLeft: `3px solid ${meta.color}`,
        borderRadius: 8,
        opacity: agent.status === 'COMPLETED' ? 0.75 : 1,
      }}
      styles={{ body: { padding: '12px 14px' } }}
      hoverable
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <AgentStatusDot status={agent.status} />
          <Text strong style={{ fontSize: 14, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {agent.agent_label || agent.agent_id || agent.session_key.slice(0, 12)}
          </Text>
          <Tag
            color={agent.status === 'ACTIVE' ? 'green' : agent.status === 'IDLE' ? 'blue'
              : agent.status === 'STALE' ? 'warning'
                : agent.status === 'ZOMBIE' || agent.status === 'FAILED' ? 'red' : 'default'}
            style={{ fontSize: 11, margin: 0 }}
          >
            {meta.label}
          </Tag>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {agent.model && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              🤖 {agent.model}
            </Text>
          )}
          {agent.channel && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              📡 {agent.channel}
            </Text>
          )}
          {minsAgo !== null && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              <ClockCircleOutlined /> {minsAgo}m 前活跃
            </Text>
          )}
          {runtime && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              ⏱️ 运行时长 {runtime}
            </Text>
          )}
          {agent.total_tokens > 0 && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              💬 {agent.total_tokens.toLocaleString()} tokens
            </Text>
          )}
        </div>

        <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
          <Button size="small" icon={<EyeOutlined />} onClick={() => onDetail(agent)}>
            详情
          </Button>
          <Button size="small" icon={<SyncOutlined />} loading={syncing}>
            同步
          </Button>
          {isDanger && (
            <Popconfirm
              title="确认清理此 Agent？"
              onConfirm={() => onCleanup(agent.session_key)}
              okText="确认" cancelText="取消"
            >
              <Button size="small" danger icon={<DeleteOutlined />}>
                清理
              </Button>
            </Popconfirm>
          )}
        </div>
      </div>
    </Card>
  )
}

// ─── Agent Detail Drawer ──────────────────────────────────────────────────────

function AgentDetailDrawer({
  agent, open, onClose,
}: {
  agent: LifecycleAgent | null
  open: boolean
  onClose: () => void
}) {
  const meta = STATUS_META[agent?.status || ''] || { color: '#999', label: agent?.status || '' }
  if (!agent) return null

  return (
    <Drawer
      title={
        <Space>
          <AgentStatusDot status={agent.status} />
          <span>{agent.agent_label || agent.agent_id || 'Agent'}</span>
        </Space>
      }
      placement="right" width={480} open={open} onClose={onClose}
    >
      <Descriptions column={1} size="small" bordered>
        <Descriptions.Item label="Session Key">
          <Text copyable style={{ fontSize: 11 }}>{agent.session_key}</Text>
        </Descriptions.Item>
        <Descriptions.Item label="Agent ID">{agent.agent_id || '—'}</Descriptions.Item>
        <Descriptions.Item label="状态">
          <Tag color={meta.color === '#52c41a' ? 'green' : meta.color === '#1890ff' ? 'blue'
            : meta.color === '#faad14' ? 'warning' : meta.color === '#ff4d4f' ? 'red' : 'default'}>
            {meta.label}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="渠道">{agent.channel || '—'}</Descriptions.Item>
        <Descriptions.Item label="模型">{agent.model || '—'}</Descriptions.Item>
        <Descriptions.Item label="Token 消耗">{agent.total_tokens.toLocaleString()}</Descriptions.Item>
        <Descriptions.Item label="创建时间">
          {agent.created_at ? new Date(agent.created_at).toLocaleString() : '—'}
        </Descriptions.Item>
        <Descriptions.Item label="最后活跃">
          {agent.last_active_at ? new Date(agent.last_active_at).toLocaleString() : '—'}
        </Descriptions.Item>
      </Descriptions>
      <Divider />
      <Space>
        <Button icon={<SyncOutlined />}>同步状态</Button>
        <Button
          icon={<BugOutlined />}
          onClick={() => window.open(`/sessions/${agent.session_key}`, '_blank')}
        >
          打开 Session
        </Button>
      </Space>
    </Drawer>
  )
}

// ─── Task Flow Steps View ─────────────────────────────────────────────────────

function TaskFlowSteps({ task }: { task: TaskItem }) {
  const currentIdx = Math.max(0, TASK_STEPS.findIndex(s => s.status === task.status))
  const meta = TASK_STATUS_META[task.status] || { color: '#999', bg: '#f5f5f5', label: task.status }

  return (
    <div>
      <Steps
        current={currentIdx}
        size="small"
        style={{ marginBottom: 20 }}
        items={TASK_STEPS.map((step, i) => ({
          title: step.label,
          status: i < currentIdx ? 'finish' : i === currentIdx ? 'process' : 'wait',
        }))}
      />
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        padding: '6px 14px', borderRadius: 20,
        backgroundColor: meta.bg, color: meta.color,
        fontWeight: 600, fontSize: 14,
      }}>
        {meta.label}
      </div>
    </div>
  )
}

// ─── Task Transitions Timeline ────────────────────────────────────────────────

function TaskTimeline({ transitions }: { transitions: Transition[] }) {
  if (transitions.length === 0) {
    return <Text type="secondary" style={{ fontSize: 13 }}>暂无流转记录</Text>
  }
  return (
    <Timeline
      style={{ marginTop: 16 }}
      items={transitions.map(tr => ({
        color: tr.to_status === 'done' ? 'green' : tr.to_status === 'rejected' ? 'red' : 'blue',
        children: (
          <div>
            <Space>
              <Tag>{tr.from_status}</Tag>
              <span>→</span>
              <Tag color={TASK_STATUS_META[tr.to_status] ? 'blue' : 'default'}>{tr.to_status}</Tag>
            </Space>
            <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
              {tr.actor}
              {tr.reason && <span> · {tr.reason}</span>}
              <br />
              {new Date(tr.created_at).toLocaleString()}
            </div>
          </div>
        ),
      }))}
    />
  )
}

// ─── Task Control Panel ───────────────────────────────────────────────────────

const TASK_ACTIONS: Record<string, Array<{ label: string; icon: React.ReactNode; danger?: boolean; nextStatus: string }>> = {
  planned:     [{ label: '提交审批', icon: <SendOutlined />, nextStatus: 'approved' }],
  approved:    [{ label: '分派任务', icon: <SendOutlined />, nextStatus: 'dispatched' }],
  dispatched:  [{ label: '开始执行', icon: <PlayCircleOutlined />, nextStatus: 'in_progress' }],
  in_progress: [{ label: '暂停任务', icon: <PauseCircleOutlined />, nextStatus: 'stopped' }],
  review: [
    { label: '审批通过', icon: <CheckCircleOutlined />, nextStatus: 'done' },
    { label: '审批驳回', icon: <ExclamationCircleOutlined />, danger: true, nextStatus: 'rejected' },
  ],
  stopped:    [{ label: '恢复执行', icon: <PlayCircleOutlined />, nextStatus: 'in_progress' }],
  rejected:   [{ label: '重新提交', icon: <ReloadOutlined />, nextStatus: 'planned' }],
  done:       [],
  cancelled:  [],
}

function TaskControlPanel({ task, onRefresh }: { task: TaskItem; onRefresh: () => void }) {
  const [loading, setLoading] = useState(false)
  const actions = TASK_ACTIONS[task.status] || []

  const doAction = async (actionLabel: string, nextStatus: string, isDanger = false) => {
    Modal.confirm({
      title: isDanger
        ? `确认驳回任务「${task.title}」？`
        : `确认执行「${actionLabel}」？`,
      okText: '确认', cancelText: '取消',
      okButtonProps: isDanger ? { danger: true } : undefined,
      onOk: async () => {
        setLoading(true)
        try {
          if (task.status === 'planned' && nextStatus === 'approved') {
            await apiPost(`/api/workflow/tasks/${task.id}/review`, { decision: 'approve', comment: 'Manual approval via control panel' })
          } else if (task.status === 'approved' && nextStatus === 'dispatched') {
            await apiPost(`/api/workflow/tasks/${task.id}/dispatch`, {
              target_agent_id: task.ownerAgentId || task.ownerRole || 'main',
            })
          } else if (task.status === 'in_progress' && nextStatus === 'stopped') {
            await apiPost(`/api/workflow/tasks/${task.id}/stop`, {})
          } else if (task.status === 'stopped' && nextStatus === 'in_progress') {
            await apiPost(`/api/workflow/tasks/${task.id}/resume`, {})
          } else if (task.status === 'review') {
            await apiPost(`/api/workflow/tasks/${task.id}/review`, {
              decision: nextStatus === 'done' ? 'approve' : 'reject',
              comment: nextStatus === 'done' ? 'Manual approval' : 'Manual rejection',
            })
          } else if (task.status === 'rejected' && nextStatus === 'planned') {
            await apiPut(`/api/tasks/${task.id}`, { status: 'planned' })
          } else {
            await apiPut(`/api/tasks/${task.id}`, { status: nextStatus })
          }
          message.success(`「${actionLabel}」成功`)
          onRefresh()
        } catch (e: any) {
          message.error(`操作失败: ${e.message}`)
        } finally {
          setLoading(false)
        }
      },
    })
  }

  if (actions.length === 0) {
    return (
      <Alert
        message="当前状态无可用操作"
        type="info"
        showIcon
        style={{ marginTop: 16 }}
      />
    )
  }

  return (
    <div style={{ marginTop: 16 }}>
      <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 10 }}>
        🎛️ 可执行操作（仅在当前状态可用）
      </Text>
      <Space wrap>
        {actions.map(a => (
          <Button
            key={a.label}
            type="primary"
            danger={a.danger}
            icon={a.icon}
            loading={loading}
            onClick={() => doAction(a.label, a.nextStatus, !!a.danger)}
          >
            {a.label}
          </Button>
        ))}
      </Space>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function AgentLifecyclePage() {
  const { t } = useTranslation()
  const connState = useConnectionState()

  // Agents
  const [agents, setAgents] = useState<LifecycleAgent[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // Detail drawer
  const [detailAgent, setDetailAgent] = useState<LifecycleAgent | null>(null)
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false)

  // View mode
  const [viewMode, setViewMode] = useState<'cards' | 'tasks'>('cards')

  // Tasks
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [tasksLoading, setTasksLoading] = useState(false)
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null)
  const [transitions, setTransitions] = useState<Transition[]>([])
  const [transLoading, setTransLoading] = useState(false)
  const [taskSearch, setTaskSearch] = useState('')
  const [taskStatusFilter, setTaskStatusFilter] = useState<string>('all')

  // ── Data fetching ────────────────────────────────────────────────────────

  const fetchAgents = useCallback(async (skipSync = false) => {
    try {
      if (!skipSync && connState === 'connected') {
        try {
          setSyncing(true)
          const res = await gatewayClient.call('sessions.list', { limit: 200, activeMinutes: 1440 })
          const sessions = res?.sessions || (Array.isArray(res) ? res : [])
          if (sessions.length > 0) {
            await fetch('/api/agents/lifecycle/sync', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sessions }),
            })
          }
        } catch { /* sync failed, continue */ }
        finally { setSyncing(false) }
      }
      const [agentsRes] = await Promise.all([
        fetch('/api/agents/lifecycle').then(r => r.json()).catch(() => []),
      ])
      setAgents(Array.isArray(agentsRes) ? agentsRes : [])
    } catch { /* ignore */ }
    setLoading(false)
  }, [connState])

  const fetchTasks = useCallback(async () => {
    setTasksLoading(true)
    try {
      const res = await apiGet<{ items: TaskItem[] }>('/api/tasks')
      setTasks(res?.items || [])
    } catch { /* ignore */ }
    setTasksLoading(false)
  }, [])

  const fetchTransitions = useCallback(async (taskId: string) => {
    setTransLoading(true)
    try {
      const res = await apiGet<Transition[]>(`/api/workflow/tasks/${taskId}/transitions`)
      setTransitions(res || [])
    } catch { setTransitions([]) }
    setTransLoading(false)
  }, [])

  useEffect(() => { fetchAgents() }, [fetchAgents])
  useEffect(() => {
    const timer = setInterval(() => fetchAgents(true), 30000)
    return () => clearInterval(timer)
  }, [fetchAgents])

  const cleanupAgent = async (sessionKey: string) => {
    try {
      await fetch('/api/agents/lifecycle/cleanup', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_keys: [sessionKey] }),
      })
      message.success('Agent 已清理')
      setTimeout(() => fetchAgents(true), 500)
    } catch {
      message.error('清理失败')
    }
  }

  const openDetail = (agent: LifecycleAgent) => {
    setDetailAgent(agent)
    setDetailDrawerOpen(true)
  }

  // ── Computed ────────────────────────────────────────────────────────────

  const filteredAgents = useMemo(() => {
    return agents.filter(a => {
      const q = search.toLowerCase()
      const matchSearch = !q
        || (a.agent_label || '').toLowerCase().includes(q)
        || (a.agent_id || '').toLowerCase().includes(q)
        || a.session_key.toLowerCase().includes(q)
      const matchStatus = statusFilter === 'all' || a.status === statusFilter
      return matchSearch && matchStatus
    })
  }, [agents, search, statusFilter])

  const groupedAgents = useMemo(() => {
    const groups: Record<string, LifecycleAgent[]> = {}
    for (const g of TEAM_GROUPS) groups[g.key] = []
    for (const a of filteredAgents) {
      const label = (a.agent_label || '').toLowerCase()
      const matched = TEAM_GROUPS.find(g => g.roles.some(r => label.includes(r.toLowerCase())))
      const key = matched ? matched.key : 'other'
      groups[key].push(a)
    }
    return groups
  }, [filteredAgents])

  const statusCounts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const a of agents) m[a.status] = (m[a.status] || 0) + 1
    return m
  }, [agents])

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      const q = taskSearch.toLowerCase()
      const matchSearch = !q || t.title.toLowerCase().includes(q) || t.projectId.toLowerCase().includes(q)
      const matchStatus = taskStatusFilter === 'all' || t.status === taskStatusFilter
      return matchSearch && matchStatus
    })
  }, [tasks, taskSearch, taskStatusFilter])

  // ── Task columns ────────────────────────────────────────────────────────

  const taskColumns = [
    {
      title: '任务', dataIndex: 'title', key: 'title',
      render: (title: string, r: TaskItem) => (
        <Space>
          <span style={{ color: 'var(--primary)', cursor: 'pointer', fontWeight: 500 }}>
            {title}
          </span>
          {r.priority === 'high' && <Tag color="red" style={{ fontSize: 10 }}>高优</Tag>}
          {r.priority === 'medium' && <Tag color="orange" style={{ fontSize: 10 }}>中优</Tag>}
        </Space>
      ),
    },
    { title: '项目', dataIndex: 'projectId', key: 'project', width: 130 },
    { title: '负责人', dataIndex: 'ownerRole', key: 'owner', width: 110 },
    {
      title: '状态', dataIndex: 'status', key: 'status',
      render: (s: string) => {
        const m = TASK_STATUS_META[s] || { color: '#999', bg: '#f5f5f5' }
        return (
          <Tag style={{ backgroundColor: m.bg, color: m.color, border: 'none', fontSize: 11 }}>
            {m.label}
          </Tag>
        )
      },
    },
    {
      title: '更新时间', dataIndex: 'updatedAt', key: 'updated', width: 160,
      render: (v: string) => v ? new Date(v).toLocaleString() : '—',
    },
    {
      title: '操作', key: 'action', width: 80,
      render: (_: unknown, r: TaskItem) => (
        <Button size="small" type="link" onClick={() => { setSelectedTask(r); fetchTransitions(r.id) }}>
          管控
        </Button>
      ),
    },
  ]

  // ── Render ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div>
        <div className="page-header">
          <div className="page-eyebrow">{t('lifecycle.eyebrow')}</div>
          <h1 className="page-title">{t('lifecycle.title')}</h1>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
          <Spin size="large" />
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>

      {/* ── Page Header ── */}
      <div className="page-header">
        <div>
          <div className="page-eyebrow">{t('lifecycle.eyebrow')}</div>
          <h1 className="page-title">{t('lifecycle.title')}</h1>
          <p className="page-subtitle">{t('lifecycle.subtitle')}</p>
        </div>
        <Space>
          <Segmented
            value={viewMode}
            onChange={v => {
              setViewMode(v as 'cards' | 'tasks')
              if (v === 'tasks') fetchTasks()
            }}
            options={[
              { label: '🔗 Agent 管理', value: 'cards' },
              { label: '📋 任务流转', value: 'tasks' },
            ]}
          />
          <Button icon={<SyncOutlined />} loading={syncing} onClick={() => fetchAgents(false)}>
            同步
          </Button>
        </Space>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* Agent Cards View                                                   */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {viewMode === 'cards' && (
        <>
          {/* Status Summary */}
          <Row gutter={[12, 12]}>
            {Object.entries(STATUS_META).map(([status, meta]) => (
              <Col xs={8} sm={4} md={3} key={status}>
                <Card
                  size="small"
                  style={{ borderLeft: `3px solid ${meta.color}`, cursor: 'pointer', borderRadius: 8 }}
                  styles={{ body: { padding: '10px 12px' } }}
                  onClick={() => setStatusFilter(statusFilter === status ? 'all' : status)}
                >
                  <Statistic
                    title={<span style={{ fontSize: 11, color: '#999' }}>{meta.label}</span>}
                    value={statusCounts[status] || 0}
                    valueStyle={{ fontSize: 20, fontWeight: 700, color: meta.color }}
                  />
                </Card>
              </Col>
            ))}
          </Row>

          {/* Search + Filter */}
          <Card size="small" styles={{ body: { padding: '8px 12px' } }}>
            <Space wrap>
              <Input.Search
                placeholder="搜索 Agent 名称 / session key..."
                value={search} onChange={e => setSearch(e.target.value)}
                style={{ width: 280 }} allowClear
              />
              <Select
                value={statusFilter} onChange={setStatusFilter}
                style={{ width: 120 }}
                options={[
                  { value: 'all', label: '全部状态' },
                  ...Object.entries(STATUS_META).map(([k, v]) => ({ value: k, label: v.label })),
                ]}
              />
              {(search || statusFilter !== 'all') && (
                <Button size="small" onClick={() => { setSearch(''); setStatusFilter('all') }}>
                  清除筛选 ({filteredAgents.length}/{agents.length})
                </Button>
              )}
            </Space>
          </Card>

          {/* Grouped Cards */}
          {filteredAgents.length === 0 ? (
            <Empty description="没有找到匹配的 Agent" />
          ) : (
            TEAM_GROUPS.map(group => {
              const items = groupedAgents[group.key]
              if (items.length === 0) return null
              return (
                <div key={group.key}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    {group.icon}
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{group.label}</span>
                    <Badge count={items.length} style={{ backgroundColor: '#1890ff' }} />
                  </div>
                  <Row gutter={[10, 10]}>
                    {items.map(agent => (
                      <Col xs={24} sm={12} md={8} lg={6} key={agent.session_key}>
                        <AgentCard
                          agent={agent}
                          onDetail={openDetail}
                          onCleanup={cleanupAgent}
                          syncing={syncing}
                        />
                      </Col>
                    ))}
                  </Row>
                </div>
              )
            })
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* Task Flow View                                                     */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {viewMode === 'tasks' && (
        <>
          {/* Task Filter Bar */}
          <Card size="small" styles={{ body: { padding: '8px 12px' } }}>
            <Space wrap>
              <Input.Search
                placeholder="搜索任务标题..."
                value={taskSearch} onChange={e => setTaskSearch(e.target.value)}
                style={{ width: 240 }} allowClear
                loading={tasksLoading}
              />
              <Select
                value={taskStatusFilter} onChange={setTaskStatusFilter}
                style={{ width: 130 }}
                options={[
                  { value: 'all', label: '全部状态' },
                  ...Object.entries(TASK_STATUS_META).map(([k, v]) => ({ value: k, label: v.label })),
                ]}
              />
              <Button size="small" icon={<ReloadOutlined />} onClick={fetchTasks}>刷新</Button>
            </Space>
          </Card>

          <Row gutter={16}>
            {/* Task List */}
            <Col xs={24} lg={selectedTask ? 12 : 24}>
              <Card
                title="📋 任务列表"
                extra={<Text type="secondary">{filteredTasks.length} 个任务</Text>}
                size="small"
              >
                <Table
                  dataSource={filteredTasks}
                  columns={taskColumns}
                  rowKey="id"
                  size="small"
                  loading={tasksLoading}
                  pagination={{ pageSize: 15, showSizeChanger: true }}
                  rowClassName={(r) => selectedTask?.id === r.id ? 'ant-table-row-selected' : ''}
                  onRow={r => ({
                    onClick: () => { setSelectedTask(r); fetchTransitions(r.id) },
                    style: { cursor: 'pointer' },
                  })}
                />
              </Card>
            </Col>

            {/* Task Control Panel */}
            {selectedTask && (
              <Col xs={24} lg={12}>
                <Card
                  title={
                    <Space>
                      <span>🎛️ 任务管控</span>
                      <Tag>{selectedTask.title}</Tag>
                    </Space>
                  }
                  size="small"
                  extra={<Button size="small" onClick={() => setSelectedTask(null)}>关闭</Button>}
                >
                  {/* Info */}
                  <Descriptions column={2} size="small" style={{ marginBottom: 16 }}>
                    <Descriptions.Item label="项目">{selectedTask.projectId}</Descriptions.Item>
                    <Descriptions.Item label="负责人">{selectedTask.ownerRole}</Descriptions.Item>
                    <Descriptions.Item label="优先级">
                      <Tag color={selectedTask.priority === 'high' ? 'red' : selectedTask.priority === 'medium' ? 'orange' : 'default'}>
                        {selectedTask.priority}
                      </Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="状态">
                      {(() => {
                        const m = TASK_STATUS_META[selectedTask.status] || { color: '#999', bg: '#f5f5f5' }
                        return (
                          <Tag style={{ backgroundColor: m.bg, color: m.color, border: 'none' }}>
                            {m.label}
                          </Tag>
                        )
                      })()}
                    </Descriptions.Item>
                  </Descriptions>

                  <Divider style={{ margin: '12px 0' }} />

                  {/* Flow Steps */}
                  <TaskFlowSteps task={selectedTask} />

                  {/* Transitions Timeline */}
                  {transLoading ? (
                    <Spin size="small" style={{ marginTop: 16 }} />
                  ) : (
                    <TaskTimeline transitions={transitions} />
                  )}

                  {/* Control Actions */}
                  <TaskControlPanel
                    task={selectedTask}
                    onRefresh={() => { fetchTasks(); fetchTransitions(selectedTask.id) }}
                  />
                </Card>
              </Col>
            )}
          </Row>
        </>
      )}

      {/* Agent Detail Drawer */}
      <AgentDetailDrawer
        agent={detailAgent}
        open={detailDrawerOpen}
        onClose={() => setDetailDrawerOpen(false)}
      />

    </div>
  )
}