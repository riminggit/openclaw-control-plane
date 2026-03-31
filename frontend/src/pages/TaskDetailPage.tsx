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

  useEffect(() => {
    if (!id) return
    (async () => {
      try {
        const res = await tasksApi.get(id)
        setTask(res)
      } catch (e: any) { setError(e.message) }
      finally { setLoading(false) }
    })()
  }, [id])

  if (loading) {
    return (
      <div>
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <div className="skeleton" style={{ width: 80, height: 12, marginBottom: 8 }} />
          <div className="skeleton" style={{ width: 350, height: 28, marginBottom: 8 }} />
          <div className="skeleton" style={{ width: 200, height: 20 }} />
        </div>
        <div className="card">
          <div className="card-body">
            <div className="skeleton skeleton-heading" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3)', marginTop: 16 }}>
              {[1,2,3,4,5,6].map(i => <div key={i} className="skeleton" style={{ height: 40, borderRadius: 'var(--radius-md)' }} />)}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) return (
    <div className="card">
      <div className="empty-state">
        <div className="empty-state-icon">⚠️</div>
        <div className="empty-state-title">Error</div>
        <div className="empty-state-desc">{error}</div>
      </div>
    </div>
  )

  if (!task) return null

  const handleDelete = async () => {
    if (!confirm(t('app.confirm_delete_task'))) return
    try { await tasksApi.delete(task.id); navigate('/tasks') } catch (e: any) { setError(e.message) }
  }

  return (
    <div>
      <div className="breadcrumb" style={{ marginBottom: 'var(--space-4)' }}>
        <Link to="/tasks">{t('nav.tasks')}</Link>
        <span className="breadcrumb-sep">/</span>
        <span className="breadcrumb-current">#{task.id.slice(0, 8)}</span>
      </div>

      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--text-primary)', margin: 0, flex: 1 }}>{task.title}</h1>
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', alignItems: 'center' }}>
            <span className={`badge badge-${task.status}`}>{task.status.replace('_', ' ')}</span>
            <span className={`badge badge-priority-${task.priority}`}>{task.priority}</span>
            <button className="btn btn-danger" style={{ marginLeft: 'auto' }} onClick={handleDelete}>🗑 {t('app.delete')}</button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
        <div className="card-header" style={{ gap: 'var(--space-1)', padding: 0 }}>
          {(['info', 'history'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                background: 'none',
                border: 'none',
                padding: 'var(--space-3) var(--space-4)',
                cursor: 'pointer',
                fontSize: 'var(--text-sm)',
                fontWeight: activeTab === tab ? 600 : 450,
                color: activeTab === tab ? 'var(--accent)' : 'var(--text-secondary)',
                borderBottom: activeTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
                borderRadius: 0,
                transition: 'all var(--transition-fast)',
              }}
            >
              {tab === 'info' ? t('tasks.detail.info') : t('tasks.detail.status_history')}
            </button>
          ))}
        </div>

        {activeTab === 'info' && (
          <div className="card-body">
            <div className="detail-grid">
              <div>
                <span className="detail-label">{t('tasks.project')}</span>
                <Link to={`/projects/${task.projectId}`} style={{ color: 'var(--accent)', fontSize: 'var(--text-sm)' }}>{task.projectId}</Link>
              </div>
              <div>
                <span className="detail-label">{t('tasks.detail.category')}</span>
                <span className="badge" style={{ fontSize: 'var(--text-xs)', background: 'var(--bg-surface-hover)', color: 'var(--text-secondary)' }}>{task.category}</span>
              </div>
              <div>
                <span className="detail-label">{t('tasks.detail.phase')}</span>
                <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>{task.phase || '—'}</span>
              </div>
              <div>
                <span className="detail-label">{t('tasks.owner')}</span>
                <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>{task.ownerRole || '—'}</span>
              </div>
              <div>
                <span className="detail-label">{t('tasks.detail.risk')}</span>
                <span className={`badge badge-priority-${task.riskLevel}`} style={{ fontSize: 'var(--text-xs)' }}>{task.riskLevel}</span>
              </div>
              <div>
                <span className="detail-label">{t('tasks.detail.doc_sync_risk')}</span>
                <span className={`badge badge-priority-${task.docSyncRisk}`} style={{ fontSize: 'var(--text-xs)' }}>{task.docSyncRisk}</span>
              </div>
              <div>
                <span className="detail-label">{t('app.updated')}</span>
                <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>{new Date(task.updatedAt).toLocaleString()}</span>
              </div>
            </div>

            {task.description && (
              <div style={{ marginTop: 'var(--space-6)' }}>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'var(--space-2)' }}>{t('tasks.detail.description')}</div>
                <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', lineHeight: 1.6 }}>{task.description}</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="card-body">
            <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
              <div className="empty-state-icon">📜</div>
              <div className="empty-state-desc">{t('tasks.detail.no_history')}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
