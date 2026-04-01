import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Input, Select, Card, Row, Col, Tag, Empty, Space, Typography, Skeleton, Checkbox, message } from 'antd'
import { SearchOutlined, ReloadOutlined, DownloadOutlined, DeleteOutlined, AppstoreOutlined, ThunderboltOutlined } from '@ant-design/icons'

const { Text, Paragraph } = Typography

interface Skill {
  name: string
  description: string
  version?: string
  status: 'eligible' | 'missing' | 'disabled' | 'blocked'
  bundled?: boolean
  source?: string
  installed_at?: string
  tags?: string[]
}

interface StoreSkill {
  name: string
  description: string
  version?: string
  source: 'skillhub' | 'clawhub'
}

const API = '/api/skills'

export function SkillsPage() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<'installed' | 'store'>('installed')
  const [installed, setInstalled] = useState<Skill[]>([])
  const [storeResults, setStoreResults] = useState<StoreSkill[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchSource, setSearchSource] = useState<'skillhub' | 'clawhub'>('skillhub')
  const [searching, setSearching] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const fetchInstalled = useCallback(async () => {
    try {
      const res = await fetch(`${API}/installed`)
      if (res.ok) {
        const data = await res.json()
        setInstalled(Array.isArray(data) ? data : (data.skills || []))
      }
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    fetchInstalled().finally(() => setLoading(false))
  }, [])

  const handleUninstall = async (name: string) => {
    setActionLoading(name)
    try {
      await fetch(`${API}/uninstall/${encodeURIComponent(name)}`, { method: 'POST' })
      await fetchInstalled()
      message.success(`${name} ${t('skills.uninstall', '卸载')} OK`)
    } catch { message.error('Failed') }
    setActionLoading(null)
  }

  const handleUpdate = async (name: string) => {
    setActionLoading(name)
    try {
      await fetch(`${API}/update/${encodeURIComponent(name)}`, { method: 'POST' })
      await fetchInstalled()
      message.success(`${name} ${t('skills.update', '更新')} OK`)
    } catch { message.error('Failed') }
    setActionLoading(null)
  }

  const handleBatchUpdate = async () => {
    if (selected.size === 0) return
    setActionLoading('batch')
    try {
      await Promise.all(Array.from(selected).map(name =>
        fetch(`${API}/update/${encodeURIComponent(name)}`, { method: 'POST' })
      ))
      await fetchInstalled()
      setSelected(new Set())
      message.success(`${selected.size} skills updated`)
    } catch { message.error('Batch update failed') }
    setActionLoading(null)
  }

  const handleBatchUninstall = async () => {
    if (selected.size === 0) return
    if (!confirm(`Uninstall ${selected.size} skills?`)) return
    setActionLoading('batch')
    try {
      await Promise.all(Array.from(selected).map(name =>
        fetch(`${API}/uninstall/${encodeURIComponent(name)}`, { method: 'POST' })
      ))
      await fetchInstalled()
      setSelected(new Set())
      message.success(`${selected.size} skills uninstalled`)
    } catch { message.error('Batch uninstall failed') }
    setActionLoading(null)
  }

  const handleInstall = async (skill: StoreSkill) => {
    setActionLoading(skill.name)
    try {
      await fetch(`${API}/install`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: skill.name, source: skill.source }) })
      await fetchInstalled()
      message.success(`${skill.name} installed`)
    } catch { message.error('Install failed') }
    setActionLoading(null)
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    setSearching(true)
    try {
      const res = await fetch(`${API}/search?q=${encodeURIComponent(searchQuery)}&source=${searchSource}`)
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data)) {
          setStoreResults(data)
        } else if (typeof data.results === 'string' && data.results) {
          const skills: StoreSkill[] = data.results.split('\n').filter(Boolean).map((line: string) => {
            const match = line.match(/^(\S+)\s+(.*?)\s*\(([^)]+)\)\s*$/)
            if (match) return { name: match[1].trim(), description: match[2].trim(), version: match[3].trim(), source: searchSource }
            const parts = line.split(/\s{2,}/, 2)
            return { name: parts[0]?.trim() || line.trim(), description: parts[1]?.trim() || '', source: searchSource }
          })
          setStoreResults(skills)
        } else if (Array.isArray(data.skills)) {
          setStoreResults(data.skills)
        } else {
          setStoreResults([])
        }
      }
    } catch { /* ignore */ }
    setSearching(false)
  }

  const statusTag = (status: string) => {
    const map: Record<string, { color: string; label: string }> = {
      eligible: { color: 'green', label: t('skills.ready', '就绪') },
      missing: { color: 'red', label: t('skills.missing', '缺失') },
      disabled: { color: 'orange', label: t('skills.disabled', '已禁用') },
      blocked: { color: 'default', label: t('skills.blocked', '已阻止') },
    }
    const info = map[status] || { color: 'default', label: status }
    return <Tag color={info.color}>{info.label}</Tag>
  }

  const toggleSelect = (name: string) => {
    const next = new Set(selected)
    next.has(name) ? next.delete(name) : next.add(name)
    setSelected(next)
  }

  const selectAll = () => {
    if (selected.size === installed.length) setSelected(new Set())
    else setSelected(new Set(installed.map(s => s.name)))
  }

  const filtered = tab === 'installed' ? installed : storeResults

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <div className="page-eyebrow">{t('skills.eyebrow', '插件管理')}</div>
          <h1 className="page-title">{t('skills.title', 'Skill 管理')}</h1>
          <p className="page-subtitle">{t('skills.subtitle', '管理和安装 Agent Skills')}</p>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => { fetchInstalled(); setLoading(true); setTimeout(() => setLoading(false), 500) }}>
            {t('channels.refresh')}
          </Button>
        </Space>
      </div>

      {/* Tabs */}
      <Space>
        {(['installed', 'store'] as const).map(key => (
          <Button
            key={key}
            type={tab === key ? 'primary' : 'default'}
            onClick={() => { setTab(key); setSelected(new Set()) }}
          >
            {t(`skills.tab_${key}`, key === 'installed' ? '已安装' : '商店搜索')}
          </Button>
        ))}
      </Space>

      {tab === 'installed' && (
        <>
          {/* Batch Actions */}
          {selected.size > 0 && (
            <Card size="small" style={{ borderColor: 'var(--accent)' }}>
              <Space>
                <Checkbox checked={selected.size === installed.length && installed.length > 0} onChange={selectAll} />
                <Text>{selected.size} selected</Text>
                <Button size="small" icon={<ThunderboltOutlined />} onClick={handleBatchUpdate} loading={actionLoading === 'batch'}>
                  Batch Update
                </Button>
                <Button size="small" danger icon={<DeleteOutlined />} onClick={handleBatchUninstall} loading={actionLoading === 'batch'}>
                  Batch Uninstall
                </Button>
                <Button size="small" onClick={() => setSelected(new Set())}>Clear</Button>
              </Space>
            </Card>
          )}

          {/* Filter */}
          <Input.Search
            placeholder={t('skills.filter_placeholder', 'Filter installed skills...')}
            onChange={e => setSearchQuery(e.target.value)}
            allowClear
            style={{ maxWidth: 400 }}
          />
        </>
      )}

      {tab === 'store' && (
        <Space wrap>
          <Input.Search
            placeholder={t('skills.search_placeholder', 'Search Skill...')}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onSearch={handleSearch}
            enterButton
            style={{ width: 320 }}
            prefix={<SearchOutlined />}
          />
          <Select value={searchSource} onChange={v => setSearchSource(v)} style={{ width: 140 }}>
            <Select.Option value="skillhub">SkillHub</Select.Option>
            <Select.Option value="clawhub">ClawHub</Select.Option>
          </Select>
        </Space>
      )}

      {/* Content */}
      {loading ? (
        <Row gutter={[16, 16]}>
          {[1, 2, 3].map(i => (
            <Col xs={24} sm={12} lg={8} key={i}>
              <Skeleton active paragraph={{ rows: 3 }} />
            </Col>
          ))}
        </Row>
      ) : filtered.length === 0 ? (
        <Empty
          description={tab === 'installed' ? t('skills.no_installed', '暂无已安装 Skill') : t('skills.no_results', '无搜索结果')}
          style={{ padding: 60 }}
        >
          {tab === 'installed' && (
            <Button type="primary" onClick={() => setTab('store')}>
              <AppstoreOutlined /> {t('skills.browse_store', 'Browse Store')}
            </Button>
          )}
        </Empty>
      ) : tab === 'installed' ? (
        <Row gutter={[16, 16]}>
          {installed
            .filter(s => !searchQuery || s.name.toLowerCase().includes(searchQuery.toLowerCase()))
            .map(skill => (
            <Col xs={24} sm={12} lg={8} key={skill.name}>
              <Card
                size="small"
                style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
                styles={{ body: { flex: 1, display: 'flex', flexDirection: 'column', gap: 8 } }}
              >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Checkbox
                      checked={selected.has(skill.name)}
                      onChange={() => toggleSelect(skill.name)}
                    />
                    <div>
                      <Text strong style={{ fontSize: 14 }}>{skill.name}</Text>
                      <div style={{ marginTop: 2 }}>{statusTag(skill.status)}</div>
                    </div>
                  </div>
                  {skill.version && <Tag color="blue">v{skill.version}</Tag>}
                </div>

                {/* Description */}
                <Paragraph
                  type="secondary"
                  ellipsis={{ rows: 2, expandable: true, symbol: 'more' }}
                  style={{ margin: 0, fontSize: 13, flex: 1 }}
                >
                  {skill.description || '—'}
                </Paragraph>

                {/* Tags */}
                {skill.tags && skill.tags.length > 0 && (
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {skill.tags.map(tag => <Tag key={tag} style={{ fontSize: 11 }}>{tag}</Tag>)}
                  </div>
                )}

                {/* Actions */}
                {!skill.bundled && (
                  <div style={{ display: 'flex', gap: 8, paddingTop: 8, borderTop: '1px solid var(--border-default)', marginTop: 'auto' }}>
                    <Button
                      size="small"
                      icon={<ThunderboltOutlined />}
                      onClick={() => handleUpdate(skill.name)}
                      loading={actionLoading === skill.name}
                    >
                      {t('skills.update', '更新')}
                    </Button>
                    <Button
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => handleUninstall(skill.name)}
                      loading={actionLoading === skill.name}
                    >
                      {t('skills.uninstall', '卸载')}
                    </Button>
                  </div>
                )}
              </Card>
            </Col>
          ))}
        </Row>
      ) : (
        <Row gutter={[16, 16]}>
          {storeResults.map(skill => (
            <Col xs={24} sm={12} lg={8} key={`${skill.source}:${skill.name}`}>
              <Card
                size="small"
                hoverable
                style={{ height: '100%' }}
                styles={{ body: { display: 'flex', flexDirection: 'column', gap: 8 } }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <Text strong>{skill.name}</Text>
                    <div style={{ marginTop: 2, display: 'flex', gap: 4 }}>
                      {skill.version && <Tag>v{skill.version}</Tag>}
                      <Tag>{skill.source}</Tag>
                    </div>
                  </div>
                  <Button
                    type="primary"
                    size="small"
                    icon={<DownloadOutlined />}
                    onClick={() => handleInstall(skill)}
                    loading={actionLoading === skill.name}
                  >
                    {t('skills.install', '安装')}
                  </Button>
                </div>
                <Paragraph type="secondary" ellipsis={{ rows: 2 }} style={{ margin: 0, fontSize: 13 }}>
                  {skill.description}
                </Paragraph>
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </div>
  )
}
