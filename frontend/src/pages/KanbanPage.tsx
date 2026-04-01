import { useEffect, useState, useCallback, useRef } from 'react'
import { DragDropContext, Droppable, Draggable, type DropResult, type DragStart } from '@hello-pangea/dnd'
import { tasksApi, type TaskItem } from '../api/modules/tasks'
import { gatewayClient } from '../lib/gateway-client'
import { useConnectionState } from '../hooks/useGateway'
import { useTranslation } from 'react-i18next'
import { Button, Input, Checkbox, Popconfirm, message, Modal, Form, Select, Progress, Spin } from 'antd'
import { CaretRightOutlined, ClockCircleOutlined } from '@ant-design/icons'

// ── Types ──

interface CronJob {
  id: string
  name: string
  schedule: any
  enabled: boolean
  running: boolean
  nextRun?: string
}

interface RunningTask {
  taskId: string
  title: string
  agentId?: string
  startedAt: number
  status: string // 'running' | 'completed' | 'error'
  progress: number // 0-100
  step?: string
  elapsed: string
}

type TaskStatus = 'planned' | 'running' | 'in_progress' | 'review' | 'blocked' | 'done'

const TASK_COLUMNS: { id: TaskStatus; color: string }[] = [
  { id: 'planned', color: 'var(--text-muted)' },
  { id: 'running', color: 'var(--status-blue)' },
  { id: 'in_progress', color: 'var(--status-blue)' },
  { id: 'review', color: 'var(--status-yellow)' },
  { id: 'blocked', color: 'var(--status-red)' },
  { id: 'done', color: 'var(--status-green)' },
]

// ── Toast ──

function Toast({ msg, type, onClose }: { msg: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t) }, [onClose])
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999, padding: '12px 20px',
      borderRadius: 'var(--radius-md)', fontSize: 14, fontWeight: 500,
      background: type === 'success' ? 'var(--status-green)' : 'var(--status-red)',
      color: '#fff', boxShadow: 'var(--shadow-lg)',
    }}>{msg}</div>
  )
}

// ── Elapsed timer ──

