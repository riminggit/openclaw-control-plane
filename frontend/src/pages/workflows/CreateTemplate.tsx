/**
 * CreateTemplate - 创建/编辑工作流模板页面 (重新设计版)
 * 
 * 设计原则（基于竞品调研）：
 * 1. 渐进式披露 - 不要一开始就展示所有复杂功能
 * 2. 引导式流程 - Step-by-step 创建流程
 * 3. 清晰易懂 - 每个模块都有说明
 * 4. 上下文帮助 - 提供 tooltip 和说明文字
 * 
 * 竞品参考：
 * - n8n: 三区域布局，清晰的步骤卡片
 * - Zapier: 引导式流程，快速上手
 * - GitHub Actions: 简洁的可视化
 * - Jenkins: 表格化视图，历史对比
 */

import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, message, Input, Select, Spin, Steps, Card, Tooltip } from 'antd'
import { 
  InfoCircleOutlined, 
  QuestionCircleOutlined,
  CheckCircleOutlined,
  PlusOutlined,
  DeleteOutlined
} from '@ant-design/icons'
import { BackButton } from '../../components/common/BackButton'
import { templatesApi } from '../../api/templates'
import {
  DAG,
  WorkflowConfig,
  FailureStrategy,
  DAGStep
} from '../../types/workflow'

const { TextArea } = Input

// 步骤指示器的步骤
const STEPS = [
  { title: '基本信息', description: '模板名称和描述' },
  { title: '定义步骤', description: '配置工作流步骤' },
  { title: '高级设置', description: '超时和重试策略' },
  { title: '预览确认', description: '检查并保存' }
]

// Agent 任务卡片组件（用于预览）
interface AgentTask {
  id: string
  agentId: string
  taskName: string
  status: 'pending' | 'running' | 'completed' | 'error'
  progress: number
  startTime?: Date
  endTime?: Date
}

function AgentTaskCard({ task }: { task: AgentTask }) {
  const statusColors = {
    pending: '#94a3b8',
    running: '#3b82f6',
    completed: '#22c55e',
    error: '#ef4444'
  }

  const statusLabels = {
    pending: '等待中',
    running: '执行中',
    completed: '已完成',
    error: '出错'
  }

  return (
    <Card 
      size="small" 
      style={{ 
        marginBottom: '12px',
        borderLeft: `3px solid ${statusColors[task.status]}`
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 500, marginBottom: '4px' }}>
            {task.taskName}
          </div>
          <div style={{ fontSize: '12px', color: '#94a3b8' }}>
            {task.agentId}
          </div>
        </div>
        <span style={{
          padding: '2px 8px',
          borderRadius: '4px',
          fontSize: '12px',
          fontWeight: 500,
          background: `${statusColors[task.status]}20`,
          color: statusColors[task.status]
        }}>
          {statusLabels[task.status]}
        </span>
      </div>
      
      {task.status === 'running' && (
        <div style={{ marginTop: '8px' }}>
          <div style={{ 
            height: 4, 
            background: '#1e1e2e', 
            borderRadius: 2,
            overflow: 'hidden'
          }}>
            <div style={{
              height: '100%',
              width: `${task.progress}%`,
              background: '#3b82f6',
              transition: 'width 0.3s'
            }} />
          </div>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
            {task.progress}% 完成
          </div>
        </div>
      )}
    </Card>
  )
}

