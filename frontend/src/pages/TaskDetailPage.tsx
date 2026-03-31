import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { tasksApi } from '../api/modules/tasks'
import { useTranslation } from 'react-i18next'

export function TaskDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [task, setTask] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'info' | 'history'>('info')

  const fetchTask = async () => {
    if (!id) return
    try {
      const res = await tasksApi.get(id)
      setTask(res)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchTask() }, [id])

  const handleAction = async (action: string) => {
    if (!task) return
    try {
      await tasksApi.action(task.id, action)
      fetchTask()
    } catch (e: any) { setError(e.message) }
  }

  const handleDelete = async () => {
    if (!confirm(t('app.confirm_delete_task'))) return
    try { await tasksApi.delete(task!.id); navigate('/tasks') } catch (e: any) { setError(e.message) }
  }

  if (loading) return <div className="loading">{t('app.loading')}</div>
  if (error) return <div className="card"><div className="empty-state"><div className="empty-icon">⚠️</div><div className="empty-state-title">{t('app.error')}</div><p>{error}</p></div></div>
  if (!task) return null

  // Determine available actions based on current status
  const actions: { key: string; label: string; style: string; show: boolean }[] = [
    { key: 'start', label: t('task_action.start'), style: 'btn btn-primary', show: task.status === 'planned' },
    { key: 'review', label: t('task_action.review'), style: 'btn btn-secondary', show: task.status === 'in_progress' },
    { key: 'complete', label: t('task_action.complete'), style: 'btn btn-primary', show: ['in_progress', 'review'].includes(task.status) },
    { key: 'reject', label: t('task_action.reject'), style: 'btn btn-danger', show: ['review', 'in_progress', 'done'].includes(task.status) },
    { key: 'restart', label: t('task_action.restart'), style: 'btn btn-secondary', show: task.status === 'done' || task.status === 'blocked' },
    { key: 'block', label: t('task_action.block'), style: 'btn btn-danger', show: ['planned', 'in_progress'].includes(task.status) },
  ]
  const visibleActions = actions.filter(a => a.show)

  return (
    <div>
      <div className="detail-header">
        <Link to="/tasks" className="back-link">{t('app.back')}</Link>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)', flexWrap: 'wrap', flex: 1 }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>{task.title}</h1>
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', alignItems: 'center' }}>
            <span className={`badge badge-${task.status}`}>{String(t(`status.${task.status}`, task.status))}</span>
            <span className={`badge badge-${task.priority}`}>{String(t(`priority.${task.priority}`, task.priority))}</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      {visibleActions.length > 0 && (
        <div className="card" style={{ marginBottom: 'var(--space-4)', display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginRight: 'var(--space-2)' }}>{t('task_action.label')}：</span>
          {visibleActions.map(a => (
            <button key={a.key} className={a.style} onClick={() => handleAction(a.key)}>{a.label}</button>
          ))}
          <div style={{ flex: 1 }} />
          <button className="btn btn-danger" onClick={handleDelete}>🗑 {t('app.delete')}</button>
        </div>
      )}

      {/* Tabs */}
      <div className="tabs">
        {(['info', 'history'] as const).map(tab => (
          <button key={tab} className={`tab ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>
            {tab === 'info' ? t('tasks.detail.info') : t('tasks.detail.status_history')}
          </button>
        ))}
      </div>

      {activeTab === 'info' && (
        <div className="card">
          {/* Description */}
          <div style={{ marginBottom: 'var(--space-6)' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: 'var(--space-2)', color: 'var(--text-secondary)' }}>{t('tasks.detail.description')}</h3>
            {task.description ? (
              <div style={{ background: 'var(--bg-secondary)', padding: 'var(--space-4)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                {task.description}
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('tasks.detail.no_description')}</p>
            )}
          </div>

          {/* Metadata Grid */}
          <div className="detail-meta">
            <div className="detail-meta-item">
              <div className="label">{t('tasks.project')}</div>
              <div className="value">
                {task.projectName ? (
                  <Link to={`/projects/${task.projectId}`} className="link">{task.projectCode} — {task.projectName}</Link>
                ) : (
                  <span className="mono">{task.projectId?.slice(0, 8)}</span>
                )}
              </div>
            </div>
            <div className="detail-meta-item">
              <div className="label">{t('tasks.detail.category')}</div>
              <div className="value">{task.category || '—'}</div>
            </div>
            <div className="detail-meta-item">
              <div className="label">{t('tasks.detail.phase')}</div>
              <div className="value">{task.phase || '—'}</div>
            </div>
            <div className="detail-meta-item">
              <div className="label">{t('tasks.owner')}</div>
              <div className="value">{task.ownerRole || '—'}</div>
            </div>
            <div className="detail-meta-item">
              <div className="label">{t('tasks.status')}</div>
              <div className="value"><span className={`badge badge-${task.status}`}>{String(t(`status.${task.status}`, task.status))}</span></div>
            </div>
            <div className="detail-meta-item">
              <div className="label">{t('tasks.priority')}</div>
              <div className="value"><span className={`badge badge-${task.priority}`}>{String(t(`priority.${task.priority}`, task.priority))}</span></div>
            </div>
            <div className="detail-meta-item">
              <div className="label">{t('tasks.detail.risk')}</div>
              <div className="value">{task.riskLevel || '—'}</div>
            </div>
            <div className="detail-meta-item">
              <div className="label">{t('app.created')}</div>
              <div className="value">{task.createdAt ? new Date(task.createdAt).toLocaleString() : '—'}</div>
            </div>
            <div className="detail-meta-item">
              <div className="label">{t('app.updated')}</div>
              <div className="value">{new Date(task.updatedAt).toLocaleString()}</div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">📜</div>
            <p style={{ color: 'var(--text-muted)' }}>{t('tasks.detail.no_history')}</p>
          </div>
        </div>
      )}
    </div>
  )
}
