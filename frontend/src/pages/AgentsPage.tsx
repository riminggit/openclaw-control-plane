import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { agentsMgmtApi, type Agent } from '../api/modules/agentsMgmt'

type ViewMode = 'card' | 'table'

const AGENT_TEMPLATES: { name: string; model: string; thinking: boolean; prompt: string }[] = [
  { name: '通用助手', model: 'zhipu/GLM-5-Turbo', thinking: false, prompt: '你是一个有帮助的 AI 助手。' },
  { name: '代码专家', model: 'zhipu/GLM-5-Turbo', thinking: true, prompt: '你是一个资深全栈开发专家，擅长代码审查、架构设计和问题排查。' },
  { name: '文档写作', model: 'zhipu/GLM-5-Turbo', thinking: false, prompt: '你是一个专业文档写手，擅长技术文档、用户手册和 API 文档。' },
  { name: '数据分析', model: 'zhipu/GLM-5-Turbo', thinking: true, prompt: '你是一个数据分析师，擅长统计分析、可视化解读和数据建模。' },
]

const MODELS = [
  'zhipu/GLM-5-Turbo', 'zhipu/GLM-5', 'openai/gpt-4o', 'openai/gpt-4o-mini',
  'anthropic/claude-sonnet-4-20250514', 'anthropic/claude-haiku-4-20250414',
]

const CHANNEL_ICONS: Record<string, string> = {
  telegram: '✈️', discord: '🎮', qqbot: '🐧', feishu: '🐦', dingtalk: '💬', signal: '🔒', slack: '📱',
}

