import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useCronJobs, useConnectionState } from '../hooks/useGateway'
import { gatewayClient } from '../lib/gateway-client'

export function CronPage() {
  const { t } = useTranslation()
  const connState = useConnectionState()
  const { jobs, loading, refetch } = useCronJobs()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', schedule: '', payload: '' })
  const [runs, setRuns] = useState<any[]>([])
  const [showRuns, setShowRuns] = useState<string | null>(null)

  const handleCreate = async () => {
    if (!form.name || !form.schedule) return
    try {
      await gatewayClient.call('cron.add', { name: form.name, schedule: form.schedule, payload: form.payload || '{}' })
      setShowForm(false)
      setForm({ name: '', schedule: '', payload: '' })
      refetch()
    } catch { /* */ }
  }

  const handleDelete = async (jobId: string) => {
    if (!confirm(t('cron.confirm_delete'))) return
    try { await gatewayClient.call('cron.remove', { jobId }); refetch() } catch { /* */ }
  }

  const handleToggle = async (jobId: string, enabled: boolean) => {
    try { await gatewayClient.call('cron.update', { jobId, patch: { enabled: !enabled } }); refetch() } catch { /* */ }
  }

  const handleTrigger = async (jobId: string) => {
    try { await gatewayClient.call('cron.run', { jobId }) } catch { /* */ }
  }

  const handleViewRuns = async (jobId: string) => {
    try {
      const res = await gatewayClient.call('cron.runs', { jobId })
      setRuns(res?.runs || res || [])
      setShowRuns(jobId)
    } catch { /* */ }
  }

  if (connState !== 'connected') {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🔌</div>
        <div className="empty-state-title">{t('dashboard.not_connected')}</div>
        <a href="/settings" className="btn btn-primary" style={{ textDecoration: 'none' }}>{t('gateway.go_settings')}</a>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <p className="page-header-eyebrow">{t('cron.eyebrow')}</p>
        <h1>{t('cron.title')}</h1>
        <p className="page-header-desc">{t('cron.subtitle')}</p>
      </div>

      <div style={{ marginBottom: 'var(--space-4)' }}>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? t('app.cancel') : `+ ${t('cron.new_job')}`}
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
          <div className="card-header"><h2>{t('cron.create_job')}</h2></div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder={t('cron.form_name')} />
            <input className="form-input" value={form.schedule} onChange={e => setForm({ ...form, schedule: e.target.value })} placeholder={t('cron.form_schedule')} />
            <textarea className="form-input" value={form.payload} onChange={e => setForm({ ...form, payload: e.target.value })} placeholder={t('cron.form_payload')} rows={3} />
            <button className="btn btn-primary" onClick={handleCreate} disabled={!form.name || !form.schedule}>{t('app.create')}</button>
          </div>
        </div>
      )}

      <div className="card">
        {loading ? (
          <div className="card-body" style={{ textAlign: 'center', padding: 'var(--space-10)' }}>{t('app.loading')}</div>
        ) : !jobs || jobs.length === 0 ? (
          <div className="card-body empty-state" style={{ padding: 'var(--space-10)' }}>
            <div className="empty-state-icon">⏰</div>
            <div className="empty-state-desc">{t('cron.no_jobs')}</div>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('cron.name')}</th>
                  <th>{t('cron.schedule')}</th>
                  <th>{t('cron.status')}</th>
                  <th>{t('cron.next_run')}</th>
                  <th>{t('app.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job: any, i: number) => (
                  <tr key={job.id || job.jobId || i}>
                    <td style={{ fontWeight: 500 }}>{job.name || '-'}</td>
                    <td className="mono" style={{ fontSize: 'var(--text-sm)' }}>{job.schedule || '-'}</td>
                    <td><span className={`badge badge-${job.enabled !== false ? 'active' : 'archived'}`}>{job.enabled !== false ? 'Enabled' : 'Disabled'}</span></td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>{job.nextRun ? new Date(job.nextRun).toLocaleString() : '-'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                        <button className="btn btn-ghost" style={{ fontSize: 'var(--text-xs)' }} onClick={() => handleToggle(job.id || job.jobId, job.enabled !== false)}>
                          {job.enabled !== false ? t('cron.disable') : t('cron.enable')}
                        </button>
                        <button className="btn btn-ghost" style={{ fontSize: 'var(--text-xs)' }} onClick={() => handleTrigger(job.id || job.jobId)}>{t('cron.trigger')}</button>
                        <button className="btn btn-ghost" style={{ fontSize: 'var(--text-xs)' }} onClick={() => handleViewRuns(job.id || job.jobId)}>{t('cron.runs')}</button>
                        <button className="btn btn-ghost" style={{ fontSize: 'var(--text-xs)', color: 'var(--status-red)' }} onClick={() => handleDelete(job.id || job.jobId)}>{t('app.delete')}</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showRuns && (
        <div className="card" style={{ marginTop: 'var(--space-4)' }}>
          <div className="card-header">
            <h2>{t('cron.runs_history')} - {showRuns}</h2>
            <button className="btn btn-ghost" onClick={() => setShowRuns(null)}>✕</button>
          </div>
          <div className="card-body" style={{ maxHeight: 300, overflow: 'auto' }}>
            {runs.length === 0 ? (
              <div className="empty-state-desc">{t('cron.no_runs')}</div>
            ) : runs.map((r: any, i: number) => (
              <div key={i} style={{ padding: 'var(--space-2)', borderBottom: '1px solid var(--border-color)', fontSize: 'var(--text-sm)' }}>
                <span style={{ color: r.ok === false ? 'var(--status-red)' : 'var(--status-green)' }}>{r.ok === false ? '✗' : '✓'}</span>
                {' '}{r.timestamp ? new Date(r.timestamp).toLocaleString() : '-'}{' '}
                <span style={{ color: 'var(--text-muted)' }}>{r.duration ? `${r.duration}ms` : ''}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
