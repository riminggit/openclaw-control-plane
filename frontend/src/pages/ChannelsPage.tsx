import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { channelsApi, type Channel } from '../api/modules/channels'
import { Button, Input, Card, Row, Col, Tag, Empty, Space, Typography } from 'antd'
import {
  SendOutlined, MessageOutlined, WechatOutlined, CommentOutlined,
  TranslationOutlined, SlackOutlined, SafetyCertificateOutlined,
  MailOutlined, AppstoreOutlined, DownOutlined, UpOutlined,
} from '@ant-design/icons'

const { Text } = Typography

const CHANNEL_ICONS: Record<string, React.ReactNode> = {
  telegram: <SendOutlined />,
  discord: <MessageOutlined />,
  wechat: <WechatOutlined />,
  qqbot: <CommentOutlined />,
  feishu: <TranslationOutlined />,
  slack: <SlackOutlined />,
  signal: <SafetyCertificateOutlined />,
  email: <MailOutlined />,
}

// Channel types configuration - placeholders for Feishu and DingTalk are in Chinese
const getChannelTypes = (t: (key: string, fallback: string) => string) => [
  { type: 'telegram', name: 'Telegram', icon: <SendOutlined style={{ fontSize: 28 }} />, fields: [
    { key: 'botToken', label: 'Bot Token', placeholder: '123456:ABC-DEF...' },
  ]},
  { type: 'discord', name: 'Discord', icon: <MessageOutlined style={{ fontSize: 28 }} />, fields: [
    { key: 'botToken', label: 'Bot Token', placeholder: 'Bot token from Discord Developer Portal' },
    { key: 'guildId', label: 'Guild ID', placeholder: 'Server ID' },
  ]},
  { type: 'qqbot', name: 'QQ Bot', icon: <CommentOutlined style={{ fontSize: 28 }} />, fields: [
    { key: 'appId', label: 'App ID', placeholder: 'QQ Bot App ID' },
    { key: 'token', label: 'Token', placeholder: 'Access Token', type: 'password' },
    { key: 'secret', label: 'Secret', placeholder: 'App Secret', type: 'password' },
  ]},
  { type: 'feishu', name: t('channels.feishu', '飞书'), icon: <TranslationOutlined style={{ fontSize: 28 }} />, fields: [
    { key: 'appId', label: 'App ID', placeholder: t('channels.feishu_app_id', '飞书应用 App ID') },
    { key: 'appSecret', label: 'App Secret', placeholder: t('channels.feishu_app_secret', '飞书应用 Secret'), type: 'password' },
  ]},
  { type: 'dingtalk', name: t('channels.dingtalk', '钉钉'), icon: <WechatOutlined style={{ fontSize: 28 }} />, fields: [
    { key: 'clientKey', label: 'Client Key', placeholder: t('channels.dingtalk_client_key', '钉钉应用 ClientKey') },
    { key: 'clientSecret', label: 'Client Secret', placeholder: 'Client Secret', type: 'password' },
  ]},
  { type: 'signal', name: 'Signal', icon: <SafetyCertificateOutlined style={{ fontSize: 28 }} />, fields: [
    { key: 'phoneNumber', label: 'Phone Number', placeholder: '+1234567890' },
  ]},
  { type: 'slack', name: 'Slack', icon: <SlackOutlined style={{ fontSize: 28 }} />, fields: [
    { key: 'botToken', label: 'Bot Token', placeholder: 'xoxb-...', type: 'password' },
    { key: 'appToken', label: 'App Token', placeholder: 'xapp-...', type: 'password' },
  ]},
]

