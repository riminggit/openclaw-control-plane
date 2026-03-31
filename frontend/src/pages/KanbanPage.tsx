import { useEffect, useState, useCallback } from 'react'
import { tasksApi, type TaskItem } from '../api/modules/tasks'
import { useTranslation } from 'react-i18next'

const COLUMNS = [
  { key: 'planned', labelKey: 'kanban.planned', color: 'var(--text-muted)' },
  { key: 'in_progress', labelKey: 'kanban.in_progress', color: 'var(--status-blue)' },
  { key: 'review', labelKey: 'kanban.review', color: 'var(--status-yellow)' },
  { key: 'blocked', labelKey: 'kanban.blocked', color: 'var(--status-red)' },
  { key: 'done', labelKey: 'kanban.done', color: 'var(--status-green)' },
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

  return (
    <div>
      <div className="page-header">
        <p className="page-header-eyebrow">{t('kanban.eyebrow')}</p>
        <h1>{t('kanban.title')}</h1>
        <p className="page-header-desc">{t('kanban.subtitle')}</p>
      </div>

      {loading ? (
        <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
          {COLUMNS.map(col => (
            <div key={col.key} style={{ flex: 1, minWidth: 220 }}>
              <div className="skeleton" style={{ width: '50%', height: 20, marginBottom: 16 }} />
              {[1, 2, 3].map(i => (
                <div key={i} className="skeleton" style={{ height: 80, borderRadius: 'var(--radius-lg)', marginBottom: 8 }} />
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="kanban-board">
          {COLUMNS.map(col => {
            const colTasks = tasks.filter(task => task.status === col.key)
            return (
              <div
                key={col.key}
                className="kanban-column"
                  borderColor: dragOver === col.key ? col.color : undefined,
                }}
                onDragOver={e => { e.preventDefault(); setDragOver(col.key) }}
                onDragLeave={() => setDragOver(null)}
                onDrop={() => handleDrop(col.key)}
              >
                <div className="kanban-col-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: col.color }} />
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 'var(--text-sm)' }}>{t(col.labelKey)}</span>
                  </div>
                  <span className="badge" style={{ background: 'var(--bg-surface-hover)', color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>{colTasks.length}</span>
                </div>
                <div className="kanban-cards">
                  {colTasks.map(task => (
                    <div
                      key={task.id}
                      className="kanban-card"
                      draggable
                      onDragStart={() => setDragTask(task.id)}
                      onDragEnd={() => { setDragTask(null); setDragOver(null) }}
                      style={{
                        opacity: dragTask === task.id ? 0.5 : 1,
                        boxShadow: dragTask === task.id ? 'var(--shadow-lg)' : undefined,
                      }}
                    >
                      <a href={`/tasks/${task.id}`} style={{ fontWeight: 500, color: 'var(--text-primary)', display: 'block', marginBottom: 8, fontSize: 'var(--text-sm)' }}>{task.title}</a>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span className={`badge badge-priority-${task.priority}`} style={{ fontSize: 10 }}>{task.priority}</span>
                        <span className="badge" style={{ background: 'var(--bg-surface-hover)', color: 'var(--text-muted)', fontSize: 10 }}>{task.category}</span>
                      </div>
                      {task.ownerRole && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                          {task.ownerRole}
                        </div>
                      )}
                    </div>
                  ))}
                  {colTasks.length === 0 && (
                    <div style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', textAlign: 'center', padding: 'var(--space-8)' }}>
                      {t('kanban.no_tasks')}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
