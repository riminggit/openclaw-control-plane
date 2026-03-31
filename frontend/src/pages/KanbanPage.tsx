import { useEffect, useState, useCallback, useRef } from 'react'
import { DragDropContext, Droppable, Draggable, type DropResult, type DragStart } from '@hello-pangea/dnd'
import { tasksApi, type TaskItem } from '../api/modules/tasks'
import { gatewayClient } from '../lib/gateway-client'
import { useConnectionState } from '../hooks/useGateway'
import { useTranslation } from 'react-i18next'

// ── Types ──

interface KanbanCard {
  source: 'gateway-session' | 'gateway-cron' | 'local'
  type: 'session' | 'cron' | 'task'
  cardId: string
  label: string
  channel: string
  status: string
  column: string
  totalTokens: number
  updatedAt: string
  extra?: any
}

const SOURCE_COLORS: Record<string, string> = {
  'gateway-session': '#06b6d4',  // cyan
  'gateway-cron': '#f59e0b',     // amber
  'local': '#6b7280',            // gray
}

const KANBAN_COLUMNS = [
  { id: 'planned', color: 'var(--text-muted)' },
  { id: 'in_progress', color: 'var(--status-blue)' },
  { id: 'review', color: 'var(--status-yellow)' },
  { id: 'blocked', color: 'var(--status-red)' },
  { id: 'done', color: 'var(--status-green)' },
]

// ── Mappers ──

function sessionToCard(s: any): KanbanCard {
  const result = s.result || ''
  const status = s.status || s.state || 'running'
  let column = 'in_progress'
  if (result === 'completed' || status === 'completed') column = 'done'
  else if (result === 'failed' || result === 'error') column = 'done'
  else if (status === 'running' || status === 'active') {
    const ua = s.updatedAt || s.updated_at || ''
    if (ua) {
      try {
        const mins = (Date.now() - new Date(ua).getTime()) / 60000
        if (mins > 5) column = 'planned'
      } catch { /* ignore */ }
    }
  } else column = 'planned'

  return {
    source: 'gateway-session', type: 'session',
    cardId: s.key || s.sessionKey || '',
    label: s.label || s.key || '',
    channel: s.channel || '', status: result || status, column,
    totalTokens: s.totalTokens || 0, updatedAt: s.updatedAt || s.updated_at || '',
    extra: s,
  }
}

function cronToCard(c: any): KanbanCard {
  const enabled = c.enabled !== false
  const running = !!c.running
  let column = 'planned'
  if (!enabled) column = 'blocked'
  else if (running) column = 'in_progress'

  return {
    source: 'gateway-cron', type: 'cron',
    cardId: c.id || c.jobId || '',
    label: c.label || c.name || c.id || '',
    channel: '', status: enabled ? 'active' : 'disabled', column,
    totalTokens: 0, updatedAt: c.nextRunAt || c.updatedAt || '',
    extra: c,
  }
}

function taskToCard(t: TaskItem): KanbanCard {
  const statusMap: Record<string, string> = {
    planned: 'planned', in_progress: 'in_progress', review: 'review',
    blocked: 'blocked', done: 'done',
  }
  return {
    source: 'local', type: 'task',
    cardId: t.id, label: t.title,
    channel: t.ownerRole || '', status: t.status,
    column: statusMap[t.status] || 'planned',
    totalTokens: 0, updatedAt: t.updatedAt,
    extra: t,
  }
}

// ── Toast ──

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t) }, [onClose])
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999, padding: '12px 20px',
      borderRadius: 'var(--radius-md)', fontSize: 14, fontWeight: 500,
      background: type === 'success' ? 'var(--status-green)' : 'var(--status-red)',
      color: '#fff', boxShadow: 'var(--shadow-lg)', opacity: 0.95,
    }}>
      {message}
    </div>
  )
}

// ── Component ──