export function AgentsPage() {
  const { t } = useTranslation()
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('card')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [testMsg, setTestMsg] = useState('')
  const [testingId, setTestingId] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<{ agentId: string; result: string } | null>(null)

  // Form state
  const [formName, setFormName] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [formModel, setFormModel] = useState(MODELS[0])
  const [formThinking, setFormThinking] = useState(false)
  const [formPrompt, setFormPrompt] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchAgents = useCallback(async () => {
    try {
      setLoading(true)
      const list = await agentsMgmtApi.list()
      setAgents(Array.isArray(list) ? list : [])
    } catch {
      setAgents([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAgents() }, [fetchAgents])

  const resetForm = () => {
    setFormName(''); setFormDesc(''); setFormModel(MODELS[0]); setFormThinking(false); setFormPrompt('')
    setEditingAgent(null)
  }

  const openCreate = () => { resetForm(); setModalOpen(true) }

  const openEdit = (agent: Agent) => {
    setEditingAgent(agent)
    setFormName(agent.name); setFormDesc(agent.description || ''); setFormModel(agent.model)
    setFormThinking(!!agent.thinking); setFormPrompt(agent.systemPrompt || '')
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!formName.trim()) return
    setSaving(true)
    try {
      if (editingAgent) {
        await agentsMgmtApi.update(editingAgent.id, { name: formName, description: formDesc, model: formModel, thinking: formThinking, systemPrompt: formPrompt })
      } else {
        await agentsMgmtApi.create({ name: formName, description: formDesc, model: formModel, thinking: formThinking, systemPrompt: formPrompt })
      }
      setModalOpen(false); resetForm(); fetchAgents()
    } catch (e: any) {
      alert(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await agentsMgmtApi.remove(id)
      setDeleteConfirm(null); fetchAgents()
    } catch (e: any) {
      alert(e.message)
    }
  }

  const handleTest = async (id: string) => {
    if (!testMsg.trim()) return
    setTestingId(id); setTestResult(null)
    try {
      // Use agents-mgmt test endpoint or fallback
      const res = await fetch(`/api/agents-mgmt/${id}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: testMsg }),
      })
      const data = await res.json()
      setTestResult({ agentId: id, result: data.reply || data.message || JSON.stringify(data) })
    } catch (e: any) {
      setTestResult({ agentId: id, result: `Error: ${e.message}` })
    } finally {
      setTestingId(null)
    }
  }

  const applyTemplate = (tpl: typeof AGENT_TEMPLATES[0]) => {
    setFormName(tpl.name); setFormModel(tpl.model); setFormThinking(tpl.thinking); setFormPrompt(tpl.prompt)
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <div className="page-eyebrow">{t('agents_mgmt.eyebrow')}</div>
          <h1 className="page-title">{t('agents_mgmt.title')}</h1>
          <p className="page-subtitle">{t('agents_mgmt.subtitle')}</p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
          <div style={{ display: 'flex', background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', overflow: 'hidden' }}>
            <button onClick={() => setViewMode('card')} style={{ padding: '6px 12px', background: viewMode === 'card' ? 'var(--accent-muted)' : 'transparent', border: 'none', color: viewMode === 'card' ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer', fontSize: 'var(--text-sm)' }}>📦</button>
            <button onClick={() => setViewMode('table')} style={{ padding: '6px 12px', background: viewMode === 'table' ? 'var(--accent-muted)' : 'transparent', border: 'none', color: viewMode === 'table' ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer', fontSize: 'var(--text-sm)' }}>📋</button>
          </div>
          <button className="btn btn-primary" onClick={openCreate}>+ {t('agents_mgmt.add_agent')}</button>
        </div>
      </div>

      {loading ? (
        <div className="skeleton-grid"><div className="skeleton-card" /><div className="skeleton-card" /><div className="skeleton-card" /></div>
      ) : agents.length === 0 ? (
        <div className="empty-state"><div className="empty-state-icon">🤖</div><div className="empty-state-title">{t('agents_mgmt.no_agents')}</div><div className="empty-state-desc">{t('agents_mgmt.create_hint')}</div></div>
      ) : viewMode === 'card' ? (
        <div className="card-grid">
          {agents.map((agent) => (
            <div key={agent.id} className="card" style={{ cursor: 'pointer' }} onClick={() => openEdit(agent)}>
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: agent.status === 'online' ? 'var(--status-green)' : 'var(--status-gray)', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 'var(--text-lg)' }}>{agent.name}</div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{agent.id}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }} onClick={e => e.stopPropagation()}>
                  <button className="btn btn-ghost btn-sm" onClick={() => setDeleteConfirm(agent.id)} title={t('app.delete')}>🗑️</button>
                </div>
              </div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 'var(--space-3) 0', lineHeight: 1.4 }}>
                {agent.description || agent.systemPrompt?.slice(0, 100) || '—'}
              </div>
              <div className="card-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--border-default)' }}>
                <span className="badge" style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}>{agent.model}</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  {(agent.channels || []).map(ch => (
                    <span key={ch} className="badge" style={{ background: 'var(--bg-surface-active)', color: 'var(--text-secondary)', fontSize: 'var(--text-xs)' }}>
                      {CHANNEL_ICONS[ch] || ''} {ch}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-default)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
            <thead><tr style={{ borderBottom: '1px solid var(--border-default)' }}>
              {['agents_mgmt.col_name', 'agents_mgmt.col_model', 'agents_mgmt.col_status', 'agents_mgmt.col_channels', 'agents_mgmt.col_updated', ''].map((k, i) => (
                <th key={i} style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 500 }}>{t(k)}</th>
              ))}
            </tr></thead>
            <tbody>
              {agents.map(agent => (
                <tr key={agent.id} style={{ borderBottom: '1px solid var(--border-default)', cursor: 'pointer' }} onClick={() => openEdit(agent)}>
                  <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: agent.status === 'online' ? 'var(--status-green)' : 'var(--status-gray)' }} />
                      <span style={{ fontWeight: 500 }}>{agent.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--text-secondary)' }}>{agent.model}</td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                    <span className="badge" style={{ background: agent.status === 'online' ? 'var(--status-green-bg)' : 'var(--status-gray-bg)', color: agent.status === 'online' ? 'var(--status-green)' : 'var(--status-gray)' }}>
                      {agent.status === 'online' ? '🟢 Online' : '⚫ Offline'}
                    </span>
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                    <div style={{ display: 'flex', gap: 4 }}>{(agent.channels || []).map(ch => <span key={ch} className="badge" style={{ fontSize: 'var(--text-xs)' }}>{CHANNEL_ICONS[ch] || ''}{ch}</span>)}</div>
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>{agent.updatedAt || '—'}</td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                    <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); setDeleteConfirm(agent.id) }}>🗑️</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Modal */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 600 }}>{editingAgent ? t('agents_mgmt.edit_agent') : t('agents_mgmt.add_agent')}</h2>
              <button className="btn btn-ghost" onClick={() => setModalOpen(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {!editingAgent && (
                <div>
                  <label style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', display: 'block', marginBottom: 'var(--space-2)' }}>{t('agents_mgmt.template')}</label>
                  <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                    {AGENT_TEMPLATES.map((tpl, i) => (
                      <button key={i} className="btn btn-ghost btn-sm" onClick={() => applyTemplate(tpl)} style={{ border: '1px solid var(--border-default)' }}>{tpl.name}</button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <label style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', display: 'block', marginBottom: 'var(--space-2)' }}>{t('agents_mgmt.field_name')} *</label>
                <input className="input" value={formName} onChange={e => setFormName(e.target.value)} placeholder={t('agents_mgmt.name_placeholder')} />
              </div>
              <div>
                <label style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', display: 'block', marginBottom: 'var(--space-2)' }}>{t('agents_mgmt.field_desc')}</label>
                <input className="input" value={formDesc} onChange={e => setFormDesc(e.target.value)} placeholder={t('agents_mgmt.desc_placeholder')} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 'var(--space-4)', alignItems: 'end' }}>
                <div>
                  <label style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', display: 'block', marginBottom: 'var(--space-2)' }}>{t('agents_mgmt.field_model')}</label>
                  <select className="input" value={formModel} onChange={e => setFormModel(e.target.value)}>
                    {MODELS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                  <input type="checkbox" checked={formThinking} onChange={e => setFormThinking(e.target.checked)} />
                  Thinking
                </label>
              </div>
              <div>
                <label style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', display: 'block', marginBottom: 'var(--space-2)' }}>{t('agents_mgmt.field_prompt')}</label>
                <textarea className="input" value={formPrompt} onChange={e => setFormPrompt(e.target.value)} rows={5} placeholder={t('agents_mgmt.prompt_placeholder')} style={{ resize: 'vertical' }} />
              </div>
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', padding: 'var(--space-4)', borderTop: '1px solid var(--border-default)' }}>
              <button className="btn btn-ghost" onClick={() => setModalOpen(false)}>{t('app.cancel')}</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={!formName.trim() || saving}>{saving ? t('app.saving') : t('app.save')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-body" style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 'var(--space-3)' }}>⚠️</div>
              <h3 style={{ marginBottom: 'var(--space-2)' }}>{t('agents_mgmt.confirm_delete')}</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>{t('agents_mgmt.confirm_delete_desc')}</p>
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-3)', padding: 'var(--space-4)', borderTop: '1px solid var(--border-default)' }}>
              <button className="btn btn-ghost" onClick={() => setDeleteConfirm(null)}>{t('app.cancel')}</button>
              <button className="btn" style={{ background: 'var(--status-red)', color: '#fff' }} onClick={() => handleDelete(deleteConfirm)}>{t('app.delete')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Test Agent Modal */}
      {testingId && (
        <div className="modal-overlay" onClick={() => { setTestingId(null); setTestResult(null) }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 'var(--text-lg)' }}>🧪 {t('agents_mgmt.test_agent')}</h2>
              <button className="btn btn-ghost" onClick={() => { setTestingId(null); setTestResult(null) }}>✕</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <textarea className="input" value={testMsg} onChange={e => setTestMsg(e.target.value)} rows={3} placeholder={t('agents_mgmt.test_placeholder')} />
              {testResult && testResult.agentId === testingId && (
                <div style={{ background: 'var(--bg-surface-active)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)', fontSize: 'var(--text-sm)', whiteSpace: 'pre-wrap', maxHeight: 200, overflow: 'auto' }}>
                  {testResult.result}
                </div>
              )}
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', padding: 'var(--space-4)', borderTop: '1px solid var(--border-default)' }}>
              <button className="btn btn-ghost" onClick={() => { setTestingId(null); setTestResult(null) }}>{t('app.cancel')}</button>
              <button className="btn btn-primary" onClick={() => handleTest(testingId)} disabled={!testMsg.trim()}>{t('agents_mgmt.send_test')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
