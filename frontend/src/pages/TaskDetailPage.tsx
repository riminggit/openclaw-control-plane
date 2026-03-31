import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { tasksApi } from '../api/modules/tasks'
import { useTranslation } from 'react-i18next'

export function TaskDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { t } = useTranslation()
  const [task, setTask] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  if (loading) return <p className="loading">{t('app.loading')}</p>
  if (error) return <p style={{ color: '#ff6b6b' }}>Error: {error}</p>
  if (!task) return null

  return (
    <div>
      <a href="/tasks" className="back-link">{t('app.back')}</a>
      <div className="hero">
        <div className="eyebrow">{t('tasks.eyebrow')}</div>
        <h1>{task.title}</h1>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <h2>{t('tasks.detail.info')}</h2>
        <div className="detail-grid">
          <div><span className="detail-label">{t('tasks.project')}</span> <Link to={`/projects/${task.projectId}`} className="link">{task.projectId}</Link></div>
          <div><span className="detail-label">{t('tasks.status')}</span> <span className={`badge badge-${task.status}`}>{task.status.replace('_', ' ')}</span></div>
          <div><span className="detail-label">{t('tasks.priority')}</span> <span className={`badge badge-priority-${task.priority}`}>{task.priority}</span></div>
          <div><span className="detail-label">{t('tasks.detail.category')}</span> {task.category}</div>
          <div><span className="detail-label">{t('tasks.detail.phase')}</span> {task.phase || '-'}</div>
          <div><span className="detail-label">{t('tasks.owner')}</span> {task.ownerRole || '-'}</div>
          <div><span className="detail-label">{t('tasks.detail.risk')}</span> <span className={`badge badge-priority-${task.riskLevel}`}>{task.riskLevel}</span></div>
          <div><span className="detail-label">{t('tasks.detail.doc_sync_risk')}</span> <span className={`badge badge-priority-${task.docSyncRisk}`}>{task.docSyncRisk}</span></div>
          <div><span className="detail-label">{t('app.updated')}</span> {new Date(task.updatedAt).toLocaleString()}</div>
        </div>
      </div>

      <div className="card">
        <h2>{t('tasks.detail.status_history')}</h2>
        <p style={{ color: 'var(--text-muted)' }}>{t('tasks.detail.no_history')}</p>
      </div>
    </div>
  )
}
