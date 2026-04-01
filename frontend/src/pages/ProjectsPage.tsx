import { useEffect, useState, useCallback } from 'react'
import { projectsApi, type ProjectItem } from '../api/modules/projects'
import { useTranslation } from 'react-i18next'
import { Button, Input, Modal, Card, Empty, Popconfirm } from 'antd'


export function ProjectsPage() {
  const { t } = useTranslation()
  const [projects, setProjects] = useState<ProjectItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [formName, setFormName] = useState('')
  const [formCode, setFormCode] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')

  const fetchProjects = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await projectsApi.list()
      setProjects(res.items)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchProjects() }, [fetchProjects])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formName.trim() || !formCode.trim()) return
    setSaving(true)
    try {
      await projectsApi.create({ name: formName, code: formCode, description: formDesc || undefined })
      setShowForm(false); setFormName(''); setFormCode(''); setFormDesc('')
      fetchProjects()
    } catch (err: any) { setError(err.message) }
    finally { setSaving(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t('app.confirm_delete_project'))) return
    try { await projectsApi.delete(id); fetchProjects() } catch (e: any) { setError(e.message) }
  }

  const filtered = search
    ? projects.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.code.toLowerCase().includes(search.toLowerCase()))
    : projects

  return (
    <div>
      <div className="page-header">
        <p className="page-header-eyebrow">{t('projects.eyebrow')}</p>
        <h1>{t('projects.title')}</h1>
        <p className="page-header-desc">{t('projects.subtitle')}</p>
        <div className="page-header-actions">
          <div className="search-box" style={{ width: 240 }}>
            <svg className="search-box-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
            <Input placeholder={t('app.search')} value={search} onChange={e => setSearch(e.target.value)} allowClear style={{ maxWidth: 300 }} />
          </div>
          <div style={{ flex: 1 }} />
          <Button type="primary" onClick={() => setShowForm(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
            {t('projects.new_project')}
          </Button>
        </div>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{t('projects.form_title')}</h2>
              <Button className="modal-close" onClick={() => setShowForm(false)}>×</Button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="form-row">
                <div className="form-group">
                  <label>{t('projects.form_code')} *</label>
                  <Input value={formCode} onChange={e => setFormCode(e.target.value)} placeholder={t('projects.form_code_placeholder')} required />
                </div>
                <div className="form-group">
                  <label>{t('projects.form_name')} *</label>
                  <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder={t('projects.form_name_placeholder')} required />
                </div>
              </div>
              <div className="form-group">
                <label>{t('projects.form_desc')}</label>
                <Input value={formDesc} onChange={e => setFormDesc(e.target.value)} placeholder={t('projects.form_desc_placeholder')} />
              </div>
              {error && <div className="form-error" style={{ marginBottom: 16 }}>{error}</div>}
              <div className="form-actions">
                <Button htmlType="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>{t('app.cancel')}</Button>
                <Button htmlType="submit" className="btn btn-primary" disabled={saving || !formCode.trim() || !formName.trim()}>
                  {saving ? t('app.saving') : t('app.create')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading && (
        <div className="project-grid">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="card" style={{ padding: 'var(--space-5)' }}>
              <div className="skeleton" style={{ width: '30%', height: 14, marginBottom: 12 }} />
              <div className="skeleton" style={{ width: '60%', height: 20, marginBottom: 16 }} />
              <div className="skeleton" style={{ width: '80%', height: 14 }} />
            </div>
          ))}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">📂</div>
            <div className="empty-state-title">{t('projects.no_projects')}</div>
            <Button type="primary" onClick={() => setShowForm(true)}>{t('projects.new_project')}</Button>
          </div>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="project-grid">
          {filtered.map(p => (
            <a key={p.id} href={`/projects/${p.id}`} className="project-card">
              <div className="project-card-header">
                <span className="project-card-code">{p.code}</span>
                <span className={`badge badge-${p.status}`}>{p.status}</span>
              </div>
              <div className="project-card-name">{p.name}</div>
              <div className="project-card-meta">
                <span>📋 {p.taskCount} {t('projects.tasks')}</span>
                {p.blockedTaskCount > 0 && (
                  <span style={{ color: 'var(--status-red)' }}>🚫 {p.blockedTaskCount}</span>
                )}
                <Button
                  className="btn-icon"
                  title={t('app.delete')}
                  onClick={e => { e.preventDefault(); e.stopPropagation(); handleDelete(p.id) }}
                  style={{ marginLeft: 'auto' }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                  </svg>
                </Button>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
