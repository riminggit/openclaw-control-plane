import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { projectsApi, type ProjectItem } from '../api/modules/projects'
import { useTranslation } from 'react-i18next'

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const projectId = id!
  const { t } = useTranslation()
  const [project, setProject] = useState<ProjectItem | null>(null)
  const [tasks, setTasks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      try {
        const [p, tRes] = await Promise.all([
          projectsApi.get(projectId),
          fetch('/api/tasks?project_id=' + projectId).then(r => r.json()),
        ])
        setProject(p)
        setTasks(tRes.items || [])
      } catch (e: any) { setError(e.message) }
      finally { setLoading(false) }
    })()
  }, [projectId])

  if (loading) {
    return (
      <div>
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <div className="skeleton" style={{ width: 80, height: 12, marginBottom: 8 }} />
          <div className="skeleton" style={{ width: 300, height: 28 }} />
        </div>
        <div className="card">
          <div className="card-body">
            <div className="skeleton" style={{ width: '40%', height: 20, marginBottom: 16 }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-4)' }}>
              {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 60, borderRadius: 'var(--radius-lg)' }} />)}
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

  if (!project) return null

  return (
    <div>
      <div className="breadcrumb" style={{ marginBottom: 'var(--space-4)' }}>
        <Link to="/projects">{t('nav.projects')}</Link>
        <span className="breadcrumb-sep">/</span>
        <span className="breadcrumb-current">{project.code}</span>
      </div>

      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{project.name}</h1>
          <span className={`badge badge-${project.status}`}>{project.status}</span>
        </div>
        <p className="page-header-desc" style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 'var(--space-2)' }}>
          {project.code}
        </p>
      </div>

      <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
        <div className="card-header">
          <h2>{t('projects.detail.info')}</h2>
        </div>
        <div className="card-body">
          <div className="detail-grid">
            <div>
              <span className="detail-label">{t('projects.tasks')}</span>
              <span style={{ fontSize: 'var(--text-lg)', fontWeight: 600 }}>{project.taskCount}</span>
            </div>
            <div>
              <span className="detail-label">{t('projects.blocked')}</span>
              <span style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: project.blockedTaskCount > 0 ? 'var(--status-red)' : undefined }}>{project.blockedTaskCount}</span>
            </div>
            <div>
              <span className="detail-label">{t('projects.owner')}</span>
              <span style={{ color: 'var(--text-secondary)' }}>{project.ownerRole || '—'}</span>
            </div>
            <div>
              <span className="detail-label">{t('app.updated')}</span>
              <span style={{ color: 'var(--text-secondary)' }}>{new Date(project.updatedAt).toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>{t('projects.detail.tasks_list')}</h2>
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>{t('app.total', { count: tasks.length })}</span>
        </div>
        {tasks.length === 0 ? (
          <div className="card-body">
            <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
              <div className="empty-state-icon" style={{ fontSize: 32 }}>📋</div>
              <div className="empty-state-desc">{t('projects.detail.no_tasks')}</div>
            </div>
          </div>
        ) : (
          <div className="table-wrapper" style={{ borderRadius: 0, border: 'none' }}>
            <table className="data-table">
              <thead>
                <tr><th>{t('tasks.title_col')}</th><th>{t('tasks.status')}</th><th>{t('tasks.priority')}</th><th>{t('tasks.owner')}</th><th>{t('app.updated')}</th></tr>
              </thead>
              <tbody>
                {tasks.map(task => (
                  <tr key={task.id}>
                    <td><Link to={`/tasks/${task.id}`} style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{task.title}</Link></td>
                    <td><span className={`badge badge-${task.status}`}>{task.status.replace('_', ' ')}</span></td>
                    <td><span className={`badge badge-priority-${task.priority}`}>{task.priority}</span></td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>{task.ownerRole || '—'}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>{new Date(task.updatedAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
