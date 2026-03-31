import { useEffect, useState, useCallback } from 'react'
import { tasksApi, type TaskItem } from '../api/modules/tasks'
import { useTranslation } from 'react-i18next'

const COLUMNS = [
  { key: 'planned', color: '#8ea4d6' },
  { key: 'in_progress', color: '#6bdfff' },
  { key: 'review', color: '#ffc83c' },
  { key: 'blocked', color: '#ff6b6b' },
  { key: 'done', color: '#6bdf64' },
]

export function KanbanPage() {
  const { t } = useTranslation()
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [loading, setLoading] = useState(true)
  const [dragTask, setDragTask] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)

  const fetchTasks = useCallback(async () => {
    setLoading(true)
    try { const res = await tasksApi.list(); setTasks(res.items) } catch {}
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchTasks() }, [fetchTasks])

  const handleDrop = async (status: string) => {
    if (!dragTask) return
    setDragOver(null); setDragTask(null)
    try { await tasksApi.update(dragTask, { status }); fetchTasks() } catch {}
  }

  if (loading) return <div className="page"><p style={{ color: 'var(--text-muted)' }}>{t('app.loading')}</p></div>

  return (
    <div>
      <div className="hero">
        <div className="eyebrow">{t('kanban.eyebrow')}</div>
        <h1>{t('kanban.title')}</h1>
        <p className="subtext">{t('kanban.subtitle')}</p>
      </div>

      <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 16 }}>
        {COLUMNS.map(col => {
          const colTasks = tasks.filter(task => task.status === col.key)
          return (
            <div
              key={col.key}
              className={`kanban-column${dragOver === col.key ? ' drag-over' : ''}`}
              onDragOver={e => { e.preventDefault(); setDragOver(col.key) }}
              onDragLeave={() => setDragOver(null)}
              onDrop={() => handleDrop(col.key)}
              style={{ minWidth: 220, flex: 1 }}
            >
              <div className="kanban-col-header">
                <span style={{ color: col.color, fontWeight: 600 }}>{t(`kanban.${col.key}`)}</span>
                <span className="badge" style={{ marginLeft: 8 }}>{colTasks.length}</span>
              </div>
              <div className="kanban-cards">
                {colTasks.map(task => (
                  <div
                    key={task.id}
                    className="kanban-card"
                    draggable
                    onDragStart={() => setDragTask(task.id)}
                    style={{ opacity: dragTask === task.id ? 0.5 : 1, borderColor: col.color + '33' }}
                  >
                    <a href={`/tasks/${task.id}`} className="link" style={{ fontWeight: 500, display: 'block', marginBottom: 6 }}>{task.title}</a>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
                      <span className={`badge badge-priority-${task.priority}`}>{task.priority}</span>
                      <span>{task.category}</span>
                    </div>
                    {task.ownerRole && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>👤 {task.ownerRole}</div>}
                  </div>
                ))}
                {colTasks.length === 0 && (
                  <div style={{ color: '#5a6a8a', fontSize: 12, textAlign: 'center', padding: 20 }}>{t('kanban.no_tasks')}</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