function useElapsedTime(startedAt: number): string {
  const [elapsed, setElapsed] = useState('')
  useEffect(() => {
    const update = () => {
      const diff = Math.floor((Date.now() - startedAt) / 1000)
      const m = Math.floor(diff / 60)
      const s = diff % 60
      setElapsed(`${m}:${s.toString().padStart(2, '0')}`)
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [startedAt])
  return elapsed
}

// ── Task Card ──

function TaskCard({ task, onDelete, selected, onToggleSelect, isDragging, onExecute, isExecuting, selectMode }: {
  task: TaskItem; onDelete: (id: string) => void; selected: boolean; onToggleSelect: () => void; isDragging: boolean
  onExecute?: () => void; isExecuting?: boolean; selectMode?: boolean
}) {
  const { t } = useTranslation()
  const priorityColor: Record<string, string> = { high: 'var(--status-red)', medium: 'var(--status-yellow)', low: 'var(--status-green)' }
  return (
    <div style={{
      background: selected ? 'var(--accent-bg, rgba(59,130,246,0.08))' : 'var(--bg-surface)',
      border: '1px solid var(--border-color)', borderLeft: `3px solid ${priorityColor[task.priority] || 'var(--text-muted)'}`,
      borderRadius: 'var(--radius-lg)', padding: 'var(--space-3)', marginBottom: 'var(--space-2)',
      opacity: isDragging ? 0.85 : 1, boxShadow: isDragging ? 'var(--shadow-lg)' : undefined,
      cursor: 'grab',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        {selectMode && (
          <Checkbox checked={selected} onClick={e => { e.stopPropagation(); onToggleSelect() }} style={{ marginTop: 2 }} />
        )}
        <span style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: 'var(--text-sm)', flex: 1, lineHeight: 1.4 }}>
          {task.title}
        </span>
        <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          {onExecute && task.status !== 'done' && (
            <Button
              type="text"
              size="small"
              icon={isExecuting ? <Spin size="small" /> : <CaretRightOutlined />}
              onClick={e => { e.stopPropagation(); onExecute() }}
              style={{ minWidth: 28, padding: '0 4px', fontSize: 12, color: 'var(--status-blue)' }}
              title={t('kanban.execute', '执行')}
            />
          )}
          <Popconfirm title={t('app.confirm_delete', '确定删除此任务？')} onConfirm={e => { e?.stopPropagation(); onDelete(task.id) }} okText={t('app.delete')} cancelText={t('app.cancel')}>
            <Button type="text" danger size="small" onClick={e => e.stopPropagation()} style={{ minWidth: 24, padding: '0 4px', fontSize: 12 }}>✕</Button>
          </Popconfirm>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginTop: 6 }}>
        {task.priority && (
          <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 'var(--radius-sm)', background: (priorityColor[task.priority] || '#6b7280') + '22', color: priorityColor[task.priority] || '#6b7280' }}>
            {task.priority}
          </span>
        )}
        {task.ownerRole && (
          <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface-hover)', color: 'var(--text-muted)' }}>
            {task.ownerRole}
          </span>
        )}
        {task.category && (
          <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface-hover)', color: 'var(--text-muted)' }}>
            {task.category}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Running Task Card ──

function RunningTaskCard({ rt }: { rt: RunningTask }) {
  const { t } = useTranslation()
  const elapsed = useElapsedTime(rt.startedAt)
  return (
    <div style={{
      background: 'var(--bg-surface)', border: '1px solid var(--border-color)',
      borderLeft: '3px solid var(--status-blue)', borderRadius: 'var(--radius-lg)',
      padding: 'var(--space-3)', marginBottom: 'var(--space-2)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: 'var(--text-sm)', flex: 1 }}>
          {rt.title}
        </span>
        {rt.status === 'running' && <Spin size="small" />}
        {rt.status === 'completed' && <span style={{ color: 'var(--status-green)', fontSize: 12 }}>✓</span>}
        {rt.status === 'error' && <span style={{ color: 'var(--status-red)', fontSize: 12 }}>✕</span>}
      </div>
      <Progress percent={rt.progress} size="small" strokeColor={rt.status === 'error' ? 'var(--status-red)' : undefined} />
      {rt.step && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{rt.step}</div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <ClockCircleOutlined /> {elapsed}
        </span>
        {rt.agentId && (
          <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface-hover)', color: 'var(--text-muted)' }}>
            {rt.agentId}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Cron Card ──

function CronCard({ job, onToggle, onTrigger, onDelete }: { job: CronJob; onToggle: (id: string, enabled: boolean) => void; onTrigger: (id: string) => void; onDelete: (id: string) => void }) {
  const { t } = useTranslation()
  const formatSchedule = (s: any) => {
    if (!s) return '-'
    if (typeof s === 'string') return s
    if (s.kind === 'cron') return `${s.expr} (${s.tz || 'UTC'})`
    if (s.kind === 'at') return `at ${s.at}`
    if (s.kind === 'every') return `every ${s.everyMs ? `${Math.round(s.everyMs / 60000)}min` : '-'}`
    return JSON.stringify(s)
  }
  return (
    <div style={{
      background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderLeft: '3px solid #f59e0b',
      borderRadius: 'var(--radius-lg)', padding: 'var(--space-3)', marginBottom: 'var(--space-2)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: 'var(--text-sm)' }}>{job.name || job.id}</div>
          <div style={{ fontFamily: 'monospace', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 4 }}>
            {formatSchedule(job.schedule)}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <Button type="text" size="small" onClick={() => onTrigger(job.id)} style={{ fontSize: 12 }}>▶</Button>
          <Button
            type="text" size="small"
            onClick={() => onToggle(job.id, job.enabled)}
            style={{ fontSize: 12, color: job.enabled ? 'var(--status-green)' : 'var(--text-muted)' }}
          >
            {job.enabled ? '●' : '○'}
          </Button>
          <Popconfirm title={t('app.confirm_delete', '确定删除此定时任务？')} onConfirm={() => onDelete(job.id)} okText={t('app.delete')} cancelText={t('app.cancel')}>
            <Button type="text" danger size="small" onClick={e => e.stopPropagation()} style={{ minWidth: 24, padding: '0 4px', fontSize: 12 }}>✕</Button>
          </Popconfirm>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
        <span style={{
          fontSize: 10, padding: '1px 6px', borderRadius: 'var(--radius-sm)',
          background: job.enabled ? 'rgba(34,197,94,0.15)' : 'rgba(107,114,128,0.15)',
          color: job.enabled ? 'var(--status-green)' : 'var(--text-muted)',
        }}>
          {job.enabled ? t('cron.active', 'Active') : t('cron.disabled', 'Disabled')}
        </span>
        {job.running && (
          <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 'var(--radius-sm)', background: 'rgba(59,130,246,0.15)', color: 'var(--status-blue)' }}>
            {t('cron.running', 'Running')}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Column Header ──

function ColumnHeader({ col, count, allSelected, someSelected, onSelectAll, selectMode }: {
  col: { id: string; color: string }; count: number; allSelected: boolean; someSelected: boolean; onSelectAll: () => void; selectMode?: boolean
}) {
  const { t } = useTranslation()
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: col.color }} />
        <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 'var(--text-sm)' }}>
          {t(`kanban.${col.id === 'in_progress' ? 'in_progress' : col.id}`)}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {selectMode && count > 0 && (
          <Checkbox checked={allSelected} indeterminate={someSelected} onChange={onSelectAll} style={{ fontSize: 12 }} />
        )}
        <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-surface-hover)', padding: '2px 8px', borderRadius: 'var(--radius-sm)' }}>
          {count}
        </span>
      </div>
    </div>
  )
}

// ── Main Component ──

export function KanbanPage() {
  const { t } = useTranslation()
  const connState = useConnectionState()
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [crons, setCrons] = useState<CronJob[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [selectMode, setSelectMode] = useState(false)
  const [blockModal, setBlockModal] = useState<{ card: TaskItem; target: string } | null>(null)
  const [blockReason, setBlockReason] = useState('')
  const [dragRef, setDragRef] = useState<{ task: TaskItem; fromCol: string } | null>(null)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [createForm] = Form.useForm()

  // Execution state
  const [runningTasks, setRunningTasks] = useState<RunningTask[]>([])
  const [executingIds, setExecutingIds] = useState<Set<string>>(new Set())
  const runningRef = useRef<RunningTask[]>([])

  // ── Status matching ──
  const statusMatch = (s: string) => s?.toLowerCase().replace(/[\s_-]/g, '_')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await tasksApi.list()
      const items = Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : []
      setTasks(items)
    } catch { setTasks([]) }

    if (connState === 'connected') {
      try {
        const res = await gatewayClient.call('cron.list', { includeDisabled: true })
        const jobs: CronJob[] = Array.isArray(res) ? res : Array.isArray(res?.jobs) ? res.jobs : Array.isArray(res?.cards) ? res.cards : Array.isArray(res?.crons) ? res.crons : []
        setCrons(jobs)
      } catch { setCrons([]) }
    }
    setLoading(false)
  }, [connState])

  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => { const t = setInterval(fetchData, 30000); return () => clearInterval(t) }, [fetchData])

  // ── Listen for Gateway events (session progress) ──
  useEffect(() => {
    if (connState !== 'connected') return
    const unsub = gatewayClient.on('session.output', (payload: any) => {
      // Check if this session matches one of our running tasks
      setRunningTasks(prev => {
        const updated = prev.map(rt => {
          if (rt.status !== 'running') return rt
          // We use taskId matching via session metadata or agent correlation
          // For now, update progress heuristically
          return rt
        })
        runningRef.current = updated
        return updated
      })
    })

    const unsub2 = gatewayClient.on('session.end', (payload: any) => {
      setRunningTasks(prev => {
        const updated = prev.map(rt => {
          if (rt.status !== 'running') return rt
          // Mark as completed
          return { ...rt, status: 'completed' as const, progress: 100, step: t('kanban.completed', '已完成') }
        })
        runningRef.current = updated
        return updated
      })
      // Clean up completed tasks after a delay
      setTimeout(() => {
        setRunningTasks(prev => {
          const filtered = prev.filter(rt => rt.status === 'running')
          runningRef.current = filtered
          return filtered
        })
        setExecutingIds(prev => { const n = new Set(prev); return n })
      }, 5000)
    })

    return () => { unsub(); unsub2() }
  }, [connState, t])

  // ── Simulate progress for running tasks (placeholder until Gateway provides real progress) ──
  useEffect(() => {
    const id = setInterval(() => {
      setRunningTasks(prev => prev.map(rt => {
        if (rt.status !== 'running') return rt
        const elapsed = (Date.now() - rt.startedAt) / 1000
        const newProgress = Math.min(90, Math.floor(elapsed / 2))
        const steps = [
          t('kanban.step_analyzing', '分析任务中...'),
          t('kanban.step_planning', '制定执行计划...'),
          t('kanban.step_executing', '执行中...'),
          t('kanban.step_verifying', '验证结果...'),
        ]
        const stepIdx = Math.min(Math.floor(elapsed / 15), steps.length - 1)
        return { ...rt, progress: newProgress, step: steps[stepIdx] }
      }))
    }, 3000)
    return () => clearInterval(id)
  }, [t])

  // ── Execute task ──
  const handleExecute = async (task: TaskItem) => {
    if (connState !== 'connected') {
      message.warning(t('kanban.notConnected', 'Gateway 未连接'))
      return
    }

    const agentId = task.ownerRole || 'main'
    setExecutingIds(prev => { const n = new Set(prev); n.add(task.id); return n })

    const rt: RunningTask = {
      taskId: task.id,
      title: task.title,
      agentId,
      startedAt: Date.now(),
      status: 'running',
      progress: 0,
      step: t('kanban.step_starting', '启动中...'),
      elapsed: '0:00',
    }

    setRunningTasks(prev => {
      const updated = [...prev, rt]
      runningRef.current = updated
      return updated
    })

    // Move task to running status
    try {
      await tasksApi.update(task.id, { status: 'running' })
    } catch { /* ignore */ }

    // Try to send message to agent via Gateway
    try {
      await gatewayClient.call('chat.send', {
        agent: agentId,
        message: task.description || task.title,
        taskId: task.id,
      })
    } catch {
      // Fallback: try cron.trigger approach
      try {
        await gatewayClient.call('agent.run', {
          taskId: task.id,
          agentId,
          message: task.description || task.title,
        })
      } catch (e: any) {
        message.error(t('kanban.executeFailed', '执行失败') + ': ' + (e.message || ''))
        setRunningTasks(prev => prev.filter(r => r.taskId !== task.id))
        setExecutingIds(prev => { const n = new Set(prev); n.delete(task.id); return n })
      }
    }

    setTimeout(fetchData, 1000)
  }

  // ── Task operations ──
  const handleDeleteTask = async (id: string) => {
    try {
      await tasksApi.delete(id)
      setTasks(prev => prev.filter(t => t.id !== id))
      setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n })
      message.success(t('app.deleted', '已删除'))
    } catch { message.error(t('app.error')) }
  }

  const handleBatchDelete = async () => {
    const ids = Array.from(selectedIds)
    try {
      await Promise.all(ids.map(id => tasksApi.delete(id)))
      setTasks(prev => prev.filter(t => !selectedIds.has(t.id)))
      setSelectedIds(new Set())
      message.success(t('app.batch_deleted', `已删除 ${ids.length} 个任务`))
    } catch { message.error(t('app.error')) }
  }

  const handleDragUpdate = async (task: TaskItem, newStatus: string, reason?: string) => {
    try {
      await tasksApi.update(task.id, { status: newStatus })
      setToast({ msg: t('kanban.dragSuccess'), type: 'success' })
      setTimeout(fetchData, 300)
    } catch (e: any) {
      setToast({ msg: (e.message || t('kanban.dragFailed')), type: 'error' })
    }
  }

  // ── Cron operations ──
  const handleToggleCron = async (id: string, enabled: boolean) => {
    try { await gatewayClient.call('cron.update', { jobId: id, patch: { enabled: !enabled } }); fetchData() } catch { /* */ }
  }
  const handleTriggerCron = async (id: string) => {
    try { await gatewayClient.call('cron.run', { jobId: id }) } catch { /* */ }
  }
  const handleDeleteCron = async (id: string) => {
    try { await gatewayClient.call('cron.remove', { jobId: id }); fetchData(); message.success(t('app.deleted', '已删除')) } catch { message.error(t('app.error')) }
  }
  const handleCreateTask = async (values: any) => {
    try {
      await tasksApi.create(values)
      setCreateModalOpen(false)
      createForm.resetFields()
      fetchData()
      message.success(t('kanban.createSuccess', '任务已创建'))
    } catch { message.error(t('app.error')) }
  }

  // ── Selection ──
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  const selectAllInColumn = (colId: TaskStatus) => {
    const colTasks = tasks.filter(t => statusMatch(t.status) === colId)
    const allSelected = colTasks.length > 0 && colTasks.every(t => selectedIds.has(t.id))
    setSelectedIds(prev => {
      const n = new Set(prev)
      colTasks.forEach(t => allSelected ? n.delete(t.id) : n.add(t.id))
      return n
    })
  }

  // ── DnD ──
  const onDragStart = (start: DragStart) => {
    const colId = start.source.droppableId as TaskStatus
    const colTasks = tasks.filter(t => statusMatch(t.status) === colId)
    const card = colTasks[start.source.index]
    if (card) setDragRef({ task: card, fromCol: colId })
  }

  const onDragEnd = (result: DropResult) => {
    const ref = dragRef
    setDragRef(null)
    if (!result.destination || !ref) return
    const targetCol = result.destination.droppableId as TaskStatus
    if (targetCol === ref.fromCol) return
    if (targetCol === 'blocked') {
      setBlockModal({ card: ref.task, target: targetCol })
    } else {
      handleDragUpdate(ref.task, targetCol)
    }
  }

  const allTasksSelected = tasks.length > 0 && tasks.every(t => selectedIds.has(t.id))

  // DnD columns (exclude 'running' since it's virtual)
  const dndColumns = TASK_COLUMNS.filter(c => c.id !== 'running')

  return (
    <div>
      <div className="page-header">
        <p className="page-header-eyebrow">{t('kanban.eyebrow')}</p>
        <h1>{t('kanban.title')}</h1>
        <p className="page-header-desc">{t('kanban.subtitle')}</p>
        <div style={{ marginTop: 12, marginBottom: 8, display: 'flex', gap: 8 }}>
          <Button type="primary" onClick={() => setCreateModalOpen(true)}>+ {t('kanban.createTask', '新建任务')}</Button>
          <Button
            type={selectMode ? 'primary' : 'default'}
            danger={selectMode}
            onClick={() => { setSelectMode(!selectMode); if (selectMode) setSelectedIds(new Set()) }}
          >
            {selectMode ? '✓ ' + t('kanban.done', '完成') : '☐ ' + t('kanban.manage', '管理')}
          </Button>
        </div>
      </div>

      {/* Running tasks banner */}
      {runningTasks.length > 0 && (
        <div style={{
          marginBottom: 'var(--space-4)',
          background: 'var(--bg-secondary, rgba(0,0,0,0.02))',
          borderRadius: 'var(--radius-lg)', padding: 'var(--space-3)',
          border: '1px solid var(--border-color)', borderLeft: '3px solid var(--status-blue)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 'var(--space-3)' }}>
            <Spin size="small" />
            <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 'var(--text-sm)' }}>
              {t('kanban.running', '执行中')}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-surface-hover)', padding: '2px 8px', borderRadius: 'var(--radius-sm)' }}>
              {runningTasks.length}
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-2)' }}>
            {runningTasks.map(rt => <RunningTaskCard key={rt.taskId} rt={rt} />)}
          </div>
        </div>
      )}

      {/* Batch action bar */}
      {selectMode && selectedIds.size > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', marginBottom: 'var(--space-4)',
          background: 'var(--accent-bg, rgba(59,130,246,0.08))', borderRadius: 'var(--radius-md)',
          border: '1px solid rgba(59,130,246,0.2)', flexWrap: 'wrap',
        }}>
          <Checkbox checked={allTasksSelected} indeterminate={selectedIds.size > 0 && !allTasksSelected} onChange={() => {
            setSelectedIds(allTasksSelected ? new Set() : new Set(tasks.map(t => t.id)))
          }}>
            <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{t('app.select_all', '全选')}</span>
          </Checkbox>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{selectedIds.size} {t('app.selected', '已选')}</span>
          <Popconfirm
            title={t('app.confirm_batch_delete', `确定删除 ${selectedIds.size} 个任务？`)}
            onConfirm={handleBatchDelete}
            okText={t('app.delete')}
            cancelText={t('app.cancel')}
          >
            <Button danger size="small">{t('app.batch_delete', '批量删除')}</Button>
          </Popconfirm>
          <Button size="small" onClick={() => setSelectedIds(new Set())}>{t('app.cancel')}</Button>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
          {dndColumns.map(col => (
            <div key={col.id} style={{ flex: '1 1 240px', minWidth: 220, maxWidth: 360 }}>
              <div className="skeleton" style={{ width: '50%', height: 20, marginBottom: 16 }} />
              {[1, 2, 3].map(i => (
                <div key={i} className="skeleton" style={{ height: 80, borderRadius: 'var(--radius-lg)', marginBottom: 8 }} />
              ))}
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Task columns — NO horizontal scroll */}
          <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', marginBottom: 'var(--space-4)' }}>
            <DragDropContext onDragStart={onDragStart} onDragEnd={onDragEnd}>
              {dndColumns.map(col => {
                const colTasks = tasks.filter(t => statusMatch(t.status) === col.id)
                return (
                  <Droppable key={col.id} droppableId={col.id}>
                    {(provided, snapshot) => (
                      <div ref={provided.innerRef} {...provided.droppableProps} style={{
                        flex: '1 1 240px', minWidth: 0,
                        background: snapshot.isDraggingOver ? 'var(--bg-surface-hover)' : 'var(--bg-secondary, rgba(0,0,0,0.02))',
                        borderRadius: 'var(--radius-lg)', padding: 'var(--space-3)',
                        border: '1px solid var(--border-color)',
                        borderColor: snapshot.isDraggingOver ? col.color : undefined,
                        transition: 'background 0.15s',
                      }}>
                        <ColumnHeader
                          col={col}
                          count={colTasks.length}
                          allSelected={colTasks.length > 0 && colTasks.every(t => selectedIds.has(t.id))}
                          someSelected={colTasks.some(t => selectedIds.has(t.id)) && !colTasks.every(t => selectedIds.has(t.id))}
                          onSelectAll={() => selectAllInColumn(col.id)}
                          selectMode={selectMode}
                        />
                        {colTasks.map((task, idx) => (
                          <Draggable key={task.id} draggableId={task.id} index={idx}>
                            {(prov, snap) => (
                              <div ref={prov.innerRef} {...prov.draggableProps} {...prov.dragHandleProps}>
                                <TaskCard
                                  task={task}
                                  onDelete={handleDeleteTask}
                                  selected={selectedIds.has(task.id)}
                                  onToggleSelect={() => toggleSelect(task.id)}
                                  isDragging={snap.isDragging}
                                  onExecute={() => handleExecute(task)}
                                  isExecuting={executingIds.has(task.id)}
                                  selectMode={selectMode}
                                />
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {colTasks.length === 0 && (
                          <div style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', textAlign: 'center', padding: 'var(--space-8)' }}>
                            {t('kanban.noCards')}
                          </div>
                        )}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                )
              })}
            </DragDropContext>
          </div>

          {/* Cron Jobs — BELOW task columns */}
          {crons.length > 0 && (
            <div style={{
              background: 'var(--bg-secondary, rgba(0,0,0,0.02))',
              borderRadius: 'var(--radius-lg)', padding: 'var(--space-3)',
              border: '1px solid var(--border-color)', borderLeft: '3px solid #f59e0b',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ClockCircleOutlined style={{ color: '#f59e0b' }} />
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                    {t('cron.title', '定时任务')}
                  </span>
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-surface-hover)', padding: '2px 8px', borderRadius: 'var(--radius-sm)' }}>
                  {crons.length}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-2)' }}>
                {crons.map(job => (
                  <CronCard key={job.id} job={job} onToggle={handleToggleCron} onTrigger={handleTriggerCron} onDelete={handleDeleteCron} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Block Reason Modal */}
      <Modal
        open={!!blockModal}
        title={t('kanban.blockReason')}
        onCancel={() => { setBlockModal(null); setBlockReason('') }}
        onOk={() => { if (blockModal) { handleDragUpdate(blockModal.card, blockModal.target, blockReason); setBlockModal(null); setBlockReason('') } }}
        okText={t('kanban.confirm')}
        cancelText={t('kanban.cancel')}
      >
        <Input.TextArea value={blockReason} onChange={e => setBlockReason(e.target.value)}
          placeholder={t('kanban.blockReasonPlaceholder')} style={{ width: '100%', minHeight: 80 }} />
      </Modal>

      {/* Create Task Modal */}
      <Modal
        open={createModalOpen}
        title={t('kanban.createTask', '新建任务')}
        onCancel={() => { setCreateModalOpen(false); createForm.resetFields() }}
        onOk={() => createForm.submit()}
        okText={t('kanban.confirm')}
        cancelText={t('kanban.cancel')}
      >
        <Form form={createForm} layout="vertical" onFinish={handleCreateTask}>
          <Form.Item name="title" label={t('kanban.taskTitle', '标题')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label={t('kanban.taskDesc', '描述')}>
            <Input.TextArea />
          </Form.Item>
          <Form.Item name="priority" label={t('kanban.priority', '优先级')}>
            <Select options={[
              { value: 'high', label: 'High' },
              { value: 'medium', label: 'Medium' },
              { value: 'low', label: 'Low' },
            ]} />
          </Form.Item>
          <Form.Item name="status" label={t('kanban.status', '状态')} initialValue="planned">
            <Select options={dndColumns.map(c => ({ value: c.id, label: t(`kanban.${c.id === 'in_progress' ? 'in_progress' : c.id}`) }))} />
          </Form.Item>
          <Form.Item name="project_id" label={t('kanban.projectId', '项目ID')}>
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