export function KanbanPage() {
  const { t } = useTranslation()
  const connState = useConnectionState()
  const [cards, setCards] = useState<KanbanCard[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalCard, setModalCard] = useState<KanbanCard | null>(null)
  const [modalTargetCol, setModalTargetCol] = useState('')
  const [blockReason, setBlockReason] = useState('')
  const dragRef = useRef<KanbanCard | null>(null)

  // Fetch all data
  const fetchData = useCallback(async () => {
    setLoading(true)
    const allCards: KanbanCard[] = []

    // Fetch local tasks
    try {
      const res = await tasksApi.list()
      res.items.forEach((task) => allCards.push(taskToCard(task)))
    } catch { /* ignore */ }

    // Fetch Gateway sessions
    let sessions: any[] = []
    if (connState === 'connected') {
      try {
        const sessionsRes = await gatewayClient.call('sessions.list')
        sessions = sessionsRes?.items || sessionsRes || []
        sessions.forEach((s: any) => allCards.push(sessionToCard(s)))

        // Sync to backend (kanban + lifecycle)
        fetch('/api/kanban/sync', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessions, crons: [] }),
        }).catch(() => {})
        fetch('/api/agents/lifecycle/sync', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessions }),
        }).catch(() => {})
      } catch { /* ignore */ }

      try {
        const crons = await gatewayClient.call('cron.list')
        const cronList = crons?.items || crons || []
        cronList.forEach((c: any) => allCards.push(cronToCard(c)))

        fetch('/api/kanban/sync', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessions: [], crons: cronList }),
        }).catch(() => {})
      } catch { /* ignore */ }
    } else {
      // Fallback: load from backend cache
      try {
        const res = await fetch('/api/kanban/gateway-cards')
        const data = await res.json()
        if (data.cards) {
          data.cards.forEach((c: any) => allCards.push(c as KanbanCard))
        }
      } catch { /* ignore */ }
    }

    setCards(allCards)
    setLoading(false)
  }, [connState])

  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => {
    const timer = setInterval(fetchData, 30000)
    return () => clearInterval(timer)
  }, [fetchData])

  // ── Execute drag action ──
  const executeDrag = async (card: KanbanCard, targetCol: string, reason?: string) => {
    try {
      const res = await fetch('/api/kanban/drag-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          card_source: card.source,
          card_id: card.cardId,
          from_column: card.column,
          to_column: targetCol,
          reason,
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Drag action failed')

      // Execute real Gateway action if returned
      if (data.action && connState === 'connected') {
        const act = data.action
        if (act.action === 'session.stop') {
          await gatewayClient.call('sessions.stop', { sessionKey: act.session_key })
        } else if (act.action === 'session.send') {
          await gatewayClient.call('sessions.send', { sessionKey: act.session_key, message: act.message })
        } else if (act.action === 'cron.update') {
          await gatewayClient.call('cron.update', { id: act.job_id, enabled: act.enabled })
        } else if (act.action === 'cron.run') {
          await gatewayClient.call('cron.run', { id: act.job_id })
        } else if (act.action === 'task.update') {
          await tasksApi.update(act.task_id, { status: act.new_status })
        }
      }

      setToast({ message: t('kanban.dragSuccess'), type: 'success' })
      // Brief delay then refresh
      setTimeout(fetchData, 500)
    } catch (e: any) {
      setToast({ message: t('kanban.dragFailed') + ': ' + (e.message || ''), type: 'error' })
    }
  }

  // ── DnD handlers ──
  const onDragStart = (start: DragStart) => {
    // Find the card
    const col = KANBAN_COLUMNS.find(c => c.id === start.source.droppableId)
    if (!col) return
    const idx = start.source.index
    const colCards = cards.filter(c => c.column === col!.id)
    if (colCards[idx]) dragRef.current = colCards[idx]
  }

  const onDragEnd = (result: DropResult) => {
    const card = dragRef.current
    dragRef.current = null
    if (!result.destination || !card) return

    const targetCol = result.destination.droppableId
    if (targetCol === card.column) return

    // If dragging to blocked, show modal
    if (targetCol === 'blocked') {
      setModalCard(card)
      setModalTargetCol(targetCol)
      setBlockReason('')
      setModalOpen(true)
      return
    }

    executeDrag(card, targetCol)
  }

  const handleModalConfirm = () => {
    if (modalCard) {
      executeDrag(modalCard, modalTargetCol, blockReason)
    }
    setModalOpen(false)
    setModalCard(null)
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
          {KANBAN_COLUMNS.map(col => (
            <div key={col.id} style={{ flex: 1, minWidth: 220 }}>
              <div className="skeleton" style={{ width: '50%', height: 20, marginBottom: 16 }} />
              {[1, 2, 3].map(i => (
                <div key={i} className="skeleton" style={{ height: 80, borderRadius: 'var(--radius-lg)', marginBottom: 8 }} />
              ))}
            </div>
          ))}
        </div>
      ) : (
        <DragDropContext onDragStart={onDragStart} onDragEnd={onDragEnd}>
          <div className="kanban-board">
            {KANBAN_COLUMNS.map(col => {
              const colCards = cards.filter(c => c.column === col.id)
              return (
                <Droppable key={col.id} droppableId={col.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="kanban-column"
                      style={{
                        borderColor: snapshot.isDraggingOver ? col.color : undefined,
                        background: snapshot.isDraggingOver ? 'var(--bg-surface-hover)' : undefined,
                      }}
                    >
                      <div className="kanban-col-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: col.color }} />
                          <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                            {t(`kanban.${col.id === 'in_progress' ? 'in_progress' : col.id}`)}
                          </span>
                        </div>
                        <span className="badge" style={{ background: 'var(--bg-surface-hover)', color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>
                          {colCards.length}
                        </span>
                      </div>
                      <div className="kanban-cards">
                        {colCards.map((card, idx) => (
                          <Draggable key={`${card.source}-${card.cardId}`} draggableId={`${card.source}-${card.cardId}`} index={idx}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className="kanban-card"
                                style={{
                                  ...provided.draggableProps.style,
                                  opacity: snapshot.isDragging ? 0.85 : 1,
                                  boxShadow: snapshot.isDragging ? 'var(--shadow-lg)' : undefined,
                                  borderLeft: `3px solid ${SOURCE_COLORS[card.source] || '#6b7280'}`,
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                                  <span style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: 'var(--text-sm)', flex: 1 }}>
                                    {card.label}
                                  </span>
                                  <span style={{
                                    fontSize: 10, padding: '1px 6px', borderRadius: 'var(--radius-sm)',
                                    background: SOURCE_COLORS[card.source] + '22', color: SOURCE_COLORS[card.source],
                                    whiteSpace: 'nowrap', flexShrink: 0,
                                  }}>
                                    {card.source === 'gateway-session' ? t('kanban.session')
                                      : card.source === 'gateway-cron' ? t('kanban.cron')
                                      : t('kanban.local')}
                                  </span>
                                </div>
                                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginTop: 6 }}>
                                  {card.channel && (
                                    <span className="badge" style={{ background: 'var(--bg-surface-hover)', color: 'var(--text-muted)', fontSize: 10 }}>
                                      {card.channel}
                                    </span>
                                  )}
                                  {card.totalTokens > 0 && (
                                    <span className="badge" style={{ background: 'var(--bg-surface-hover)', color: 'var(--text-muted)', fontSize: 10 }}>
                                      {card.totalTokens.toLocaleString()} {t('kanban.tokens')}
                                    </span>
                                  )}
                                  {card.source === 'local' && card.extra?.priority && (
                                    <span className={`badge badge-priority-${card.extra.priority}`} style={{ fontSize: 10 }}>
                                      {card.extra.priority}
                                    </span>
                                  )}
                                </div>
                                {card.updatedAt && (
                                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6 }}>
                                    {new Date(card.updatedAt).toLocaleString()}
                                  </div>
                                )}
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {colCards.length === 0 && (
                          <div style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', textAlign: 'center', padding: 'var(--space-8)' }}>
                            {t('kanban.noCards')}
                          </div>
                        )}
                        {provided.placeholder}
                      </div>
                    </div>
                  )}
                </Droppable>
              )
            })}
          </div>
        </DragDropContext>
      )}

      {/* Block Reason Modal */}
      {modalOpen && modalCard && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => setModalOpen(false)}>
          <div style={{
            background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', padding: 24,
            width: 400, maxWidth: '90vw', boxShadow: 'var(--shadow-xl)',
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ color: 'var(--text-primary)', marginBottom: 16, fontSize: 16 }}>{t('kanban.blockReason')}</h3>
            <textarea
              value={blockReason}
              onChange={e => setBlockReason(e.target.value)}
              placeholder={t('kanban.blockReasonPlaceholder')}
              style={{
                width: '100%', minHeight: 80, padding: '10px 12px', borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)', background: 'var(--bg-primary)',
                color: 'var(--text-primary)', fontSize: 14, resize: 'vertical', marginBottom: 16,
              }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>{t('kanban.cancel')}</button>
              <button className="btn btn-primary" onClick={handleModalConfirm}>{t('kanban.confirm')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