// 步骤卡片组件（简化版 DAG 配置）
function StepCard({ 
  step, 
  index, 
  allSteps,
  onUpdate, 
  onDelete,
  isFirst 
}: { 
  step: DAGStep
  index: number
  allSteps: DAGStep[]
  onUpdate: (step: DAGStep) => void
  onDelete: () => void
  isFirst: boolean
}) {
  return (
    <Card 
      size="small"
      style={{ marginBottom: '12px' }}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ 
            background: '#3b82f6', 
            color: 'white', 
            width: 24, 
            height: 24, 
            borderRadius: '50%', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            fontSize: '12px',
            fontWeight: 600
          }}>
            {index + 1}
          </span>
          <Input
            value={step.name}
            onChange={(e) => onUpdate({ ...step, name: e.target.value })}
            placeholder="步骤名称"
            style={{ border: 'none', fontWeight: 600, padding: 0 }}
          />
        </div>
      }
      extra={
        <Button 
          type="text" 
          danger 
          size="small"
          icon={<DeleteOutlined />}
          onClick={onDelete}
        >
          删除
        </Button>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div>
          <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
            执行 Agent *
          </label>
          <Input
            value={step.agent}
            onChange={(e) => onUpdate({ ...step, agent: e.target.value })}
            placeholder="例如：rd-backend-dev"
            size="small"
          />
        </div>
        
        <div>
          <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
            预估时长（分钟）
          </label>
          <Input
            type="number"
            value={step.estimated_duration || ''}
            onChange={(e) => onUpdate({ 
              ...step, 
              estimated_duration: parseInt(e.target.value) || undefined 
            })}
            placeholder="可选"
            size="small"
            min={1}
          />
        </div>

        {!isFirst && (
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
              依赖步骤
            </label>
            <Select
              mode="multiple"
              value={step.depends_on}
              onChange={(value) => onUpdate({ ...step, depends_on: value })}
              placeholder="选择依赖的步骤"
              style={{ width: '100%' }}
              size="small"
            >
              {allSteps
                .filter(s => s.id !== step.id)
                .map(s => (
                  <Select.Option key={s.id} value={s.id}>
                    {s.name}
                  </Select.Option>
                ))
              }
            </Select>
            <p style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
              此步骤将在所有依赖步骤完成后才开始执行
            </p>
          </div>
        )}

        <div style={{ gridColumn: '1 / -1' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              checked={step.human_review || false}
              onChange={(e) => onUpdate({ ...step, human_review: e.target.checked })}
            />
            <span style={{ fontSize: '12px' }}>需要人工审核</span>
            <Tooltip title="勾选后，此步骤执行完成会暂停等待人工审核">
              <QuestionCircleOutlined style={{ color: '#94a3b8', fontSize: '12px' }} />
            </Tooltip>
          </label>
        </div>
      </div>
    </Card>
  )
}

export default function CreateTemplate() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isEditMode = Boolean(id)

  // 当前步骤
  const [currentStep, setCurrentStep] = useState(0)

  // 表单状态
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [dag, setDag] = useState<DAG>({ steps: [], edges: [] })
  const [config, setConfig] = useState<WorkflowConfig>({
    single_step_timeout: 300,
    workflow_timeout: 3600,
    max_retries: 3,
    failure_strategy: FailureStrategy.RETRY
  })

  // UI 状态
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 加载模板数据（编辑模式）
  useEffect(() => {
    if (!isEditMode || !id) return

    setLoading(true)
    templatesApi.get(id)
      .then(data => {
        setName(data.name)
        setDescription(data.description || '')
        setTags(data.tags || [])
        setDag(data.dag)
        if (data.config) {
          setConfig(data.config)
        }
      })
      .catch(err => {
        setError(err.message || '加载失败')
        message.error('加载模板失败')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [isEditMode, id])

  // 添加步骤
  const handleAddStep = () => {
    const newStep: DAGStep = {
      id: `step-${Date.now()}`,
      name: `步骤 ${dag.steps.length + 1}`,
      agent: '',
      depends_on: dag.steps.length > 0 ? [dag.steps[dag.steps.length - 1].id] : []
    }

    // 自动创建依赖边
    const newEdges = [...dag.edges]
    if (dag.steps.length > 0) {
      newEdges.push({
        source: dag.steps[dag.steps.length - 1].id,
        target: newStep.id
      })
    }

    setDag({
      steps: [...dag.steps, newStep],
      edges: newEdges
    })
  }

  // 更新步骤
  const handleUpdateStep = (index: number, updatedStep: DAGStep) => {
    const newSteps = [...dag.steps]
    newSteps[index] = updatedStep
    setDag({ ...dag, steps: newSteps })
  }

  // 删除步骤
  const handleDeleteStep = (index: number) => {
    const stepId = dag.steps[index].id
    const newSteps = dag.steps.filter((_, i) => i !== index)
    const newEdges = dag.edges.filter(e => e.source !== stepId && e.target !== stepId)
    
    // 移除其他步骤中的依赖引用
    newSteps.forEach(step => {
      step.depends_on = step.depends_on.filter(id => id !== stepId)
    })
    
    setDag({ steps: newSteps, edges: newEdges })
  }

  // 表单验证
  const validate = (): boolean => {
    if (!name.trim()) {
      message.error('请输入模板名称')
      setCurrentStep(0)
      return false
    }

    if (dag.steps.length === 0) {
      message.error('请至少添加一个步骤')
      setCurrentStep(1)
      return false
    }

    // 检查步骤是否有空的 agent
    const emptyAgentStep = dag.steps.find(s => !s.agent.trim())
    if (emptyAgentStep) {
      message.error(`步骤 "${emptyAgentStep.name}" 缺少执行 Agent`)
      setCurrentStep(1)
      return false
    }

    return true
  }

  // 保存草稿
  const handleSaveDraft = async () => {
    if (!validate()) return

    setSaving(true)
    setError(null)

    try {
      const data = {
        name: name.trim(),
        description: description.trim() || undefined,
        dag,
        config,
        tags: tags.length > 0 ? tags : undefined
      }

      if (isEditMode && id) {
        await templatesApi.update(id, data)
        message.success('模板更新成功')
      } else {
        const result = await templatesApi.create(data)
        message.success('模板创建成功')
        navigate(`/workflows/template/${result.id}`)
      }
    } catch (err: any) {
      setError(err.message || '保存失败')
      message.error(err.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  // 保存并发布
  const handlePublish = async () => {
    if (!validate()) return

    setSaving(true)
    setError(null)

    try {
      const data = {
        name: name.trim(),
        description: description.trim() || undefined,
        dag,
        config,
        tags: tags.length > 0 ? tags : undefined
      }

      let templateId = id

      // 先保存
      if (isEditMode && id) {
        await templatesApi.update(id, data)
      } else {
        const result = await templatesApi.create(data)
        templateId = result.id
      }

      // 再发布
      if (templateId) {
        await templatesApi.publish(templateId)
        message.success('模板已发布')
        navigate(`/workflows/template/${templateId}`)
      }
    } catch (err: any) {
      setError(err.message || '发布失败')
      message.error(err.message || '发布失败')
    } finally {
      setSaving(false)
    }
  }

  // 添加标签
  const handleAddTag = () => {
    const tag = tagInput.trim()
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag])
      setTagInput('')
    }
  }

  // 删除标签
  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag))
  }

  // 下一步
  const handleNext = () => {
    if (currentStep === 0) {
      if (!name.trim()) {
        message.error('请输入模板名称')
        return
      }
    } else if (currentStep === 1) {
      if (dag.steps.length === 0) {
        message.error('请至少添加一个步骤')
        return
      }
      const emptyAgentStep = dag.steps.find(s => !s.agent.trim())
      if (emptyAgentStep) {
        message.error(`步骤 "${emptyAgentStep.name}" 缺少执行 Agent`)
        return
      }
    }
    setCurrentStep(currentStep + 1)
  }

  // 上一步
  const handlePrev = () => {
    setCurrentStep(Math.max(0, currentStep - 1))
  }

  // 加载状态
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* 返回按钮 */}
      <div style={{ marginBottom: '16px' }}>
        <BackButton to="/workflows" text="返回模板库" />
      </div>

      {/* 页面标题 */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 600, marginBottom: '8px' }}>
          {isEditMode ? '编辑模板' : '创建模板'}
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '14px' }}>
          {isEditMode ? '修改现有工作流模板' : '创建新的工作流模板'}
        </p>
      </div>

      {/* 步骤指示器 */}
      <Steps current={currentStep} items={STEPS} style={{ marginBottom: '32px' }} />

      {/* 错误提示 */}
      {error && (
        <Card 
          style={{ 
            marginBottom: '16px',
            background: '#fef2f2',
            border: '1px solid #ef4444'
          }}
        >
          <p style={{ color: '#dc2626' }}>{error}</p>
        </Card>
      )}

      {/* Step 0: 基本信息 */}
      {currentStep === 0 && (
        <Card style={{ marginBottom: '24px' }}>
          <div style={{ marginBottom: '24px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>
              基本信息
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '14px' }}>
              为您的工作流模板命名并添加描述
            </p>
          </div>

          <div style={{ display: 'grid', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
                模板名称 *
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例如：后端 API 开发流程"
                size="large"
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
                模板描述
              </label>
              <TextArea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="描述这个工作流的用途和特点..."
                rows={4}
              />
              <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                清晰的描述可以帮助团队成员理解这个工作流的用途
              </p>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
                标签
                <Tooltip title="标签可以帮助您快速筛选和查找模板">
                  <QuestionCircleOutlined style={{ color: '#94a3b8', marginLeft: '4px' }} />
                </Tooltip>
              </label>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onPressEnter={(e) => {
                    e.preventDefault()
                    handleAddTag()
                  }}
                  placeholder="输入标签后按Enter添加"
                  style={{ flex: 1 }}
                />
                <Button onClick={handleAddTag}>添加</Button>
              </div>
              
              {tags.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {tags.map(tag => (
                    <span 
                      key={tag} 
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '4px 12px',
                        borderRadius: '16px',
                        background: '#1e3a8a',
                        color: '#93c5fd',
                        fontSize: '12px'
                      }}
                    >
                      {tag}
                      <span 
                        style={{ cursor: 'pointer', opacity: 0.6 }}
                        onClick={() => handleRemoveTag(tag)}
                      >
                        ✕
                      </span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Step 1: 定义步骤 */}
      {currentStep === 1 && (
        <Card style={{ marginBottom: '24px' }}>
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 600 }}>
                工作流步骤
              </h2>
              <Button 
                type="primary" 
                icon={<PlusOutlined />}
                onClick={handleAddStep}
              >
                添加步骤
              </Button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', fontSize: '14px' }}>
              <InfoCircleOutlined />
              <span>
                定义工作流的执行步骤。每个步骤由一个 Agent 执行，步骤之间可以设置依赖关系。
              </span>
            </div>
          </div>

          {dag.steps.length === 0 ? (
            <div style={{ 
              textAlign: 'center', 
              padding: '48px 24px', 
              background: '#1e1e2e',
              borderRadius: '8px',
              marginBottom: '16px'
            }}>
              <p style={{ color: '#94a3b8', marginBottom: '16px' }}>
                还没有添加任何步骤
              </p>
              <Button 
                type="primary" 
                icon={<PlusOutlined />}
                onClick={handleAddStep}
                size="large"
              >
                添加第一个步骤
              </Button>
            </div>
          ) : (
            <div style={{ marginBottom: '16px' }}>
              {dag.steps.map((step, index) => (
                <StepCard
                  key={step.id}
                  step={step}
                  index={index}
                  allSteps={dag.steps}
                  onUpdate={(updatedStep) => handleUpdateStep(index, updatedStep)}
                  onDelete={() => handleDeleteStep(index)}
                  isFirst={index === 0}
                />
              ))}
            </div>
          )}

          {dag.steps.length > 0 && (
            <div style={{ 
              padding: '12px', 
              background: '#1e3a8a', 
              borderRadius: '8px',
              fontSize: '13px',
              color: '#93c5fd'
            }}>
              <strong>💡 提示：</strong>
              <ul style={{ margin: '8px 0 0 20px', padding: 0 }}>
                <li>步骤按照添加顺序自动建立依赖关系，您可以手动修改</li>
                <li>勾选"需要人工审核"后，步骤执行完成会暂停等待审核</li>
                <li>预估时长可以帮助您规划工作流执行时间</li>
              </ul>
            </div>
          )}
        </Card>
      )}

      {/* Step 2: 高级配置 */}
      {currentStep === 2 && (
        <Card style={{ marginBottom: '24px' }}>
          <div style={{ marginBottom: '24px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>
              高级配置
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '14px' }}>
              配置超时时间、重试策略等高级选项
            </p>
          </div>

          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
            gap: '20px' 
          }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
                单步超时（秒）
                <Tooltip title="单个步骤执行的最大时间，超时后将触发失败策略">
                  <QuestionCircleOutlined style={{ color: '#94a3b8', marginLeft: '4px' }} />
                </Tooltip>
              </label>
              <Input
                type="number"
                value={config.single_step_timeout || 300}
                onChange={(e) => setConfig({
                  ...config,
                  single_step_timeout: parseInt(e.target.value) || 300
                })}
                min={60}
              />
              <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                建议范围: 60-1800秒
              </p>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
                工作流超时（秒）
                <Tooltip title="整个工作流执行的最大时间">
                  <QuestionCircleOutlined style={{ color: '#94a3b8', marginLeft: '4px' }} />
                </Tooltip>
              </label>
              <Input
                type="number"
                value={config.workflow_timeout || 3600}
                onChange={(e) => setConfig({
                  ...config,
                  workflow_timeout: parseInt(e.target.value) || 3600
                })}
                min={300}
              />
              <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                建议范围: 300-86400秒
              </p>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
                最大重试次数
                <Tooltip title="步骤失败后自动重试的最大次数">
                  <QuestionCircleOutlined style={{ color: '#94a3b8', marginLeft: '4px' }} />
                </Tooltip>
              </label>
              <Input
                type="number"
                value={config.max_retries || 3}
                onChange={(e) => setConfig({
                  ...config,
                  max_retries: parseInt(e.target.value) || 3
                })}
                min={0}
                max={10}
              />
              <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                建议范围: 0-10次
              </p>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
                失败策略
                <Tooltip title="步骤失败后采取的处理方式">
                  <QuestionCircleOutlined style={{ color: '#94a3b8', marginLeft: '4px' }} />
                </Tooltip>
              </label>
              <Select
                value={config.failure_strategy || FailureStrategy.RETRY}
                onChange={(value) => setConfig({
                  ...config,
                  failure_strategy: value
                })}
                style={{ width: '100%' }}
                options={[
                  { value: FailureStrategy.RETRY, label: '自动重试' },
                  { value: FailureStrategy.SKIP, label: '跳过步骤' },
                  { value: FailureStrategy.ESCALATE, label: '上报处理' },
                  { value: FailureStrategy.TERMINATE, label: '终止工作流' }
                ]}
              />
            </div>
          </div>
        </Card>
      )}

      {/* Step 3: 预览确认 */}
      {currentStep === 3 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
          {/* 基本信息 */}
          <Card title="基本信息" style={{ height: 'fit-content' }}>
            <div style={{ display: 'grid', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>模板名称</div>
                <div style={{ fontWeight: 500 }}>{name}</div>
              </div>
              {description && (
                <div>
                  <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>描述</div>
                  <div>{description}</div>
                </div>
              )}
              {tags.length > 0 && (
                <div>
                  <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>标签</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {tags.map(tag => (
                      <span 
                        key={tag} 
                        style={{
                          padding: '2px 8px',
                          borderRadius: '12px',
                          background: '#1e3a8a',
                          color: '#93c5fd',
                          fontSize: '12px'
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* 配置信息 */}
          <Card title="高级配置" style={{ height: 'fit-content' }}>
            <div style={{ display: 'grid', gap: '12px', fontSize: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>单步超时</span>
                <span>{config.single_step_timeout}秒</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>工作流超时</span>
                <span>{config.workflow_timeout}秒</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>最大重试次数</span>
                <span>{config.max_retries}次</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>失败策略</span>
                <span>
                  {config.failure_strategy === FailureStrategy.RETRY && '自动重试'}
                  {config.failure_strategy === FailureStrategy.SKIP && '跳过步骤'}
                  {config.failure_strategy === FailureStrategy.ESCALATE && '上报处理'}
                  {config.failure_strategy === FailureStrategy.TERMINATE && '终止工作流'}
                </span>
              </div>
            </div>
          </Card>

          {/* 工作流步骤 */}
          <Card 
            title={`工作流步骤 (${dag.steps.length}个)`} 
            style={{ gridColumn: '1 / -1' }}
          >
            {dag.steps.map((step, index) => (
              <div 
                key={step.id}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '12px',
                  padding: '12px',
                  background: '#1e1e2e',
                  borderRadius: '8px',
                  marginBottom: index < dag.steps.length - 1 ? '8px' : 0
                }}
              >
                <div style={{ 
                  background: '#3b82f6', 
                  color: 'white', 
                  width: 32, 
                  height: 32, 
                  borderRadius: '50%', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  fontWeight: 600,
                  flexShrink: 0
                }}>
                  {index + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, marginBottom: '4px' }}>{step.name}</div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                    Agent: {step.agent}
                    {step.estimated_duration && ` · 预估: ${step.estimated_duration}分钟`}
                    {step.human_review && ` · 需要审核`}
                  </div>
                </div>
                {step.depends_on.length > 0 && (
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                    依赖: {step.depends_on.map(id => dag.steps.find(s => s.id === id)?.name).join(', ')}
                  </div>
                )}
              </div>
            ))}
          </Card>
        </div>
      )}

      {/* 底部操作栏 */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: '24px',
        borderTop: '1px solid #2e2e42'
      }}>
        <div>
          {currentStep > 0 && (
            <Button 
              size="large"
              onClick={handlePrev}
            >
              上一步
            </Button>
          )}
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <Button 
            size="large"
            onClick={() => navigate('/workflows')}
          >
            取消
          </Button>
          
          {currentStep < STEPS.length - 1 ? (
            <Button 
              type="primary"
              size="large"
              onClick={handleNext}
            >
              下一步
            </Button>
          ) : (
            <>
              <Button 
                size="large"
                onClick={handleSaveDraft}
                disabled={saving}
              >
                {saving ? '保存中...' : '保存草稿'}
              </Button>
              <Button 
                type="primary"
                size="large"
                onClick={handlePublish}
                disabled={saving}
                loading={saving}
              >
                {saving ? '发布中...' : '保存并发布'}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
