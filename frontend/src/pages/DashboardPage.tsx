import { useEffect, useState, useCallback } from 'react'
import { projectsApi, type ProjectItem } from '../api/modules/projects'
import { tasksApi, type TaskItem } from '../api/modules/tasks'
import { useTranslation } from 'react-i18next'

function Skeleton({ w = '100%', h = 14, style }: { w?: string; h?: number; style?: React.CSSProperties }) {
  return <div className="skeleton" style={{ width: w, height: h, borderRadius: 4, ...style }} />
}

export function DashboardPage() {
  const { t } = useTranslation()
  const [data, setData] = useState<{ projects: ProjectItem[]; tasks: TaskItem[] } | null>(null)
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

  if (loading) {
    return (
      <div>
        <div className="page-header">
          <div className="skeleton" style={{ width: 200, height: 12, marginBottom: 8 }} />
          <div className="skeleton" style={{ width: 300, height: 28, marginBottom: 8 }} />
          <div className="skeleton" style={{ width: 400, height: 16 }} />
        </div>
        <div className="stats-grid">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="stat-card">
              <Skeleton w="40%" h={32} />
              <Skeleton w="70%" h={14} style={{ marginTop: 12 }} />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">⚠️</div>
        <div className="empty-state-title">Something went wrong</div>
        <div className="empty-state-desc">{error}</div>
        <button className="btn btn-primary" onClick={fetchData}>{t('app.retry')}</button>
      </div>
    )
  }

  if (!data) return null

  const { projects, tasks } = data
  const blocked = tasks.filter((t: TaskItem) => t.status === 'blocked').length
  const inProgress = tasks.filter((t: TaskItem) => t.status === 'in_progress').length

  return (
    <div>
      <div className="page-header">
        <p className="page-header-eyebrow">{t('dashboard.eyebrow')}</p>
        <h1>{t('dashboard.title')}</h1>
        <p className="page-header-desc">{t('dashboard.subtitle')}</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-icon projects">📁</div>
          <div className="stat-card-label">{t('dashboard.projects')}</div>
          <div className="stat-card-value">{projects.length}</div>
          <div className="stat-card-bg" style={{ background: 'var(--status-blue)' }} />
        </div>
        <div className="stat-card">
          <div className="stat-card-icon tasks">📋</div>
          <div className="stat-card-label">{t('dashboard.tasks_count')}</div>
          <div className="stat-card-value">{tasks.length}</div>
          <div className="stat-card-bg" style={{ background: 'var(--status-purple)' }} />
        </div>
        <div className="stat-card">
          <div className="stat-card-icon blocked">🚫</div>
          <div className="stat-card-label">{t('dashboard.blocked')}</div>
          <div className="stat-card-value" style={{ color: blocked > 0 ? 'var(--status-red)' : 'var(--text-primary)' }}>{blocked}</div>
          <div className="stat-card-bg" style={{ background: 'var(--status-red)' }} />
        </div>
        <div className="stat-card">
          <div className="stat-card-icon progress">⚡</div>
          <div className="stat-card-label">{t('dashboard.in_progress')}</div>
          <div className="stat-card-value" style={{ color: 'var(--status-green)' }}>{inProgress}</div>
          <div className="stat-card-bg" style={{ background: 'var(--status-green)' }} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
        {/* Recent Tasks */}
        <div className="card">
          <div className="card-header">
            <h2>{t('dashboard.recent_tasks')}</h2>
          </div>
          {tasks.length === 0 ? (
            <div className="card-body empty-state" style={{ padding: 'var(--space-10)' }}>
              <div className="empty-state-icon" style={{ fontSize: 32 }}>📋</div>
              <div className="empty-state-desc">{t('dashboard.no_tasks')}</div>
            </div>
          ) : (
            <div className="table-wrapper" style={{ borderRadius: 0, border: 'none' }}>
              <table className="data-table">
                <thead>
                  <tr><th>{t('tasks.title_col')}</th><th>{t('tasks.status')}</th><th>{t('tasks.priority')}</th><th>{t('tasks.project')}</th></tr>
                </thead>
                <tbody>
                  {tasks.slice(0, 10).map((task: TaskItem) => (
                    <tr key={task.id}>
                      <td><a href={`/tasks/${task.id}`} className="task-title-cell" style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{task.title}</a></td>
                      <td><span className={`badge badge-${task.status}`}>{task.status.replace('_', ' ')}</span></td>
                      <td><span className={`badge badge-priority-${task.priority}`}>{task.priority}</span></td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>{task.category}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Project List */}
        <div className="card">
          <div className="card-header">
            <h2>{t('dashboard.project_list')}</h2>
          </div>
          {projects.length === 0 ? (
            <div className="card-body empty-state" style={{ padding: 'var(--space-10)' }}>
              <div className="empty-state-icon" style={{ fontSize: 32 }}>📂</div>
              <div className="empty-state-desc">{t('dashboard.no_projects')}</div>
            </div>
          ) : (
            <div className="table-wrapper" style={{ borderRadius: 0, border: 'none' }}>
              <table className="data-table">
                <thead>
                  <tr><th>{t('projects.code')}</th><th>{t('projects.name')}</th><th>{t('projects.status')}</th><th>{t('projects.tasks')}</th></tr>
                </thead>
                <tbody>
                  {projects.map((p: ProjectItem) => (
                    <tr key={p.id}>
                      <td className="mono"><a href={`/projects/${p.id}`}>{p.code}</a></td>
                      <td><a href={`/projects/${p.id}`}>{p.name}</a></td>
                      <td><span className={`badge badge-${p.status}`}>{p.status}</span></td>
                      <td>{p.taskCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
