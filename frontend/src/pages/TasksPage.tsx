import { useEffect, useState, useCallback } from 'react'
import { tasksApi, type TaskItem } from '../api/modules/tasks'
import { TaskForm } from '../components/TaskForm'
import { useTranslation } from 'react-i18next'
import { Button, Input, Select, Table, Card, Empty, Popconfirm } from 'antd'


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
    setLoading(true); setError(null)
    try {
      const params: Record<string, string> = {}
      if (statusFilter) params.status = statusFilter
      if (projectFilter) params.projectId = projectFilter
      const res = await tasksApi.list(params)
      setTasks(res.items)
      setTotal(res.total)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }, [statusFilter, projectFilter])

  useEffect(() => { fetchTasks() }, [fetchTasks])

  const handleDelete = async (id: string) => {
    if (!confirm(t('app.confirm_delete_task'))) return
    try { await tasksApi.delete(id); fetchTasks() } catch (e: any) { setError(e.message) }
  }

  const handleSaved = () => { fetchTasks(); setEditTask(null) }

  const projects = [...new Set(tasks.map(t => t.projectId))].sort()

  const filtered = tasks.filter(task => {
    if (priorityFilter && task.priority !== priorityFilter) return false
    if (search) {
      const q = search.toLowerCase()
      if (!task.title.toLowerCase().includes(q) && !task.projectId.toLowerCase().includes(q)) return false
    }
    return true
  })

  return (
    <div>
      <div className="page-header">
        <p className="page-header-eyebrow">{t('tasks.eyebrow')}</p>
        <h1>{t('tasks.title')}</h1>
        <p className="page-header-desc">{t('tasks.subtitle')}</p>
        <div className="page-header-actions">
          <div className="search-box" style={{ width: 240 }}>
            <svg className="search-box-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
            <Input placeholder={t('app.search')} value={search} onChange={e => setSearch(e.target.value)} allowClear style={{ maxWidth: 300 }} />
          </div>
          <Select value={projectFilter} onChange={e => setProjectFilter(e)} className="filter-select">
            <Select.Option value="">{t('tasks.all_projects')}</Select.Option>
            {projects.map(p => <Select.Option key={p} value={p}>{p}</Select.Option>)}
          </Select>
          <Select value={statusFilter} onChange={e => setStatusFilter(e)} className="filter-select">
            <Select.Option value="">{t('tasks.all_status')}</Select.Option>
            {['planned', 'in_progress', 'review', 'blocked', 'done'].map(s => (
              <Select.Option key={s} value={s}>{t(`status.${s}`, s.replace('_', ' '))}</Select.Option>
            ))}
          </Select>
          <Select value={priorityFilter} onChange={e => setPriorityFilter(e)} className="filter-select">
            <Select.Option value="">{t('tasks.all_priority')}</Select.Option>
            {['high', 'medium', 'low'].map(p => (
              <Select.Option key={p} value={p}>{t(`priority.${p}`)}</Select.Option>
            ))}
          </Select>
          <div style={{ flex: 1 }} />
          <Button type="primary" onClick={() => setShowForm(true)}>
            {t('tasks.new_task')}
          </Button>
        </div>
      </div>

      {loading && (
        <div className="table-wrapper">
          <table className="data-table">
            <thead><tr><th style={{ width: 40 }}>#</th><th>{t('tasks.title_col')}</th><th>{t('tasks.project')}</th><th>{t('tasks.status')}</th><th>{t('tasks.priority')}</th><th>{t('tasks.owner')}</th><th>{t('app.updated')}</th><th style={{ width: 80 }}>{t('app.actions')}</th></tr></thead>
            <tbody>
              {[1, 2, 3, 4, 5].map(i => (
                <tr key={i}>
                  <td><div className="skeleton" style={{ width: 20, height: 14 }} /></td>
                  <td><div className="skeleton" style={{ width: '60%', height: 14 }} /></td>
                  <td><div className="skeleton" style={{ width: 80, height: 14 }} /></td>
                  <td><div className="skeleton" style={{ width: 60, height: 20, borderRadius: 10 }} /></td>
                  <td><div className="skeleton" style={{ width: 50, height: 20, borderRadius: 10 }} /></td>
                  <td><div className="skeleton" style={{ width: 80, height: 14 }} /></td>
                  <td><div className="skeleton" style={{ width: 120, height: 14 }} /></td>
                  <td><div className="skeleton" style={{ width: 60, height: 14 }} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {error && (
        <div className="card">
          <div className="card-body" style={{ color: 'var(--status-red)' }}>{t("app.error")}: {error}</div>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="card">
          <div className="card-body" style={{ padding: 'var(--space-10)' }}>
            <Empty
              description={
                <div>
                  <div style={{ marginBottom: 'var(--space-2)' }}>{t('tasks.no_tasks')}</div>
                  <Button type="primary" onClick={() => setShowForm(true)}>{t('tasks.new_task')}</Button>
                </div>
              }
            />
          </div>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th>{t('tasks.title_col')}</th>
                  <th>{t('tasks.project')}</th>
                  <th>{t('tasks.status')}</th>
                  <th>{t('tasks.priority')}</th>
                  <th>{t('tasks.owner')}</th>
                  <th>{t('app.updated')}</th>
                  <th style={{ width: 80 }}>{t('app.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((task, i) => (
                  <tr key={task.id}>
                    <td style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>{i + 1}</td>
                    <td><a href={`/tasks/${task.id}`} className="task-title-cell" style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{task.title}</a></td>
                    <td><a href={`/projects/${task.projectId}`} className="mono" style={{ color: 'var(--text-secondary)' }}>{task.projectId}</a></td>
                    <td><span className={`badge badge-${task.status}`}>{String(t(`status.${task.status}`, task.status.replace('_', ' ')))}</span></td>
                    <td><span className={`badge badge-priority-${task.priority}`}>{String(t(`priority.${task.priority}`, task.priority))}</span></td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>{task.ownerRole || '-'}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>{new Date(task.updatedAt).toLocaleString()}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 2 }}>
                        <Button className="btn-icon" title={t('app.edit')} onClick={() => setEditTask(task)}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </Button>
                        <Button className="btn-icon" title={t('app.delete')} onClick={() => handleDelete(task.id)} style={{ color: 'var(--status-red)' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                          </svg>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 'var(--space-3)', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
            {t('app.total', { count: filtered.length })}
          </div>
        </>
      )}

      {showForm && <TaskForm projectId={projectFilter} onClose={() => setShowForm(false)} onSaved={handleSaved} />}
      {editTask && <TaskForm task={editTask} onClose={() => setEditTask(null)} onSaved={handleSaved} />}
    </div>
  )
}
