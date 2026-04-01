import { useState, useEffect } from 'react'
import { Table, Tabs, Statistic, Row, Col, Card, Switch, Input, Button, message, Skeleton, Tag } from 'antd'
import { CheckOutlined, CloseOutlined, MinusOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'

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
  const [loading, setLoading] = useState(true)
  const [matrixData, setMatrixData] = useState<MatrixData | null>(null)
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
  const [agentDetail, setAgentDetail] = useState<AgentSkillDetail | null>(null)
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null)
  const [searchAgent, setSearchAgent] = useState('')
  const [searchSkill, setSearchSkill] = useState('')
  const [updating, setUpdating] = useState(false)

  // Load matrix data
  const loadMatrix = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/agent-skills/matrix')
      const data = await res.json()
      setMatrixData(data)
    } catch (err) {
      message.error('Failed to load skill matrix')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // Load agent detail
  const loadAgentDetail = async (agentId: string) => {
    try {
      const res = await fetch(`/api/agent-skills/${agentId}`)
      const data = await res.json()
      setAgentDetail(data)
    } catch (err) {
      message.error('Failed to load agent skills')
      console.error(err)
    }
  }

  // Update agent skills
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
        message.success('Skills updated successfully')
        await loadMatrix()
        if (selectedAgent === agentId) {
          await loadAgentDetail(agentId)
        }
      } else {
        message.error('Failed to update skills')
      }
    } catch (err) {
      message.error('Failed to update skills')
      console.error(err)
    } finally {
      setUpdating(false)
    }
  }

  // Toggle a single skill for an agent
  const toggleSkill = async (agentId: string, skillName: string, currentEnabled: boolean) => {
    if (!matrixData) return

    const agent = matrixData.agents.find(a => a.id === agentId)
    if (!agent) return

    let newSkills: string[] | '*'
    
    if (currentEnabled) {
      // Disable this skill
      if (agent.configured_skills === null) {
        // Currently all enabled, need to exclude this one
        const allSkills = Object.keys(matrixData.matrix[agentId] || {}).filter(
          k => matrixData.matrix[agentId][k] === true && k !== skillName
        )
        newSkills = allSkills
      } else {
        // Remove from configured list
        newSkills = agent.configured_skills.filter(s => s !== skillName)
      }
    } else {
      // Enable this skill
      if (agent.configured_skills === null) {
        // Already all enabled, no change needed
        return
      } else {
        // Add to configured list
        newSkills = [...agent.configured_skills, skillName]
      }
    }

    await updateAgentSkills(agentId, newSkills)
  }

  useEffect(() => {
    loadMatrix()
  }, [])

  useEffect(() => {
    if (selectedAgent) {
      loadAgentDetail(selectedAgent)
    }
  }, [selectedAgent])

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
    return <div style={{ padding: 24 }}>Failed to load data</div>
  }

  // Calculate statistics
  const totalAgents = matrixData.agents.length
  const totalSkills = matrixData.skills.length
  const avgSkillsPerAgent = totalAgents > 0 
    ? (Object.values(matrixData.matrix).reduce((sum, agentSkills) => {
        return sum + Object.values(agentSkills).filter(v => v === true).length
      }, 0) / totalAgents).toFixed(1)
    : 0

  // Matrix View
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
        title: 'Skill',
        dataIndex: ['skill', 'name'],
        key: 'skill',
        fixed: 'left',
        width: 200,
        render: (text: string, record: { skill: SkillInfo }) => (
          <div>
            <div style={{ fontWeight: 500 }}>{text}</div>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>{record.skill.description}</div>
          </div>
        )
      },
      ...filteredAgents.map(agent => ({
        title: (
          <div style={{ minWidth: 80 }}>
            <div>{agent.name}</div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>{agent.model}</div>
          </div>
        ),
        dataIndex: ['skill', 'name'],
        key: agent.id,
        width: 100,
        render: (skillName: string) => {
          const value = matrixData.matrix[agent.id]?.[skillName]
          if (value === null || value === undefined) {
            return <MinusOutlined style={{ color: '#6b7280' }} />
          }
          return (
            <div 
              style={{ cursor: 'pointer', display: 'flex', justifyContent: 'center' }}
              onClick={() => toggleSkill(agent.id, skillName, value === true)}
            >
              {value ? (
                <CheckOutlined style={{ color: '#10b981', fontSize: 16 }} />
              ) : (
                <CloseOutlined style={{ color: '#ef4444', fontSize: 16 }} />
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
              placeholder="Search agents..."
              value={searchAgent}
              onChange={e => setSearchAgent(e.target.value)}
              allowClear
            />
          </Col>
          <Col span={12}>
            <Input.Search
              placeholder="Search skills..."
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

  // Agent Dimension View
  const renderAgentView = () => {
    const filteredAgents = matrixData.agents.filter(a => 
      a.name.toLowerCase().includes(searchAgent.toLowerCase()) ||
      a.id.toLowerCase().includes(searchAgent.toLowerCase())
    )

    const agentColumns: ColumnsType<AgentInfo> = [
      {
        title: 'Agent',
        dataIndex: 'name',
        key: 'name',
        render: (text: string, record: AgentInfo) => (
          <div>
            <div style={{ fontWeight: 500 }}>{text}</div>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>{record.id}</div>
          </div>
        )
      },
      {
        title: 'Model',
        dataIndex: 'model',
        key: 'model',
        width: 150
      },
      {
        title: 'Configured Skills',
        dataIndex: 'configured_skills',
        key: 'configured_skills',
        width: 120,
        render: (skills: string[] | null) => (
          <Tag color={skills === null ? 'green' : 'blue'}>
            {skills === null ? 'All' : skills.length}
          </Tag>
        )
      },
      {
        title: 'Action',
        key: 'action',
        width: 80,
        render: (_: any, record: AgentInfo) => (
          <Button 
            size="small" 
            type={selectedAgent === record.id ? 'primary' : 'default'}
            onClick={() => setSelectedAgent(record.id)}
          >
            View
          </Button>
        )
      }
    ]

    return (
      <Row gutter={16}>
        <Col span={10}>
          <Input.Search
            placeholder="Search agents..."
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
              title={`${agentDetail.agent_name} Skills`}
              extra={
                <div>
                  <Button 
                    size="small" 
                    onClick={() => updateAgentSkills(selectedAgent, '*')}
                    loading={updating}
                    style={{ marginRight: 8 }}
                  >
                    Enable All
                  </Button>
                  <Button 
                    size="small" 
                    danger
                    onClick={() => updateAgentSkills(selectedAgent, [])}
                    loading={updating}
                  >
                    Disable All
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
                      borderBottom: '1px solid #2e2e42'
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500 }}>{skill.name}</div>
                      <div style={{ fontSize: 12, color: '#94a3b8' }}>{skill.description}</div>
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
              <div style={{ textAlign: 'center', color: '#94a3b8', padding: 40 }}>
                Select an agent to view and manage skills
              </div>
            </Card>
          )}
        </Col>
      </Row>
    )
  }

  // Skill Dimension View
  const renderSkillView = () => {
    const filteredSkills = matrixData.skills.filter(s =>
      s.name.toLowerCase().includes(searchSkill.toLowerCase()) ||
      s.description.toLowerCase().includes(searchSkill.toLowerCase())
    )

    const skillColumns: ColumnsType<SkillInfo> = [
      {
        title: 'Skill',
        dataIndex: 'name',
        key: 'name',
        render: (text: string, record: SkillInfo) => (
          <div>
            <div style={{ fontWeight: 500 }}>{text}</div>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>{record.description}</div>
          </div>
        )
      },
      {
        title: 'Source',
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
        title: 'Agents',
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
        title: 'Action',
        key: 'action',
        width: 80,
        render: (_: any, record: SkillInfo) => (
          <Button 
            size="small" 
            type={selectedSkill === record.name ? 'primary' : 'default'}
            onClick={() => setSelectedSkill(record.name)}
          >
            View
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
            placeholder="Search skills..."
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
            <Card title={`${selectedSkillInfo.name} Agents`}>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 500 }}>Description</div>
                <div style={{ color: '#94a3b8' }}>{selectedSkillInfo.description}</div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 500 }}>Source</div>
                <Tag color={selectedSkillInfo.source === 'openclaw-bundled' ? 'green' : 'blue'}>
                  {selectedSkillInfo.source}
                </Tag>
              </div>
              <div style={{ fontWeight: 500, marginBottom: 8 }}>Agents with this skill</div>
              <div style={{ maxHeight: 450, overflowY: 'auto' }}>
                <Table
                  dataSource={agentsWithSelectedSkill}
                  columns={[
                    {
                      title: 'Agent',
                      dataIndex: 'name',
                      key: 'name',
                      render: (text: string, record: AgentInfo) => (
                        <div>
                          <div style={{ fontWeight: 500 }}>{text}</div>
                          <div style={{ fontSize: 12, color: '#94a3b8' }}>{record.id}</div>
                        </div>
                      )
                    },
                    {
                      title: 'Model',
                      dataIndex: 'model',
                      key: 'model',
                      width: 150
                    },
                    {
                      title: 'Enabled',
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
              <div style={{ textAlign: 'center', color: '#94a3b8', padding: 40 }}>
                Select a skill to view which agents have it installed
              </div>
            </Card>
          )}
        </Col>
      </Row>
    )
  }

  const tabItems = [
    {
      key: 'matrix',
      label: 'Matrix View',
      children: renderMatrixView()
    },
    {
      key: 'agent',
      label: 'Agent Dimension',
      children: renderAgentView()
    },
    {
      key: 'skill',
      label: 'Skill Dimension',
      children: renderSkillView()
    }
  ]

  return (
    <div>
      <div className="page-header">
        <p className="page-header-eyebrow">Agent Management</p>
        <h1>Agent-Skill Management</h1>
        <p className="page-header-desc">Manage agent capabilities and skill assignments</p>
      </div>
      
      {/* Statistics */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card>
            <Statistic title="Total Agents" value={totalAgents} />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="Total Skills" value={totalSkills} />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="Avg Skills/Agent" value={avgSkillsPerAgent} />
          </Card>
        </Col>
      </Row>

      {/* Tabs */}
      <Tabs defaultActiveKey="matrix" items={tabItems} />
    </div>
  )
}
