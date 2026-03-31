import { useEffect, useState, useCallback } from 'react'
import { projectsApi, type ProjectItem } from '../api/modules/projects'
import { useTranslation } from 'react-i18next'

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
      <div className="hero">
        <div className="eyebrow">{t('projects.eyebrow')}</div>
        <h1>{t('projects.title')}</h1>
        <p className="subtext">{t('projects.subtitle')}</p>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
        <input
          className="search-input"
          placeholder={t('app.search')}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div style={{ flex: 1 }} />
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>{t('projects.new_project')}</button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3>{t('projects.form_title')}</h3>
          <form onSubmit={handleCreate} style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ flex: 1, minWidth: 120 }}>
              <label>{t('projects.form_code')}</label>
              <input value={formCode} onChange={e => setFormCode(e.target.value)} placeholder={t('projects.form_code_placeholder')} required />
            </div>
            <div className="form-group" style={{ flex: 2, minWidth: 150 }}>
              <label>{t('projects.form_name')}</label>
              <input value={formName} onChange={e => setFormName(e.target.value)} placeholder={t('projects.form_name_placeholder')} required />
            </div>
            <div className="form-group" style={{ flex: 2, minWidth: 150 }}>
              <label>{t('projects.form_desc')}</label>
              <input value={formDesc} onChange={e => setFormDesc(e.target.value)} placeholder={t('projects.form_desc_placeholder')} />
            </div>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? t('app.saving') : t('app.create')}</button>
            <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>{t('app.cancel')}</button>
          </form>
        </div>
      )}

      {loading && <p style={{ color: 'var(--text-muted)' }}>{t('app.loading')}</p>}
      {error && <p style={{ color: '#ff6b6b' }}>Error: {error}</p>}

      {!loading && filtered.length === 0 && (
        <div className="card empty-state">
          <div className="empty-icon">📂</div>
          <p style={{ color: 'var(--text-muted)' }}>{t('projects.no_projects')}</p>
        </div>
      )}

      {filtered.length > 0 && (
        <table className="task-table">
          <thead>
            <tr><th>{t('projects.code')}</th><th>{t('projects.name')}</th><th>{t('projects.status')}</th><th>{t('projects.tasks')}</th><th>{t('projects.blocked')}</th><th>{t('projects.owner')}</th><th>{t('app.updated')}</th><th>{t('app.actions')}</th></tr>
          </thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.id}>
                <td className="mono"><a href={`/projects/${p.id}`} className="link">{p.code}</a></td>
                <td><a href={`/projects/${p.id}`} className="link">{p.name}</a></td>
                <td><span className={`badge badge-${p.status}`}>{p.status}</span></td>
                <td>{p.taskCount}</td>
                <td style={{ color: p.blockedTaskCount > 0 ? '#ff6b6b' : 'var(--text-muted)' }}>{p.blockedTaskCount}</td>
                <td>{p.ownerRole}</td>
                <td>{new Date(p.updatedAt).toLocaleString()}</td>
                <td>
                  <button className="btn-icon" title={t('app.delete')} onClick={() => handleDelete(p.id)}>🗑️</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
