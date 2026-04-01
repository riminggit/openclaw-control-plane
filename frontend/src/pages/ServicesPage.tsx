import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useConnectionState } from '../hooks/useGateway'
import { Button, Input, Modal, Card } from 'antd'


interface ServiceStatus {
  running: boolean
  pid?: number
  uptime?: string
  version?: string
  latestVersion?: string
  memoryMB?: number
  cpuPercent?: number
  healthMs?: number
}

interface ConfigBackup {
  timestamp: string
  size: string
  filename: string
}

interface ConfigHistoryEntry {
  id: string
  time: string
  summary: string
  user?: string
}

const API = '/api/services'

export function ServicesPage() {
  const { t } = useTranslation()
  const connState = useConnectionState()
  const [status, setStatus] = useState<ServiceStatus | null>(null)
  const [config, setConfig] = useState('')
  const [originalConfig, setOriginalConfig] = useState('')
  const [backups, setBackups] = useState<ConfigBackup[]>([])
  const [configHistory, setConfigHistory] = useState<ConfigHistoryEntry[]>([])
  const [showDiff, setShowDiff] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [confirmAction, setConfirmAction] = useState<string | null>(null)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API}/status`)
      if (res.ok) setStatus(await res.json())
    } catch { /* use ws state */ }
  }, [])

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch(`${API}/config`)
      if (res.ok) {
        const text = await res.text()
        setConfig(text)
        setOriginalConfig(text)
      }
    } catch { /* ignore */ }
  }, [])

  const fetchBackups = useCallback(async () => {
    try {
      const res = await fetch(`${API}/backups`)
      const raw = await res.json()
      setBackups(Array.isArray(raw) ? raw : raw.backups || [])
    } catch { /* ignore */ }
  }, [])

  const fetchConfigHistory = useCallback(async () => {
    try {
      const res = await fetch(`${API}/config/history`)
      if (res.ok) {
        const raw = await res.json()
        setConfigHistory(Array.isArray(raw) ? raw : raw.history || [])
      }
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    Promise.all([fetchStatus(), fetchConfig(), fetchBackups(), fetchConfigHistory()]).finally(() => setLoading(false))
  }, [])

  const handleRestart = async () => {
    setConfirmAction(null)
    try {
      const res = await fetch(`${API}/restart`, { method: 'POST' })
      if (res.ok) { setTimeout(fetchStatus, 2000) }
    } catch { /* ignore */ }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`${API}/config`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: config })
      if (res.ok) { setOriginalConfig(config); fetchStatus() }
    } catch { /* ignore */ }
    setSaving(false)
  }

  const handleSaveAndRestart = async () => {
    setSaving(true)
    try {
      await fetch(`${API}/config`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: config })
      await fetch(`${API}/restart`, { method: 'POST' })
      setTimeout(() => { fetchStatus(); fetchConfig(); setSaving(false) }, 2000)
    } catch { setSaving(false) }
  }

  const handleCreateBackup = async () => {
    try {
      await fetch(`${API}/backups`, { method: 'POST' })
      fetchBackups()
    } catch { /* ignore */ }
  }

  const handleRestore = async (filename: string) => {
    setConfirmAction(null)
    try {
      const res = await fetch(`${API}/backups/restore`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filename }) })
      if (res.ok) { fetchConfig(); fetchBackups() }
    } catch { /* ignore */ }
  }

  const hasChanges = config !== originalConfig
  const displayStatus = status || { running: connState === 'connected' }

  const ConfirmDialog = ({ action, onConfirm, msg }: { action: string; onConfirm: () => void; msg: string }) => (
    <div className="modal-overlay" onClick={() => setConfirmAction(null)}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
        <p style={{ marginBottom: 'var(--space-4)' }}>{msg}</p>
        <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
          <Button onClick={() => setConfirmAction(null)}>{t('app.cancel')}</Button>
          <Button danger onClick={onConfirm}>{t('app.confirm', '确认')}</Button>
        </div>
      </div>
    </div>
  )

  if (loading) return <div className="skeleton" style={{ height: 200 }} />

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {confirmAction === 'restart' && <ConfirmDialog action="restart" onConfirm={handleRestart} msg={t('services.confirm_restart', '确定要重启 Gateway 吗？所有会话将被中断。')} />}
      {confirmAction?.startsWith('restore:') && <ConfirmDialog action="restore" onConfirm={() => handleRestore(confirmAction.split(':')[1])} msg={t('services.confirm_restore', '确定要恢复此备份吗？当前配置将被覆盖。')} />}

      {/* Header */}
      <div className="page-header">
        <div className="page-eyebrow">{t('services.eyebrow', '服务管理')}</div>
        <h1 className="page-title">{t('services.title', '服务管理')}</h1>
        <p className="page-subtitle">{t('services.subtitle', 'Gateway 配置与系统资源监控')}</p>
      </div>

      {/* Status Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 'var(--space-4)' }}>
        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>{t('services.gateway_status', 'Gateway 状态')}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: displayStatus.running ? 'var(--status-green)' : 'var(--status-red)' }} />
            <span style={{ fontWeight: 600 }}>{displayStatus.running ? t('services.running', '运行中') : t('services.stopped', '已停止')}</span>
          </div>
          {displayStatus.running && (
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: 'var(--space-2)' }}>
              PID: {status?.pid || '-'} · {status?.uptime || ''}
            </div>
          )}
        </div>
        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>{t('services.version', '版本信息')}</div>
          <div style={{ fontWeight: 600 }}>{status?.version || '-'}</div>
          {status?.latestVersion && status.version !== status.latestVersion && (
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--status-yellow)', marginTop: 'var(--space-1)' }}>
              {t('services.new_version', '新版本可用')}: {status.latestVersion}
            </div>
          )}
        </div>
        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>{t('services.system_resources', '系统资源')}</div>
          <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
            <div><span style={{ fontWeight: 600 }}>{status?.memoryMB || '-'}</span> <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>MB</span></div>
            <div><span style={{ fontWeight: 600 }}>{status?.cpuPercent || '-'}</span> <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>% CPU</span></div>
          </div>
        </div>
        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>{t('services.health_check', '健康检查')}</div>
          <div style={{ fontWeight: 600 }}>{status?.healthMs ? `${status.healthMs}ms` : '-'}</div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
        <Button danger onClick={() => setConfirmAction('restart')} disabled={!displayStatus.running}>
          {t('services.restart_gateway', '重启 Gateway')}
        </Button>
      </div>

      {/* Config Editor */}
      <div className="card" style={{ padding: 'var(--space-4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
          <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 600 }}>{t('services.config_editor', '配置编辑器')}</h3>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <Button className={`btn ${showDiff ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setShowDiff(!showDiff)} disabled={!hasChanges} style={{ fontSize: 'var(--text-xs)' }}>
              {t('services.diff_view', 'Diff 视图')}
            </Button>
            <Button className={`btn ${showHistory ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setShowHistory(!showHistory); if (!showHistory) fetchConfigHistory() }} style={{ fontSize: 'var(--text-xs)' }}>
              {t('services.config_history', '变更历史')}
            </Button>
          </div>
        </div>

        {/* Diff View */}
        {showDiff && hasChanges && (
          <div style={{ marginBottom: 'var(--space-3)', padding: 'var(--space-3)', background: 'var(--bg-surface-hover)', borderRadius: 'var(--radius-md)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', maxHeight: 200, overflow: 'auto' }}>
            {(() => {
              const oldLines = originalConfig.split('\n')
              const newLines = config.split('\n')
              const maxLen = Math.max(oldLines.length, newLines.length)
              const lines = []
              for (let i = 0; i < maxLen; i++) {
                const o = oldLines[i] ?? ''
                const n = newLines[i] ?? ''
                if (o === n) {
                  lines.push(<div key={i} style={{ color: 'var(--text-muted)' }}><span style={{ color: 'var(--text-muted)', opacity: 0.5, display: 'inline-block', width: 30 }}>{i + 1}</span> {o || ' '}</div>)
                } else {
                  if (o) lines.push(<div key={`${i}-old`} style={{ color: 'var(--status-red)', background: 'var(--status-red-bg)' }}><span style={{ display: 'inline-block', width: 30 }}>-</span>{o}</div>)
                  if (n) lines.push(<div key={`${i}-new`} style={{ color: 'var(--status-green)', background: 'var(--status-green-bg)' }}><span style={{ display: 'inline-block', width: 30 }}>+</span>{n}</div>)
                }
              }
              return lines
            })()}
          </div>
        )}

        {/* Config History */}
        {showHistory && (
          <div style={{ marginBottom: 'var(--space-3)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
            <div style={{ padding: 'var(--space-2) var(--space-3)', background: 'var(--bg-surface-hover)', fontSize: 'var(--text-sm)', fontWeight: 500, borderBottom: '1px solid var(--border-default)' }}>
              {t('services.config_history', '变更历史')}
            </div>
            {configHistory.length === 0 ? (
              <div style={{ padding: 'var(--space-3)', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>{t('services.no_history', '暂无变更记录')}</div>
            ) : (
              <div style={{ maxHeight: 200, overflow: 'auto' }}>
                {configHistory.map(h => (
                  <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-2) var(--space-3)', borderBottom: '1px solid var(--border-default)' }}>
                    <div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{h.summary}</div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{h.time}{h.user ? ` · ${h.user}` : ''}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <Input.TextArea
          value={config}
          onChange={e => setConfig(e.target.value)}
          style={{ width: '100%', minHeight: 300, fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)', resize: 'vertical' }}
          spellCheck={false}
        />
        <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-3)', alignItems: 'center' }}>
          <span className={`badge ${hasChanges ? 'badge-yellow' : 'badge-green'}`} style={{ fontSize: 'var(--text-xs)' }}>
            {hasChanges ? t('services.unsaved', '未保存') : t('services.saved', '已保存')}
          </span>
          <Button type="primary" onClick={handleSave} disabled={!hasChanges || saving}>{t('app.save')}</Button>
          <Button onClick={handleSaveAndRestart} disabled={saving}>
            {saving ? t('app.saving') : t('services.save_and_restart', '保存并重启')}
          </Button>
        </div>
      </div>

      {/* Backups */}
      <div className="card" style={{ padding: 'var(--space-4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
          <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 600 }}>{t('services.backups', '配置备份')}</h3>
          <Button onClick={handleCreateBackup}>{t('services.create_backup', '创建备份')}</Button>
        </div>
        {backups.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>{t('services.no_backups', '暂无备份')}</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {backups.map(b => (
              <div key={b.filename} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-2) var(--space-3)', background: 'var(--bg-surface-hover)', borderRadius: 'var(--radius-sm)' }}>
                <div>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>{b.timestamp}</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{b.size}</div>
                </div>
                <Button onClick={() => setConfirmAction(`restore:${b.filename}`)} style={{ fontSize: 'var(--text-xs)' }}>
                  {t('services.restore', '恢复')}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
