import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { tasksApi, type TaskItem } from '../api/modules/tasks'
import { projectsApi } from '../api/modules/projects'
import { Button, Input, Select, Modal } from 'antd'


interface TaskFormProps {
  task?: TaskItem | null
  projectId?: string
  onClose: () => void
  onSaved: () => void
}

export function TaskForm({ task, projectId, onClose, onSaved }: TaskFormProps) {
  const { t } = useTranslation()
  const [title, setTitle] = useState(task?.title || '')
  const [description, setDescription] = useState(task?.description || '')
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

  useEffect(() => {
    projectsApi.list().then(r => setProjects(r.items)).catch(() => {})
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    setLoading(true)
    setError(null)
    try {
      const payload: Record<string, string> = { title, category, priority, status, phase, owner_role: ownerRole }
      if (description.trim()) payload.description = description.trim()
      if (isEdit) {
        await tasksApi.update(task!.id, payload as any)
      } else {
        (payload as any).project_id = projectIdVal
        await tasksApi.create(payload as any)
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
          <Button className="modal-close" onClick={onClose}>×</Button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>{t('tasks.project')}</label>
            <Select value={projectIdVal} onChange={e => setProjectIdVal(e)} disabled={isEdit}>
              {projects.map(p => <Select.Option key={p.id} value={p.id}>{p.code} — {p.name}</Select.Option>)}
            </Select>
          </div>
          <div className="form-group">
            <label>{t('tasks.title_col')} *</label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder={t('tasks.title_col')} required />
          </div>
          <div className="form-group">
            <label>{t('tasks.detail.description')}</label>
            <Input.TextArea value={description} onChange={e => setDescription(e.target.value)} placeholder={t('tasks.detail.description_placeholder')} rows={3} style={{ resize: 'vertical', fontFamily: 'var(--font-sans)' }} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>{t('tasks.detail.category')}</label>
              <Select value={category} onChange={e => setCategory(e)}>
                {categories.map(c => <Select.Option key={c} value={c}>{t(`category.${c}`, c)}</Select.Option>)}
              </Select>
            </div>
            <div className="form-group">
              <label>{t('tasks.priority')}</label>
              <Select value={priority} onChange={e => setPriority(e)}>
                {priorities.map(p => <Select.Option key={p} value={p}>{t(`priority.${p}`, p)}</Select.Option>)}
              </Select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>{t('tasks.status')}</label>
              <Select value={status} onChange={e => setStatus(e)}>
                {statuses.map(s => <Select.Option key={s} value={s}>{t(`status.${s}`, s.replace('_', ' '))}</Select.Option>)}
              </Select>
            </div>
            <div className="form-group">
              <label>{t('tasks.detail.phase')}</label>
              <Input value={phase} onChange={e => setPhase(e.target.value)} placeholder={t("tasks.detail.phase_placeholder")} />
            </div>
          </div>
          <div className="form-group">
            <label>{t('tasks.owner')}</label>
            <Input value={ownerRole} onChange={e => setOwnerRole(e.target.value)} placeholder={t("tasks.owner_placeholder")} />
          </div>
          {error && <div className="form-error">{error}</div>}
          <div className="form-actions">
            <Button htmlType="button" className="btn btn-secondary" onClick={onClose}>{t('app.cancel')}</Button>
            <Button htmlType="submit" className="btn btn-primary" disabled={loading || !title.trim()}>
              {loading ? t('app.saving') : isEdit ? t('app.save') : t('app.create')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
