import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, Input, Button, Select, Tag, Space, Switch, message, Tabs, Spin, Modal, Form, Empty, Divider, Tooltip } from 'antd'
import { PlusOutlined, DeleteOutlined, EditOutlined, SaveOutlined, ReloadOutlined, EyeInvisibleOutlined, EyeOutlined, SettingOutlined, ApiOutlined } from '@ant-design/icons'

interface ProviderInfo {
  baseUrl: string
  apiKey: string
  api: string
  models: Array<{ id: string; name: string; reasoning: boolean; input: string[]; contextWindow?: number }>
}

interface DefaultsInfo {
  primary: string
  fallbacks: string[]
}

export function SettingsPage() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState('models')

  return (
    <div className="page-container">
      <div className="page-header">
        <p className="page-eyebrow">{t('settings.eyebrow')}</p>
        <h1 className="page-title">{t('settings.title')}</h1>
        <p className="page-subtitle">{t('settings.subtitle')}</p>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          { key: 'models', label: t('settings.tab_models'), icon: <ApiOutlined /> },
          { key: 'defaults', label: t('settings.tab_defaults'), icon: <SettingOutlined /> },
        ]}
      />

      {activeTab === 'models' && <ModelsTab />}
      {activeTab === 'defaults' && <DefaultsTab />}
    </div>
  )
}

function ModelsTab() {
  const { t } = useTranslation()
  const [providers, setProviders] = useState<Record<string, ProviderInfo>>({})
  const [loading, setLoading] = useState(true)
  const [editingProvider, setEditingProvider] = useState<string | null>(null)
  const [showKey, setShowKey] = useState<Record<string, boolean>>({})

  const fetchProviders = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/model-config/providers')
      const data = await res.json()
      setProviders(data)
    } catch {
      message.error(t('common.load_failed'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchProviders() }, [fetchProviders])

  const saveProvider = async (name: string, updates: Partial<ProviderInfo>) => {
    try {
      const res = await fetch(`/api/model-config/providers/${name}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      const data = await res.json()
      if (data.ok) {
        message.success(t('settings.save_success'))
        await fetchProviders()
        setEditingProvider(null)
      } else {
        message.error(t('settings.save_failed'))
      }
    } catch {
      message.error(t('settings.save_failed'))
    }
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 48 }}><Spin size="large" /></div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>{t('settings.providers')} ({Object.keys(providers).length})</h3>
        <Button icon={<ReloadOutlined />} onClick={fetchProviders}>{t('common.refresh')}</Button>
      </div>

      {Object.entries(providers).map(([name, info]) => (
        <Card key={name} title={name} size="small" style={{ marginBottom: 'var(--space-3)' }}
          extra={
            editingProvider === name
              ? <Space>
                  <Button size="small" onClick={() => setEditingProvider(null)}>{t('common.cancel')}</Button>
                  <Button size="small" type="primary" icon={<SaveOutlined />} onClick={() => saveProvider(name, info)}>{t('common.save')}</Button>
                </Space>
              : <Button size="small" icon={<EditOutlined />} onClick={() => setEditingProvider(name)}>{t('common.edit')}</Button>
          }
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-3)' }}>
            <div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 4 }}>Base URL</div>
              {editingProvider === name
                ? <Input size="small" value={info.baseUrl} onChange={e => {
                    const u = { ...providers }
                    u[name] = { ...info, baseUrl: e.target.value }
                    setProviders(u)
                  }} />
                : <div style={{ fontSize: 'var(--text-sm)', wordBreak: 'break-all' }}>{info.baseUrl || '-'}</div>
              }
            </div>
            <div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 4 }}>API Key</div>
              <Space.Compact>
                <Input size="small"
                  type={showKey[name] ? 'text' : 'password'}
                  value={showKey[name] ? info.apiKey : info.apiKey}
                  readOnly={!editingProvider}
                  onChange={e => {
                    const u = { ...providers }
                    u[name] = { ...info, apiKey: e.target.value }
                    setProviders(u)
                  }}
                />
                <Button size="small" icon={showKey[name] ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                  onClick={() => setShowKey({ ...showKey, [name]: !showKey[name] })} />
              </Space.Compact>
            </div>
            <div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 4 }}>API Type</div>
              <Tag color="blue">{info.api || 'openai'}</Tag>
            </div>
            <div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 4 }}>{t('settings.models_count')}</div>
              <div style={{ fontSize: 'var(--text-sm)' }}>{info.models.length} {t('settings.models_unit')}</div>
            </div>
          </div>

          {/* Model list */}
          <div style={{ marginTop: 'var(--space-3)' }}>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 8 }}>{t('settings.available_models')}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
              {info.models.map((m, i) => (
                <Tooltip key={m.id || i} title={`Context: ${m.contextWindow || '?'} | Reasoning: ${m.reasoning}`}>
                  <Tag color="default" style={{ cursor: 'default' }}>
                    {m.name || m.id}
                    {m.reasoning && ' 🧠'}
                  </Tag>
                </Tooltip>
              ))}
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}

function DefaultsTab() {
  const { t } = useTranslation()
  const [defaults, setDefaults] = useState<DefaultsInfo>({ primary: '', fallbacks: [] })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [allModels, setAllModels] = useState<string[]>([])

  const fetchDefaults = useCallback(async () => {
    try {
      setLoading(true)
      const [defRes, provRes] = await Promise.all([
        fetch('/api/model-config/defaults'),
        fetch('/api/model-config/providers'),
      ])
      const defData = await defRes.json()
      const provData = await provRes.json()
      setDefaults(defData)
      const modelList: string[] = []
      for (const [prov, info] of Object.entries(provData)) {
        const pInfo = info as ProviderInfo
        for (const m of pInfo.models || []) {
          modelList.push(`${prov}/${m.id}`)
        }
      }
      setAllModels(modelList)
    } catch {
      message.error(t('common.load_failed'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchDefaults() }, [fetchDefaults])

  const saveDefaults = async () => {
    try {
      setSaving(true)
      const res = await fetch('/api/model-config/defaults', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(defaults),
      })
      const data = await res.json()
      if (data.ok) {
        message.success(t('settings.save_success'))
      }
    } catch {
      message.error(t('settings.save_failed'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 48 }}><Spin size="large" /></div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <Card title={t('settings.default_model')} size="small">
        <div style={{ marginBottom: 'var(--space-3)' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 8 }}>{t('settings.primary_desc')}</div>
          <Select
            showSearch
            style={{ width: '100%' }}
            value={defaults.primary}
            onChange={val => setDefaults({ ...defaults, primary: val })}
            options={allModels.map(m => ({ label: m, value: m }))}
            size="large"
          />
        </div>
        <Divider />
        <div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 8 }}>{t('settings.fallbacks_desc')}</div>
          <Select
            mode="multiple"
            showSearch
            style={{ width: '100%' }}
            value={defaults.fallbacks}
            onChange={vals => setDefaults({ ...defaults, fallbacks: vals })}
            options={allModels.map(m => ({ label: m, value: m }))}
            optionFilterProp="label"
          />
        </div>
      </Card>

      <div style={{ textAlign: 'center' }}>
        <Button type="primary" icon={<SaveOutlined />} onClick={saveDefaults} loading={saving}>
          {t('settings.save_defaults')}
        </Button>
      </div>
    </div>
  )
}
