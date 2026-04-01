import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { tasksApi } from '../api/modules/tasks'
import { useTranslation } from 'react-i18next'
import { Button, Tabs, Card, Empty, Spin, Popconfirm, Tag, Timeline, Descriptions } from 'antd'
import { AgentThoughtPanel } from '../components/AgentThoughtPanel'
import { TaskProgressPanel } from '../components/TaskProgressPanel'
import { apiGet } from '../api/client'

const priorityColors: Record<string, string> = { high: 'red', medium: 'orange', low: 'green' }
const statusColors: Record<string, string> = {
  planned: 'default', approved: 'processing', dispatched: 'processing',
  in_progress: 'processing', review: 'warning', blocked: 'error',
  stopped: 'default', done: 'success', cancelled: 'default', rejected: 'error',
}

interface Transition {
  id: string; from: string; to: string; actor: string; reason: string; created_at: string
}

export function TaskDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [task, setTask] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<string>('info')
  const [transitions, setTransitions] = useState<Transition[]>([])
  const [transLoading, setTransLoading] = useState(false)

  const fetchTask = async () => {
    if (!id) return
    try {
      const res = await tasksApi.get(id)
      setTask(res)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  const fetchTransitions = async () => {
    if (!id) return
    setTransLoading(true)
    try {
      const res = await apiGet<{ task_id: string; current_status: string; transitions: Transition[] }>(
        `/workflow/tasks/${id}/transitions`
      )
      setTransitions(res.transitions || [])
    } catch { setTransitions([]) }
    finally { setTransLoading(false) }
  }

  useEffect(() => { fetchTask() }, [id])
  useEffect(() => { if (id) fetchTransitions() }, [id])

  const handleAction = async (action: string) => {
    if (!task) return
    try {
      await tasksApi.action(task.id, action)
      fetchTask()
      fetchTransitions()
    } catch (e: any) { setError(e.message) }
  }

  const handleDelete = async () => {
    if (!confirm(t('app.confirm_delete_task'))) return
    try { await tasksApi.delete(task!.id); navigate('/tasks') } catch (e: any) { setError(e.message) }
  }

  if (loading) return <div className="loading">{t('app.loading')}</div>
  if (error) return <div className="card"><div className="empty-state"><div className="empty-icon">⚠️</div><div className="empty-state-title">{t('app.error')}</div><p>{error}</p></div></div>
  if (!task) return null

  const actions: { key: string; label: string; style: string; show: boolean }[] = [
    { key: 'start', label: t('task_action.start'), style: 'btn btn-primary', show: task.status === 'planned' },
    { key: 'review', label: t('task_action.review'), style: 'btn btn-secondary', show: task.status === 'in_progress' },
    { key: 'complete', label: t('task_action.complete'), style: 'btn btn-primary', show: ['in_progress', 'review'].includes(task.status) },
    { key: 'reject', label: t('task_action.reject'), style: 'btn btn-danger', show: ['review', 'in_progress', 'done'].includes(task.status) },
    { key: 'restart', label: t('task_action.restart'), style: 'btn btn-secondary', show: task.status === 'done' || task.status === 'blocked' },
    { key: 'block', label: t('task_action.block'), style: 'btn btn-danger', show: ['planned', 'in_progress'].includes(task.status) },
  ]
  const visibleActions = actions.filter(a => a.show)

  const tabItems = [
    { key: 'info', label: t('tasks.detail.info', '基本信息') },
    { key: 'progress', label: t('tasks.detail.progress', '进度') },
    { key: 'thoughts', label: t('tasks.detail.thoughts', '思考链路') },
    { key: 'history', label: t('tasks.detail.status_history', '状态历史') },
  ]

  return (
    <div>
      <div className="detail-header">
        <Link to="/tasks" className="back-link">{t('app.back')}</Link>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)', flexWrap: 'wrap', flex: 1 }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>{task.title}</h1>
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', alignItems: 'center' }}>
            <Tag color={statusColors[task.status] || 'default'}>{String(t(`status.${task.status}`, task.status))}</Tag>
            <Tag color={priorityColors[task.priority] || 'default'}>{String(t(`priority.${task.priority}`, task.priority))}</Tag>
            {task.category && <Tag>{task.category}</Tag>}
            {task.phase && <Tag color="blue">{task.phase}</Tag>}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      {visibleActions.length > 0 && (
        <div className="card" style={{ marginBottom: 'var(--space-4)', display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginRight: 'var(--space-2)' }}>{t('task_action.label')}：</span>
          {visibleActions.map(a => (
            <Button key={a.key} className={a.style} onClick={() => handleAction(a.key)}>{a.label}</Button>
          ))}
          <div style={{ flex: 1 }} />
          <Button danger onClick={handleDelete}>🗑 {t('app.delete')}</Button>
        </div>
      )}

      {/* Tabs */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems.map(tab => ({ key: tab.key, label: tab.label }))}
        style={{ marginBottom: 'var(--space-4)' }}
      />

      {/* Info Tab */}
      {activeTab === 'info' && (
        <>
          <Card title={t('tasks.detail.description', '描述')} style={{ marginBottom: 16 }}>
            {task.description ? (
              <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{task.description}</div>
            ) : (
              <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('tasks.detail.no_description')}</span>
            )}
          </Card>

          <Card title={t('tasks.detail.basic_info')} style={{ marginBottom: 16 }}>
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label={t('tasks.project')}>{task.projectCode} — {task.projectName || task.projectId?.slice(0, 8)}</Descriptions.Item>
              <Descriptions.Item label={t('tasks.detail.category')}>{task.category || '—'}</Descriptions.Item>
              <Descriptions.Item label={t('tasks.detail.phase')}>{task.phase || '—'}</Descriptions.Item>
              <Descriptions.Item label={t('tasks.owner')}>{task.ownerRole || '—'}</Descriptions.Item>
              <Descriptions.Item label={t('tasks.detail.target_agent')}>{task.ownerAgentId || '—'}</Descriptions.Item>
              <Descriptions.Item label={t('tasks.detail.risk')}>{task.riskLevel || '—'}</Descriptions.Item>
              <Descriptions.Item label={t('tasks.detail.review_gate')}>{task.reviewGateStatus || '—'}</Descriptions.Item>
              <Descriptions.Item label={t('app.created')}>{task.createdAt ? new Date(task.createdAt).toLocaleString() : '—'}</Descriptions.Item>
              <Descriptions.Item label={t('app.updated')}>{new Date(task.updatedAt).toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label={t('tasks.detail.source')}>{task.sourceChannel || '—'}</Descriptions.Item>
            </Descriptions>
          </Card>

          {/* Review Gate Section */}
          {transitions.some(tr => tr.from === 'in_progress' && tr.to === 'review') && (
            <Card title={t('tasks.detail.review_records')} style={{ marginBottom: 16 }}>
              <Timeline
                items={transitions
                  .filter(tr => ['review', 'approved', 'rejected'].includes(tr.to))
                  .map(tr => ({
                    color: tr.to === 'approved' ? 'green' : tr.to === 'rejected' ? 'red' : 'blue',
                    children: (
                      <div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <Tag color={tr.to === 'approved' ? 'green' : tr.to === 'rejected' ? 'red' : 'blue'}>
                            {tr.to}
                          </Tag>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            {tr.actor} · {tr.created_at ? new Date(tr.created_at).toLocaleString() : ''}
                          </span>
                        </div>
                        {tr.reason && <div style={{ fontSize: 13, marginTop: 4 }}>{tr.reason}</div>}
                      </div>
                    ),
                  }))}
              />
            </Card>
          )}

          {/* Dispatch Info */}
          {task.ownerAgentId && (
            <Card title={t('tasks.detail.dispatch_info')} style={{ marginBottom: 16 }}>
              <Descriptions column={2} size="small" bordered>
                <Descriptions.Item label={t('tasks.detail.target_agent')}>{task.ownerAgentId}</Descriptions.Item>
                <Descriptions.Item label={t('tasks.detail.dispatch_mode')}>{task.assigneeSessionKey ? 'sessions_spawn' : 'direct'}</Descriptions.Item>
                <Descriptions.Item label={t('tasks.detail.last_dispatch')}>{task.lastDispatchAt ? new Date(task.lastDispatchAt).toLocaleString() : '—'}</Descriptions.Item>
              </Descriptions>
            </Card>
          )}
        </>
      )}

      {/* Progress Tab */}
      {activeTab === 'progress' && (
        <Card title={t('tasks.detail.progress')}>
          <TaskProgressPanel taskId={id!} />
        </Card>
      )}

      {/* Thoughts Tab */}
      {activeTab === 'thoughts' && (
        <Card title={t('tasks.detail.thoughts')}>
          <AgentThoughtPanel taskId={id!} />
        </Card>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <Card title={t('tasks.detail.status_history')}>
          {transLoading ? <Spin style={{ display: 'block', margin: '20px auto' }} /> :
            transitions.length === 0 ? (
              <Empty description={t('tasks.detail.no_history')} style={{ padding: 24 }} />
            ) : (
              <Timeline
                items={transitions.map(tr => ({
                  color: tr.to === 'done' ? 'green' : tr.to === 'blocked' || tr.to === 'cancelled' || tr.to === 'rejected' ? 'red' : 'blue',
                  children: (
                    <div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                        <Tag>{tr.from}</Tag>
                        <span>→</span>
                        <Tag color={statusColors[tr.to] || 'default'}>{tr.to}</Tag>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {tr.actor} · {tr.created_at ? new Date(tr.created_at).toLocaleString() : ''}
                      </div>
                      {tr.reason && <div style={{ fontSize: 13, marginTop: 4, color: 'var(--text-secondary)' }}>{tr.reason}</div>}
                    </div>
                  ),
                }))}
              />
            )}
        </Card>
      )}
    </div>
  )
}
