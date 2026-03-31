import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { tasksApi, type TaskItem } from '../api/modules/tasks'
import { projectsApi } from '../api/modules/projects'

interface TaskFormProps {
  task?: TaskItem | null
  projectId?: string
  onClose: () => void
  onSaved: () => void
}

export function TaskForm({ task, projectId, onClose, onSaved }: TaskFormProps) {
  const { t } = useTranslation()
  const [title, setTitle] = useState(task?.title || '')
  const [category, setCategory] = useState(task?.category || 'backend')
  const [priority, setPriority] = useState(task?.priority || 'medium')
  const [status, setStatus] = useState(task?.status || 'planned')
  const [phase, setPhase] = useState(task?.phase || '')
  const [ownerRole, setOwnerRole] = useState(task?.ownerRole || '')
  const [projectIdVal, setProjectIdVal] = useState(task?.projectId || projectId || '')
  const [projects, setProjects] = useState<{ id: string; code: string; name: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isEdit = !!task

  useState(() => {
    projectsApi.list().then(r => setProjects(r.items)).catch(() => {})
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    setLoading(true)
    setError(null)
    try {
      if (isEdit) {
        await tasksApi.update(task.id, { title, category, priority, status, phase, owner_role: ownerRole })
      } else {
        await tasksApi.create({ project_id: projectIdVal, title, category, priority, status, phase, owner_role: ownerRole })
      }
      onSaved()
      onClose()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const categories = ['requirement', 'backend', 'frontend', 'test', 'dba', 'design', 'devops', 'doc']
  const priorities = ['high', 'medium', 'low']
  const statuses = ['planned', 'in_progress', 'review', 'blocked', 'done']

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEdit ? t('tasks.form_edit_title') : t('tasks.form_title')}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>{t('tasks.project')}</label>
            <select value={projectIdVal} onChange={e => setProjectIdVal(e.target.value)} disabled={isEdit}>
              {projects.map(p => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>{t('tasks.title_col')} *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder={t('tasks.title_col')} required />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>{t('tasks.detail.category')}</label>
              <select value={category} onChange={e => setCategory(e.target.value)}>
                {categories.map(c => <option key={c} value={c}>{t(`category.${c}`, c)}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>{t('tasks.priority')}</label>
              <select value={priority} onChange={e => setPriority(e.target.value)}>
                {priorities.map(p => <option key={p} value={p}>{t(`priority.${p}`, p)}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>{t('tasks.status')}</label>
              <select value={status} onChange={e => setStatus(e.target.value)}>
                {statuses.map(s => <option key={s} value={s}>{t(`status.${s}`, s.replace('_', ' '))}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>{t('tasks.detail.phase')}</label>
              <input value={phase} onChange={e => setPhase(e.target.value)} placeholder="e.g. Sprint 1" />
            </div>
          </div>
          <div className="form-group">
            <label>{t('tasks.owner')}</label>
            <input value={ownerRole} onChange={e => setOwnerRole(e.target.value)} placeholder="e.g. rd-backend-dev" />
          </div>
          {error && <div className="form-error">{error}</div>}
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>{t('app.cancel')}</button>
            <button type="submit" className="btn btn-primary" disabled={loading || !title.trim()}>
              {loading ? t('app.saving') : isEdit ? t('app.save') : t('app.create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
