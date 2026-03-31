import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useCronJobs, useConnectionState } from '../hooks/useGateway'
import { gatewayClient } from '../lib/gateway-client'

type ScheduleType = 'cron' | 'at' | 'every'

export function CronPage() {
  const { t } = useTranslation()
  const connState = useConnectionState()
  const { jobs, total, loading, refetch } = useCronJobs()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    name: '',
    scheduleType: 'cron' as ScheduleType,
    cronExpr: '',
    atTime: '',
    everyInterval: '',
    agentId: '',
    message: '',
  })
  const [runs, setRuns] = useState<any[]>([])
  const [showRuns, setShowRuns] = useState<string | null>(null)
  const [error, setError] = useState('')

  const buildPayload = () => {
    let schedule: any = {}
    switch (form.scheduleType) {
      case 'cron':
        schedule = { kind: 'cron', expr: form.cronExpr, tz: 'Asia/Shanghai' }
        break
      case 'at':
        schedule = { kind: 'at', at: form.atTime }
        break
      case 'every':
        schedule = { kind: 'every', everyMs: form.everyInterval ? parseInt(form.everyInterval) * 60000 : undefined }
        break
    }

    const job: any = {
      name: form.name,
      schedule,
      payload: {
        kind: 'agentTurn',
        message: form.message || '',
      },
      sessionTarget: 'isolated',
      wakeMode: 'now',
    }
    if (form.agentId) job.agentId = form.agentId

    return job
  }

  const handleCreate = async () => {
    setError('')
    if (!form.name) { setError(t('cron.err_name')); return }
    if (form.scheduleType === 'cron' && !form.cronExpr) { setError(t('cron.err_schedule')); return }
    if (form.scheduleType === 'at' && !form.atTime) { setError(t('cron.err_at')); return }
    if (form.scheduleType === 'every' && !form.everyInterval) { setError(t('cron.err_every')); return }

    try {
      await gatewayClient.call('cron.add', { job: buildPayload() })
      setShowForm(false)
      setForm({ name: '', scheduleType: 'cron', cronExpr: '', atTime: '', everyInterval: '', agentId: '', message: '' })
      refetch()
    } catch (e: any) {
      setError(e?.message || t('app.error'))
    }
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

  const formatSchedule = (s: any) => {
    if (!s) return '-'
    if (typeof s === 'string') return s
    if (s.kind === 'cron') return `${s.expr} (${s.tz || 'UTC'})`
    if (s.kind === 'at') return `at ${s.at}`
    if (s.kind === 'every') return `every ${s.everyMs ? `${Math.round(s.everyMs / 60000)}min` : '-'}`
    return JSON.stringify(s)
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
        <h1>{t('cron.title')} <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>({total})</span></h1>
        <p className="page-header-desc">{t('cron.subtitle')}</p>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? t('app.cancel') : `+ ${t('cron.new_job')}`}
        </button>
        <button className="btn btn-ghost" onClick={refetch} disabled={loading}>🔄</button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
          <div className="card-header"><h2>{t('cron.create_job')}</h2></div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder={t('cron.form_name')} />

            <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
              <label style={{ fontWeight: 500, minWidth: 80 }}>{t('cron.schedule_type')}:</label>
              <select className="form-input" value={form.scheduleType} onChange={e => setForm({ ...form, scheduleType: e.target.value as ScheduleType })} style={{ minWidth: 120 }}>
                <option value="cron">Cron 表达式</option>
                <option value="at">At 时间</option>
                <option value="every">Every 间隔</option>
              </select>
            </div>

            {form.scheduleType === 'cron' && (
              <input className="form-input" value={form.cronExpr} onChange={e => setForm({ ...form, cronExpr: e.target.value })} placeholder="55 8 * * 1-5" />
            )}
            {form.scheduleType === 'at' && (
              <input className="form-input" type="datetime-local" value={form.atTime} onChange={e => setForm({ ...form, atTime: e.target.value })} />
            )}
            {form.scheduleType === 'every' && (
              <input className="form-input" type="number" value={form.everyInterval} onChange={e => setForm({ ...form, everyInterval: e.target.value })} placeholder="30 (分钟)" min="1" />
            )}

            <input className="form-input" value={form.agentId} onChange={e => setForm({ ...form, agentId: e.target.value })} placeholder="Agent ID (可选，默认 main)" />
            <textarea className="form-input" value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} placeholder="任务消息内容 (Agent Turn)" rows={3} />

            {error && <div style={{ color: 'var(--status-red)', fontSize: 'var(--text-sm)' }}>{error}</div>}
            <button className="btn btn-primary" onClick={handleCreate}>{t('app.create')}</button>
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
                    <td className="mono" style={{ fontSize: 'var(--text-sm)' }}>{formatSchedule(job.schedule)}</td>
                    <td><span className={`badge badge-${job.enabled !== false ? 'active' : 'archived'}`}>{job.enabled !== false ? 'Enabled' : 'Disabled'}</span></td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>{job.nextRun ? new Date(job.nextRun).toLocaleString() : '-'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
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
            <h2>{t('cron.runs_history')}</h2>
            <button className="btn btn-ghost" onClick={() => setShowRuns(null)}>✕</button>
          </div>
          <div className="card-body" style={{ maxHeight: 300, overflow: 'auto' }}>
            {runs.length === 0 ? (
              <div className="empty-state-desc">{t('cron.no_runs')}</div>
            ) : runs.map((r: any, i: number) => (
              <div key={i} style={{ padding: 'var(--space-2)', borderBottom: '1px solid var(--border-color)', fontSize: 'var(--text-sm)' }}>
                <span style={{ color: r.ok === false ? 'var(--status-red)' : 'var(--status-green)' }}>{r.ok === false ? '✗' : '✓'}</span>
                {' '}{r.timestampMs || r.timestamp ? new Date(r.timestampMs || r.timestamp).toLocaleString() : '-'}{' '}
                <span style={{ color: 'var(--text-muted)' }}>{r.durationMs || r.duration ? `${r.durationMs || r.duration}ms` : ''}</span>
                {r.error && <div style={{ color: 'var(--status-red)', fontSize: 'var(--text-xs)' }}>{r.error}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
