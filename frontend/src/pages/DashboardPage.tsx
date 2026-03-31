import { useEffect, useState, useCallback } from 'react'
import { projectsApi, type ProjectItem } from '../api/modules/projects'
import { tasksApi, type TaskItem } from '../api/modules/tasks'
import { useTranslation } from 'react-i18next'

export function DashboardPage() {
  const { t } = useTranslation()
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [projectRes, taskRes] = await Promise.all([projectsApi.list(), tasksApi.list()])
      setData({ projects: projectRes.items, tasks: taskRes.items })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load data')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading) return <div className="loading">{t('app.loading')}</div>
  if (error) return <div className="error-card"><h2>⚠</h2><p>{error}</p><button onClick={fetchData}>{t('app.retry')}</button></div>
  if (!data) return null

  const { projects, tasks } = data
  const blocked = tasks.filter((t: TaskItem) => t.status === 'blocked').length
  const inProgress = tasks.filter((t: TaskItem) => t.status === 'in_progress').length

  return (
    <div>
      <section className="hero">
        <div>
          <p className="eyebrow">{t('dashboard.eyebrow')}</p>
          <h1>{t('dashboard.title')}</h1>
          <p className="subtext">{t('dashboard.subtitle')}</p>
        </div>
      </section>

      <section className="grid">
        <article className="card stat-card">
          <div className="label">{t('dashboard.projects')}</div>
          <div className="value">{projects.length}</div>
        </article>
        <article className="card stat-card">
          <div className="label">{t('dashboard.tasks_count')}</div>
          <div className="value">{tasks.length}</div>
        </article>
        <article className="card stat-card">
          <div className="label">{t('dashboard.blocked')}</div>
          <div className="value" style={{ color: blocked > 0 ? '#ff6b6b' : 'var(--text-muted)' }}>{blocked}</div>
        </article>
        <article className="card stat-card">
          <div className="label">{t('dashboard.in_progress')}</div>
          <div className="value" style={{ color: '#6bdfff' }}>{inProgress}</div>
        </article>
      </section>

      <section className="grid two-columns">
        <article className="card">
          <h2>{t('dashboard.project_list')}</h2>
          {projects.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>{t('dashboard.no_projects')}</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr><th>{t('projects.code')}</th><th>{t('projects.name')}</th><th>{t('projects.status')}</th><th>{t('projects.tasks')}</th><th>{t('projects.blocked')}</th></tr>
              </thead>
              <tbody>
                {projects.map((p: ProjectItem) => (
                  <tr key={p.id}>
                    <td className="mono"><a href={`/projects/${p.id}`} className="link">{p.code}</a></td>
                    <td>{p.name}</td>
                    <td><span className={`badge badge-${p.status}`}>{p.status}</span></td>
                    <td>{p.taskCount}</td>
                    <td>{p.blockedTaskCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </article>

        <article className="card">
          <h2>{t('dashboard.recent_tasks')}</h2>
          {tasks.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>{t('dashboard.no_tasks')}</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr><th>{t('tasks.detail.category')}</th><th>{t('tasks.title_col')}</th><th>{t('tasks.status')}</th><th>{t('tasks.priority')}</th></tr>
              </thead>
              <tbody>
                {tasks.slice(0, 10).map((task: TaskItem) => (
                  <tr key={task.id}>
                    <td><span className="badge">{task.category}</span></td>
                    <td><a href={`/tasks/${task.id}`} className="link task-title">{task.title}</a></td>
                    <td><span className={`badge badge-${task.status}`}>{task.status.replace('_', ' ')}</span></td>
                    <td><span className={`badge badge-priority-${task.priority}`}>{task.priority}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </article>
      </section>
    </div>
  )
}