export function ChannelsPage() {
  const { t } = useTranslation()
  const CHANNEL_TYPES = getChannelTypes(t)
  const [channels, setChannels] = useState<Channel[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedType, setExpandedType] = useState<string | null>(null)
  const [formValues, setFormValues] = useState<Record<string, Record<string, string>>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [testing, setTesting] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; msg: string }>>({})

  const fetchChannels = useCallback(async () => {
    try {
      setLoading(true)
      const list = await channelsApi.list().catch(() => [])
      const statusList = await channelsApi.status().catch(() => [])
      const statusMap = new Map(statusList.map(c => [c.type, c.status]))
      const merged = list.map(c => ({
        ...c,
        status: statusMap.get(c.type) || c.status,
      }))
      setChannels(merged)
      const fv: Record<string, Record<string, string>> = {}
      for (const c of merged) {
        if (c.config) fv[c.type] = { ...c.config }
      }
      setFormValues(fv)
    } catch {
      setChannels([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchChannels() }, [fetchChannels])

  const updateForm = (type: string, key: string, value: string) => {
    setFormValues(prev => ({
      ...prev,
      [type]: { ...(prev[type] || {}), [key]: value },
    }))
  }

  const handleSave = async (type: string) => {
    setSaving(type)
    try {
      await channelsApi.save(type, formValues[type] || {})
      fetchChannels()
    } catch (e: any) {
      console.error(e)
    } finally {
      setSaving(null)
    }
  }

  const handleTest = async (type: string) => {
    setTesting(type)
    try {
      const res = await channelsApi.test(type)
      setTestResults(prev => ({ ...prev, [type]: { ok: res.success, msg: res.message || (res.success ? '✅ Connected' : '❌ Failed') } }))
    } catch (e: any) {
      setTestResults(prev => ({ ...prev, [type]: { ok: false, msg: e.message } }))
    } finally {
      setTesting(null)
    }
  }

  const getStatusTag = (status: string) => {
    if (status === 'connected') return <Tag color="success">{t('channels.status_connected')}</Tag>
    if (status === 'disconnected') return <Tag color="error">{t('channels.status_disconnected')}</Tag>
    return <Tag>{t('channels.status_unconfigured')}</Tag>
  }

  const channelMap = new Map(channels.map(c => [c.type, c]))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <div className="page-eyebrow">{t('channels.eyebrow')}</div>
          <h1 className="page-title">{t('channels.title')}</h1>
          <p className="page-subtitle">{t('channels.subtitle')}</p>
        </div>
        <Button icon={<AppstoreOutlined />} onClick={fetchChannels}>{t('channels.refresh')}</Button>
      </div>

      {loading ? (
        <Row gutter={[16, 16]}>
          {[1, 2, 3].map(i => (
            <Col xs={24} sm={12} lg={8} key={i}>
              <Card loading />
            </Col>
          ))}
        </Row>
      ) : (
        <Row gutter={[16, 16]}>
          {CHANNEL_TYPES.map(ch => {
            const existing = channelMap.get(ch.type)
            const isExpanded = expandedType === ch.type
            const status = existing?.status || 'unconfigured'

            return (
              <Col xs={24} sm={12} lg={8} key={ch.type}>
                <Card
                  hoverable
                  onClick={() => setExpandedType(isExpanded ? null : ch.type)}
                  style={{ height: '100%', transition: 'box-shadow 0.2s, transform 0.2s' }}
                  styles={{
                    body: { padding: 0 },
                  }}
                >
                  {/* Card Header */}
                  <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
                      color: 'var(--accent)', fontSize: 22,
                    }}>
                      {ch.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-primary)' }}>{ch.name}</div>
                      <div style={{ marginTop: 4 }}>{getStatusTag(status)}</div>
                    </div>
                    {isExpanded ? <UpOutlined style={{ color: 'var(--text-muted)' }} /> : <DownOutlined style={{ color: 'var(--text-muted)' }} />}
                  </div>

                  {/* Expanded Config */}
                  {isExpanded && (
                    <div style={{ padding: '0 20px 20px', borderTop: '1px solid var(--border-default)' }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 16 }}>
                        {ch.fields.map(f => (
                          <div key={f.key}>
                            <label style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>{f.label}</label>
                            <Input.Password
                              visibilityToggle={f.type !== 'password'}
                              value={formValues[ch.type]?.[f.key] || ''}
                              onChange={e => updateForm(ch.type, f.key, e.target.value)}
                              placeholder={f.placeholder}
                              size="middle"
                            />
                          </div>
                        ))}
                        {testResults[ch.type] && (
                          <div style={{
                            padding: '8px 12px', borderRadius: 8,
                            background: testResults[ch.type].ok ? 'rgba(82,196,26,0.1)' : 'rgba(255,77,79,0.1)',
                            border: `1px solid ${testResults[ch.type].ok ? 'rgba(82,196,26,0.3)' : 'rgba(255,77,79,0.3)'}`,
                            color: testResults[ch.type].ok ? '#52c41a' : '#ff4d4f',
                            fontSize: 13,
                          }}>
                            {testResults[ch.type].msg}
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 4 }}>
                          <Button
                            onClick={() => handleTest(ch.type)}
                            disabled={testing === ch.type}
                            loading={testing === ch.type}
                          >
                            {t('channels.test_conn')}
                          </Button>
                          <Button
                            type="primary"
                            onClick={() => handleSave(ch.type)}
                            disabled={saving === ch.type}
                            loading={saving === ch.type}
                          >
                            {saving === ch.type ? t('app.saving') : t('app.save')}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </Card>
              </Col>
            )
          })}
        </Row>
      )}
    </div>
  )
}
