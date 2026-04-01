import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Card, Switch, Empty, Tag, Row, Col, Space, Spin, Tooltip, Typography } from 'antd'
import { ApiOutlined, GlobalOutlined, ArrowDownOutlined, ArrowUpOutlined, SettingOutlined } from '@ant-design/icons'

const { Text, Paragraph } = Typography


const API = '/api/extensions'

interface Extension {
  id: string
  name: string
  description: string
  version: string
  enabled: boolean
  type: 'plugin' | 'tunnel' | string
}

interface TunnelInfo {
  status: 'connected' | 'disconnected' | 'connecting'
  url: string
  bytesIn: number
  bytesOut: number
  available: boolean
  running: boolean
}

export function ExtensionsPage() {
  const { t } = useTranslation()
  const [extensions, setExtensions] = useState<Extension[]>([])
  const [tunnel, setTunnel] = useState<TunnelInfo | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchExtensions = useCallback(async () => {
    try {
      const r = await fetch(API)
      if (r.ok) {
        const data = await r.json()
        setExtensions(Array.isArray(data) ? data : data?.extensions || [])
      }
    } catch { /* ignore */ }
  }, [])

  const fetchTunnel = useCallback(async () => {
    try {
      const r = await fetch(`${API}/tunnel`)
      if (r.ok) setTunnel(await r.json())
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    Promise.all([fetchExtensions(), fetchTunnel()]).finally(() => setLoading(false))
  }, [fetchExtensions, fetchTunnel])

  const toggleExtension = async (id: string, enabled: boolean) => {
    try {
      const r = await fetch(`${API}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      })
      if (r.ok) fetchExtensions()
    } catch { /* ignore */ }
  }

  const formatBytes = (b: number) => {
    if (!b) return '0 B'
    if (b < 1024) return `${b} B`
    if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`
    return `${(b / 1048576).toFixed(1)} MB`
  }

  const tunnelStatusColor = (status: string) => {
    if (status === 'connected') return 'success'
    if (status === 'connecting') return 'warning'
    return 'error'
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div className="page-header">
        <div>
          <div className="page-eyebrow">{t('extensions.eyebrow')}</div>
          <h1 className="page-title">{t('extensions.title')}</h1>
          <p className="page-subtitle">{t('extensions.subtitle', '管理插件、隧道和扩展功能')}</p>
        </div>
      </div>

      {/* Tunnel Card */}
      {tunnel && tunnel.available && (
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
            <Space size="middle">
              <h3 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 600 }}>CFTunnel</h3>
              <Tag color={tunnelStatusColor(tunnel.status)}>
                {t(`extensions.tunnel_${tunnel.status}`)}
              </Tag>
            </Space>
            {tunnel.url && (
              <Tooltip title={tunnel.url}>
                <Button size="small" href={tunnel.url} target="_blank" rel="noopener">
                  {tunnel.url} ↗
                </Button>
              </Tooltip>
            )}
          </div>
          <Space size="large" style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
            <span>↓ {formatBytes(tunnel.bytesIn)}</span>
            <span>↑ {formatBytes(tunnel.bytesOut)}</span>
          </Space>
        </Card>
      )}

      {/* Extensions Grid */}
      {extensions.length === 0 ? (
        <Card>
          <Empty
            description={t('extensions.no_extensions')}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          {extensions.map(ext => (
            <Col xs={24} sm={12} lg={8} key={ext.id}>
              <Card
                hoverable
                style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
                styles={{ body: { flex: 1, display: 'flex', flexDirection: 'column', gap: 8 } }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Space>
                    <ApiOutlined style={{ fontSize: 18, color: 'var(--accent)' }} />
                    <Text strong style={{ fontSize: 15 }}>{ext.name}</Text>
                  </Space>
                  <Space size={4}>
                    <Tag color="blue">v{ext.version}</Tag>
                    <Tag color={ext.type === 'plugin' ? 'purple' : 'cyan'}>{ext.type}</Tag>
                  </Space>
                </div>
                <Paragraph
                  type="secondary"
                  ellipsis={{ rows: 2 }}
                  style={{ margin: 0, fontSize: 13, flex: 1 }}
                >
                  {ext.description || '—'}
                </Paragraph>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTop: '1px solid var(--border-default)', marginTop: 'auto' }}>
                  <Tag color={ext.enabled ? 'success' : 'default'}>
                    {ext.enabled ? '● Active' : '○ Inactive'}
                  </Tag>
                  <Switch
                    checked={ext.enabled}
                    onChange={(checked) => toggleExtension(ext.id, checked)}
                    checkedChildren="ON"
                    unCheckedChildren="OFF"
                  />
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </div>
  )
}
