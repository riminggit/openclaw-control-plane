import { useEffect, useState, useCallback } from 'react'
import { tasksApi, type TaskItem } from '../api/modules/tasks'
import { TaskForm } from '../components/TaskForm'
import { useTranslation } from 'react-i18next'

export function TasksPage() {
  const { t } = useTranslation()
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [projectFilter, setProjectFilter] = useState('')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editTask, setEditTask] = useState<TaskItem | null>(null)

  const fetchTasks = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params: Record<string, string> = {}
      if (statusFilter) params.status = statusFilter
      if (projectFilter) params.projectId = projectFilter
      const res = await tasksApi.list(params)
      setTasks(res.items)
      setTotal(res.total)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [statusFilter, projectFilter])

  useEffect(() => { fetchTasks() }, [fetchTasks])

  const handleDelete = async (id: string) => {
    if (!confirm(t('app.confirm_delete_task'))) return
    try { await tasksApi.delete(id); fetchTasks() } catch (e: any) { setError(e.message) }
  }

  const handleSaved = () => { fetchTasks(); setEditTask(null) }

  const projects = [...new Set(tasks.map(t => t.projectId))].sort()

  const filtered = tasks.filter(t => {
    if (priorityFilter && t.priority !== priorityFilter) return false
    if (search) {
      const q = search.toLowerCase()
      if (!t.title.toLowerCase().includes(q) && !t.projectId.toLowerCase().includes(q)) return false
    }
    return true
  })

  return (
    <div>
      <div className="hero">
        <div className="eyebrow">{t('tasks.eyebrow')}</div>
        <h1>{t('tasks.title')}</h1>
        <p className="subtext">{t('tasks.subtitle')}</p>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          className="search-input"
          placeholder={t('app.search')}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select value={projectFilter} onChange={e => setProjectFilter(e.target.value)} className="filter-select">
          <option value="">{t('tasks.all_projects')}</option>
          {projects.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="filter-select">
          <option value="">{t('tasks.all_status')}</option>
          {['planned', 'in_progress', 'review', 'blocked', 'done'].map(s => (
            <option key={s} value={s}>{s.replace('_', ' ')}</option>
          ))}
        </select>
        <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)} className="filter-select">
          <option value="">{t('tasks.all_priority')}</option>
          {['high', 'medium', 'low'].map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <div style={{ flex: 1 }} />
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>{t('tasks.new_task')}</button>
      </div>

      {loading && <p style={{ color: 'var(--text-muted)' }}>{t('app.loading')}</p>}
      {error && <p style={{ color: '#ff6b6b' }}>Error: {error}</p>}
      {!loading && !error && filtered.length === 0 && (
        <div className="card empty-state">
          <div className="empty-icon">📋</div>
          <p style={{ color: 'var(--text-muted)' }}>{t('tasks.no_tasks')}</p>
        </div>
      )}

      {filtered.length > 0 && (
        <table className="task-table">
          <thead>
            <tr><th>{t('tasks.title_col')}</th><th>{t('tasks.project')}</th><th>{t('tasks.status')}</th><th>{t('tasks.priority')}</th><th>{t('tasks.owner')}</th><th>{t('app.updated')}</th><th>{t('app.actions')}</th></tr>
          </thead>
          <tbody>
            {filtered.map(task => (
              <tr key={task.id}>
                <td><a href={`/tasks/${task.id}`} className="link">{task.title}</a></td>
                <td><a href={`/projects/${task.projectId}`} className="link">{task.projectId}</a></td>
                <td><span className={`badge badge-${task.status}`}>{task.status.replace('_', ' ')}</span></td>
                <td><span className={`badge badge-priority-${task.priority}`}>{task.priority}</span></td>
                <td>{task.ownerRole}</td>
                <td>{new Date(task.updatedAt).toLocaleString()}</td>
                <td>
                  <button className="btn-icon" title={t('app.edit')} onClick={() => setEditTask(task)}>✏️</button>
                  <button className="btn-icon" title={t('app.delete')} onClick={() => handleDelete(task.id)}>🗑️</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {!loading && filtered.length > 0 && (
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 8 }}>{t('app.total', { count: filtered.length })}</p>
      )}

      {showForm && <TaskForm projectId={projectFilter} onClose={() => setShowForm(false)} onSaved={handleSaved} />}
      {editTask && <TaskForm task={editTask} onClose={() => setEditTask(null)} onSaved={handleSaved} />}
    </div>
  )
}
