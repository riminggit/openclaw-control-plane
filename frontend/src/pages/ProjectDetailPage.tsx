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

  if (loading) return <p className="loading">{t('app.loading')}</p>
  if (error) return <p style={{ color: '#ff6b6b' }}>Error: {error}</p>
  if (!project) return null

  return (
    <div>
      <a href="/projects" className="back-link">{t('app.back')}</a>
      <div className="hero">
        <div className="eyebrow">{t('projects.eyebrow')}</div>
        <h1>{project.code} — {project.name}</h1>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <h2>{t('projects.detail.info')}</h2>
        <div className="detail-grid">
          <div><span className="detail-label">{t('projects.status')}</span> <span className={`badge badge-${project.status}`}>{project.status}</span></div>
          <div><span className="detail-label">{t('projects.owner')}</span> {project.ownerRole || '-'}</div>
          <div><span className="detail-label">{t('projects.tasks')}</span> {project.taskCount}</div>
          <div><span className="detail-label">{t('projects.blocked')}</span> <span style={{ color: project.blockedTaskCount > 0 ? '#ff6b6b' : 'inherit' }}>{project.blockedTaskCount}</span></div>
          <div><span className="detail-label">{t('app.updated')}</span> {new Date(project.updatedAt).toLocaleString()}</div>
        </div>
      </div>

      <div className="card">
        <h2>{t('projects.detail.tasks_list')}</h2>
        {tasks.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>{t('projects.detail.no_tasks')}</p>
        ) : (
          <table className="task-table">
            <thead>
              <tr><th>{t('tasks.title_col')}</th><th>{t('tasks.status')}</th><th>{t('tasks.priority')}</th><th>{t('tasks.owner')}</th><th>{t('app.updated')}</th></tr>
            </thead>
            <tbody>
              {tasks.map(t => (
                <tr key={t.id}>
                  <td><a href={`/tasks/${t.id}`} className="link">{t.title}</a></td>
                  <td><span className={`badge badge-${t.status}`}>{t.status.replace('_', ' ')}</span></td>
                  <td><span className={`badge badge-priority-${t.priority}`}>{t.priority}</span></td>
                  <td>{t.ownerRole || '-'}</td>
                  <td>{new Date(t.updatedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
