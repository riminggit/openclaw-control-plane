import { useState, useEffect } from 'react'
import { Table, Tabs, Statistic, Row, Col, Card, Switch, Input, Button, message, Skeleton, Tag, Empty } from 'antd'
import { CheckOutlined, CloseOutlined, MinusOutlined, TeamOutlined, AppstoreOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useTranslation } from 'react-i18next'

interface AgentInfo {
  id: string
  name: string
  model: string
  configured_skills: string[] | null
}

interface SkillInfo {
  name: string
  description: string
  source: string
}

interface MatrixData {
  agents: AgentInfo[]
  skills: SkillInfo[]
  matrix: Record<string, Record<string, boolean | null>>
}

interface AgentSkillDetail {
  agent_id: string
  agent_name: string
  configured_skills: string[] | null
  available_skills: Array<{
    name: string
    description: string
    source: string
    enabled: boolean
  }>
  workspace_path: string
}

export function AgentSkillPage() {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [matrixData, setMatrixData] = useState<MatrixData | null>(null)
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
  const [agentDetail, setAgentDetail] = useState<AgentSkillDetail | null>(null)
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null)
  const [searchAgent, setSearchAgent] = useState('')
  const [searchSkill, setSearchSkill] = useState('')
  const [updating, setUpdating] = useState(false)

  const loadMatrix = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/agent-skills/matrix')
      const data = await res.json()
      setMatrixData(data)
    } catch {
      message.error(t('agent_skill.load_failed'))
    } finally {
      setLoading(false)
    }
  }

  const loadAgentDetail = async (agentId: string) => {
    try {
      const res = await fetch(`/api/agent-skills/${agentId}`)
      const data = await res.json()
      setAgentDetail(data)
    } catch {
      message.error(t('agent_skill.load_failed'))
    }
  }

  const updateAgentSkills = async (agentId: string, skills: string[] | '*') => {
    try {
      setUpdating(true)
      const res = await fetch(`/api/agent-skills/${agentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skills })
      })
      const data = await res.json()
      if (data.ok) {
        message.success(t('agent_skill.update_success'))
        await loadMatrix()
        if (selectedAgent === agentId) {
          await loadAgentDetail(agentId)
        }
      } else {
        message.error(t('agent_skill.update_failed'))
      }
    } catch {
      message.error(t('agent_skill.update_failed'))
    } finally {
      setUpdating(false)
    }
  }

  const toggleSkill = async (agentId: string, skillName: string, currentEnabled: boolean) => {
    if (!matrixData) return
    const agent = matrixData.agents.find(a => a.id === agentId)
    if (!agent) return

    let newSkills: string[] | '*'
    if (currentEnabled) {
      if (agent.configured_skills === null) {
        const allSkills = Object.keys(matrixData.matrix[agentId] || {}).filter(
          k => matrixData.matrix[agentId][k] === true && k !== skillName
        )
        newSkills = allSkills
      } else {
        newSkills = agent.configured_skills.filter(s => s !== skillName)
      }
    } else {
      if (agent.configured_skills === null) return
      newSkills = [...agent.configured_skills, skillName]
    }

    await updateAgentSkills(agentId, newSkills)
  }

  useEffect(() => { loadMatrix() }, [])
  useEffect(() => { if (selectedAgent) loadAgentDetail(selectedAgent) }, [selectedAgent])

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <Skeleton active />
        <Skeleton active />
        <Skeleton active />
      </div>
    )
  }

  if (!matrixData) {
    return <div style={{ padding: 24 }}><Empty description={t('agent_skill.load_failed')} /></div>
  }

  const totalAgents = matrixData.agents.length
  const totalSkills = matrixData.skills.length
  const avgSkillsPerAgent = totalAgents > 0
    ? (Object.values(matrixData.matrix).reduce((sum, agentSkills) => {
        return sum + Object.values(agentSkills).filter(v => v === true).length
      }, 0) / totalAgents).toFixed(1)
    : '0'

  // ── Matrix View ──
  const renderMatrixView = () => {
    const filteredAgents = matrixData.agents.filter(a =>
      a.name.toLowerCase().includes(searchAgent.toLowerCase()) ||
      a.id.toLowerCase().includes(searchAgent.toLowerCase())
    )
    const filteredSkills = matrixData.skills.filter(s =>
      s.name.toLowerCase().includes(searchSkill.toLowerCase()) ||
      s.description.toLowerCase().includes(searchSkill.toLowerCase())
    )

    const columns: ColumnsType<{ skill: SkillInfo }> = [
      {
        title: t('agent_skill.skill'),
        dataIndex: ['skill', 'name'],
        key: 'skill',
        fixed: 'left',
        width: 200,
        render: (text: string, record: { skill: SkillInfo }) => (
          <div>
            <div style={{ fontWeight: 500 }}>{text}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{record.skill.description}</div>
          </div>
        )
      },
      ...filteredAgents.map(agent => ({
        title: (
          <div style={{ minWidth: 80 }}>
            <div>{agent.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{agent.model}</div>
          </div>
        ),
        dataIndex: ['skill', 'name'],
        key: agent.id,
        width: 100,
        render: (skillName: string) => {
          const value = matrixData.matrix[agent.id]?.[skillName]
          if (value === null || value === undefined) {
            return <MinusOutlined style={{ color: 'var(--text-quaternary)' }} />
          }
          return (
            <div
              style={{ cursor: 'pointer', display: 'flex', justifyContent: 'center' }}
              onClick={() => toggleSkill(agent.id, skillName, value === true)}
            >
              {value ? (
                <CheckOutlined style={{ color: 'var(--color-success)', fontSize: 16 }} />
              ) : (
                <CloseOutlined style={{ color: 'var(--color-error)', fontSize: 16 }} />
              )}
            </div>
          )
        }
      }))
    ]

    return (
      <div>
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={12}>
            <Input.Search
              placeholder={t('agent_skill.search_agents')}
              value={searchAgent}
              onChange={e => setSearchAgent(e.target.value)}
              allowClear
            />
          </Col>
          <Col span={12}>
            <Input.Search
              placeholder={t('agent_skill.search_skills')}
              value={searchSkill}
              onChange={e => setSearchSkill(e.target.value)}
              allowClear
            />
          </Col>
        </Row>
        <Table
          dataSource={filteredSkills.map(skill => ({ skill, key: skill.name }))}
          columns={columns}
          scroll={{ x: 'max-content', y: 600 }}
          pagination={false}
          size="small"
        />
      </div>
    )
  }

  // ── Agent Dimension View ──
  const renderAgentView = () => {
    const filteredAgents = matrixData.agents.filter(a =>
      a.name.toLowerCase().includes(searchAgent.toLowerCase()) ||
      a.id.toLowerCase().includes(searchAgent.toLowerCase())
    )

    const agentColumns: ColumnsType<AgentInfo> = [
      {
        title: t('agent_skill.agent'),
        dataIndex: 'name',
        key: 'name',
        render: (text: string, record: AgentInfo) => (
          <div>
            <div style={{ fontWeight: 500 }}>{text}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{record.id}</div>
          </div>
        )
      },
      {
        title: t('agent_skill.model'),
        dataIndex: 'model',
        key: 'model',
        width: 150
      },
      {
        title: t('agent_skill.configured'),
        dataIndex: 'configured_skills',
        key: 'configured_skills',
        width: 120,
        render: (skills: string[] | null) => (
          <Tag color={skills === null ? 'green' : 'blue'}>
            {skills === null ? t('agent_skill.all') : skills.length}
          </Tag>
        )
      },
      {
        title: t('app.action'),
        key: 'action',
        width: 80,
        render: (_: any, record: AgentInfo) => (
          <Button
            size="small"
            type={selectedAgent === record.id ? 'primary' : 'default'}
            onClick={() => setSelectedAgent(record.id)}
          >
            {t('app.view')}
          </Button>
        )
      }
    ]

    return (
      <Row gutter={16}>
        <Col span={10}>
          <Input.Search
            placeholder={t('agent_skill.search_agents')}
            value={searchAgent}
            onChange={e => setSearchAgent(e.target.value)}
            allowClear
            style={{ marginBottom: 16 }}
          />
          <Table
            dataSource={filteredAgents}
            columns={agentColumns}
            rowKey="id"
            scroll={{ y: 600 }}
            pagination={false}
            size="small"
          />
        </Col>
        <Col span={14}>
          {selectedAgent && agentDetail ? (
            <Card
              title={`${agentDetail.agent_name} ${t('agent_skill.skills')}`}
              extra={
                <div>
                  <Button
                    size="small"
                    onClick={() => updateAgentSkills(selectedAgent, '*')}
                    loading={updating}
                    style={{ marginRight: 8 }}
                  >
                    {t('agent_skill.enable_all')}
                  </Button>
                  <Button
                    size="small"
                    danger
                    onClick={() => updateAgentSkills(selectedAgent, [])}
                    loading={updating}
                  >
                    {t('agent_skill.disable_all')}
                  </Button>
                </div>
              }
            >
              <div style={{ maxHeight: 600, overflowY: 'auto' }}>
                {agentDetail.available_skills.map(skill => (
                  <div
                    key={skill.name}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 0',
                      borderBottom: '1px solid var(--border-default)'
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500 }}>{skill.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{skill.description}</div>
                    </div>
                    <Switch
                      checked={skill.enabled}
                      onChange={(checked) => toggleSkill(selectedAgent, skill.name, !checked)}
                      loading={updating}
                    />
                  </div>
                ))}
              </div>
            </Card>
          ) : (
            <Card>
              <Empty description={t('agent_skill.select_hint')} />
            </Card>
          )}
        </Col>
      </Row>
    )
  }

  // ── Skill Dimension View ──
  const renderSkillView = () => {
    const filteredSkills = matrixData.skills.filter(s =>
      s.name.toLowerCase().includes(searchSkill.toLowerCase()) ||
      s.description.toLowerCase().includes(searchSkill.toLowerCase())
    )

    const skillColumns: ColumnsType<SkillInfo> = [
      {
        title: t('agent_skill.skill'),
        dataIndex: 'name',
        key: 'name',
        render: (text: string, record: SkillInfo) => (
          <div>
            <div style={{ fontWeight: 500 }}>{text}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{record.description}</div>
          </div>
        )
      },
      {
        title: t('agent_skill.source'),
        dataIndex: 'source',
        key: 'source',
        width: 120,
        render: (source: string) => (
          <Tag color={source === 'openclaw-bundled' ? 'green' : 'blue'}>
            {source}
          </Tag>
        )
      },
      {
        title: t('agent_skill.agents_count'),
        key: 'agents',
        width: 100,
        render: (_: any, record: SkillInfo) => {
          const count = matrixData.agents.filter(
            agent => matrixData.matrix[agent.id]?.[record.name] === true
          ).length
          return <Tag>{count}</Tag>
        }
      },
      {
        title: t('app.action'),
        key: 'action',
        width: 80,
        render: (_: any, record: SkillInfo) => (
          <Button
            size="small"
            type={selectedSkill === record.name ? 'primary' : 'default'}
            onClick={() => setSelectedSkill(record.name)}
          >
            {t('app.view')}
          </Button>
        )
      }
    ]

    const selectedSkillInfo = selectedSkill ? matrixData.skills.find(s => s.name === selectedSkill) : null
    const agentsWithSelectedSkill = selectedSkill
      ? matrixData.agents.filter(a => matrixData.matrix[a.id]?.[selectedSkill] !== null)
      : []

    return (
      <Row gutter={16}>
        <Col span={10}>
          <Input.Search
            placeholder={t('agent_skill.search_skills')}
            value={searchSkill}
            onChange={e => setSearchSkill(e.target.value)}
            allowClear
            style={{ marginBottom: 16 }}
          />
          <Table
            dataSource={filteredSkills}
            columns={skillColumns}
            rowKey="name"
            scroll={{ y: 600 }}
            pagination={false}
            size="small"
          />
        </Col>
        <Col span={14}>
          {selectedSkill && selectedSkillInfo ? (
            <Card title={`${selectedSkillInfo.name} - ${t('agent_skill.agents_with_skill')}`}>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 500 }}>{t('agent_skill.description')}</div>
                <div style={{ color: 'var(--text-secondary)' }}>{selectedSkillInfo.description}</div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 500 }}>{t('agent_skill.source')}</div>
                <Tag color={selectedSkillInfo.source === 'openclaw-bundled' ? 'green' : 'blue'}>
                  {selectedSkillInfo.source}
                </Tag>
              </div>
              <div style={{ fontWeight: 500, marginBottom: 8 }}>{t('agent_skill.agents_with_skill')}</div>
              <div style={{ maxHeight: 450, overflowY: 'auto' }}>
                <Table
                  dataSource={agentsWithSelectedSkill}
                  columns={[
                    {
                      title: t('agent_skill.agent'),
                      dataIndex: 'name',
                      key: 'name',
                      render: (text: string, record: AgentInfo) => (
                        <div>
                          <div style={{ fontWeight: 500 }}>{text}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{record.id}</div>
                        </div>
                      )
                    },
                    {
                      title: t('agent_skill.model'),
                      dataIndex: 'model',
                      key: 'model',
                      width: 150
                    },
                    {
                      title: t('agent_skill.enabled'),
                      key: 'enabled',
                      width: 100,
                      render: (_: any, record: AgentInfo) => {
                        const enabled = matrixData.matrix[record.id]?.[selectedSkill] === true
                        return (
                          <Switch
                            checked={enabled}
                            onChange={(checked) => toggleSkill(record.id, selectedSkill, !checked)}
                            loading={updating}
                          />
                        )
                      }
                    }
                  ]}
                  rowKey="id"
                  pagination={false}
                  size="small"
                />
              </div>
            </Card>
          ) : (
            <Card>
              <Empty description={t('agent_skill.select_skill_hint')} />
            </Card>
          )}
        </Col>
      </Row>
    )
  }

  const tabItems = [
    { key: 'matrix', label: t('agent_skill.matrix_view') },
    { key: 'agent', label: t('agent_skill.agent_dim') },
    { key: 'skill', label: t('agent_skill.skill_dim') },
  ]

  return (
    <div>
      <div className="page-header">
        <p className="page-eyebrow">{t('agent_skill.eyebrow')}</p>
        <h1 className="page-title">{t('agent_skill.title')}</h1>
        <p className="page-subtitle">{t('agent_skill.subtitle')}</p>
      </div>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card>
            <Statistic title={t('agent_skill.total_agents')} value={totalAgents} prefix={<TeamOutlined />} />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title={t('agent_skill.total_skills')} value={totalSkills} prefix={<AppstoreOutlined />} />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title={t('agent_skill.avg_skills')} value={avgSkillsPerAgent} />
          </Card>
        </Col>
      </Row>

      <Tabs defaultActiveKey="matrix" items={tabItems} />
    </div>
  )
}
