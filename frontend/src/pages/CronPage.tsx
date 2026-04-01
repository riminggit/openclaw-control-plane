import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useCronJobs, useConnectionState } from '../hooks/useGateway'
import { gatewayClient } from '../lib/gateway-client'
import { Button, Input, Select, Card, Empty, Spin, message } from 'antd'
import { Link } from 'react-router-dom'


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
      message.success(t('app.created', '创建成功'))
    } catch (e: any) {
      setError(e?.message || t('app.error'))
      message.error(e?.message || t('app.error'))
    }
  }

  const handleDelete = async (jobId: string) => {
    if (!confirm(t('cron.confirm_delete'))) return
    try {
      await gatewayClient.call('cron.remove', { jobId })
      refetch()
      message.success(t('app.deleted', '删除成功'))
    } catch {
      message.error(t('app.error', '操作失败'))
    }
  }

  const handleToggle = async (jobId: string, enabled: boolean) => {
    try {
      await gatewayClient.call('cron.update', { jobId, patch: { enabled: !enabled } })
      refetch()
      message.success(enabled ? t('cron.disabled', '已禁用') : t('cron.enabled', '已启用'))
    } catch {
      message.error(t('app.error', '操作失败'))
    }
  }

  const handleTrigger = async (jobId: string) => {
    try {
      await gatewayClient.call('cron.run', { jobId })
      message.success(t('cron.triggered', '已触发'))
    } catch {
      message.error(t('app.error', '操作失败'))
    }
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
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-16)', gap: 'var(--space-4)' }}>
        <div style={{ fontSize: '48px', opacity: 0.5 }}>🔌</div>
        <div style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--text-primary)' }}>{t('dashboard.not_connected')}</div>
        <Link to="/settings" className="btn btn-primary" style={{ textDecoration: 'none' }}>{t('gateway.go_settings')}</Link>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <div className="page-eyebrow">{t('cron.eyebrow')}</div>
          <h1 className="page-title">{t('cron.title')} <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>({total})</span></h1>
          <p className="page-subtitle">{t('cron.subtitle')}</p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <Button type="primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? t('app.cancel') : `+ ${t('cron.new_job')}`}
          </Button>
          <Button onClick={refetch} disabled={loading}>{t('app.refresh')}</Button>
        </div>
      </div>

      {/* Create Job Form */}
      {showForm && (
        <Card style={{ marginBottom: 'var(--space-4)' }}>
          <div style={{ marginBottom: 'var(--space-4)', fontSize: 'var(--text-lg)', fontWeight: 600 }}>
            {t('cron.create_job')}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <Input
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder={t('cron.form_name')}
              className="form-input"
            />

            <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
              <label style={{ fontWeight: 500, minWidth: 100, fontSize: 'var(--text-sm)' }}>{t('cron.schedule_type')}:</label>
              <Select value={form.scheduleType} onChange={v => setForm({ ...form, scheduleType: v as ScheduleType })} style={{ minWidth: 150 }}>
                <Select.Option value="cron">Cron 表达式</Select.Option>
                <Select.Option value="at">At 时间</Select.Option>
                <Select.Option value="every">Every 间隔</Select.Option>
              </Select>
            </div>

            {form.scheduleType === 'cron' && (
              <Input
                value={form.cronExpr}
                onChange={e => setForm({ ...form, cronExpr: e.target.value })}
                placeholder="55 8 * * 1-5"
                className="form-input"
              />
            )}
            {form.scheduleType === 'at' && (
              <Input
                type="datetime-local"
                value={form.atTime}
                onChange={e => setForm({ ...form, atTime: e.target.value })}
                className="form-input"
              />
            )}
            {form.scheduleType === 'every' && (
              <Input
                type="number"
                value={form.everyInterval}
                onChange={e => setForm({ ...form, everyInterval: e.target.value })}
                placeholder="30 (分钟)"
                min={1}
                className="form-input"
              />
            )}

            <Input
              value={form.agentId}
              onChange={e => setForm({ ...form, agentId: e.target.value })}
              placeholder="Agent ID (可选，默认 main)"
              className="form-input"
            />
            <Input.TextArea
              value={form.message}
              onChange={e => setForm({ ...form, message: e.target.value })}
              placeholder="任务消息内容 (Agent Turn)"
              autoSize={{ minRows: 3, maxRows: 6 }}
              className="form-input"
            />

            {error && <div style={{ color: 'var(--status-red)', fontSize: 'var(--text-sm)', padding: 'var(--space-2)', background: 'var(--status-red-bg)', borderRadius: 'var(--radius-md)' }}>{error}</div>}
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <Button type="primary" onClick={handleCreate}>{t('app.create')}</Button>
              <Button onClick={() => setShowForm(false)}>{t('app.cancel')}</Button>
            </div>
          </div>
        </Card>
      )}

      {/* Jobs List */}
      <Card styles={{ body: { padding: 0 } }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-10)' }}>
            <Spin size="large" />
          </div>
        ) : !jobs || jobs.length === 0 ? (
          <div style={{ padding: 'var(--space-10)' }}>
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={t('cron.no_jobs')}
              style={{ padding: 'var(--space-8) 0' }}
            >
              <Button type="primary" onClick={() => setShowForm(true)}>
                + {t('cron.new_job')}
              </Button>
            </Empty>
          </div>
        ) : (
          <div className="table-wrapper" style={{ border: 'none' }}>
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
                    <td>
                      <span className={`badge ${job.enabled !== false ? 'badge-active' : 'badge-archived'}`}>
                        {job.enabled !== false ? 'Enabled' : 'Disabled'}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                      {job.nextRun ? new Date(job.nextRun).toLocaleString() : '-'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                        <Button size="small" onClick={() => handleToggle(job.id || job.jobId, job.enabled !== false)}>
                          {job.enabled !== false ? t('cron.disable') : t('cron.enable')}
                        </Button>
                        <Button size="small" onClick={() => handleTrigger(job.id || job.jobId)}>{t('cron.trigger')}</Button>
                        <Button size="small" onClick={() => handleViewRuns(job.id || job.jobId)}>{t('cron.runs')}</Button>
                        <Button size="small" danger onClick={() => handleDelete(job.id || job.jobId)}>{t('app.delete')}</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Runs History */}
      {showRuns && (
        <Card
          style={{ marginTop: 'var(--space-4)' }}
          title={t('cron.runs_history')}
          extra={<Button type="text" onClick={() => setShowRuns(null)}>✕</Button>}
        >
          <div style={{ maxHeight: 300, overflow: 'auto' }}>
            {runs.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('cron.no_runs')} style={{ padding: 'var(--space-6) 0' }} />
            ) : (
              runs.map((r: any, i: number) => (
                <div key={i} style={{ padding: 'var(--space-2)', borderBottom: '1px solid var(--border-default)', fontSize: 'var(--text-sm)' }}>
                  <span style={{ color: r.ok === false ? 'var(--status-red)' : 'var(--status-green)' }}>
                    {r.ok === false ? '✗' : '✓'}
                  </span>
                  {' '}{r.timestampMs || r.timestamp ? new Date(r.timestampMs || r.timestamp).toLocaleString() : '-'}{' '}
                  <span style={{ color: 'var(--text-muted)' }}>
                    {r.durationMs || r.duration ? `${r.durationMs || r.duration}ms` : ''}
                  </span>
                  {r.error && <div style={{ color: 'var(--status-red)', fontSize: 'var(--text-xs)', marginTop: 4 }}>{r.error}</div>}
                </div>
              ))
            )}
          </div>
        </Card>
      )}
    </div>
  )
}
