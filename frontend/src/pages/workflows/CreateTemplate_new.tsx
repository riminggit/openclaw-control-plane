/**
 * CreateTemplate - 创建/编辑工作流模板页面
 * 
 * 严格遵循UI设计规范：
 * - 使用CSS变量
 * - 包含返回按钮
 * - 使用通用组件
 */

import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BackButton, Button, PageHeader } from '../../components/common'
import { DAGEditor } from '../../components/workflow/DAGEditor'
import { templatesApi } from '../../api/templates'
import {
  DAG,
  DAGStep,
  WorkflowConfig,
  TemplateStatus,
  FailureStrategy
} from '../../types/workflow'
import '../../styles/global.css'
import './CreateTemplate.css'

export default function CreateTemplate() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isEditMode = Boolean(id)

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
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

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
      })
      .finally(() => {
        setLoading(false)
      })
  }, [isEditMode, id])

  // 表单验证
  const validate = (): boolean => {
    const errors: Record<string, string> = {}

    if (!name.trim()) {
      errors.name = '请输入模板名称'
    }

    if (dag.steps.length === 0) {
      errors.dag = '请至少添加一个步骤'
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
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
        alert('模板更新成功')
      } else {
        const result = await templatesApi.create(data)
        alert('模板创建成功')
        navigate(`/workflows/template/${result.id}`)
      }
    } catch (err: any) {
      setError(err.message || '保存失败')
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
        alert('模板已发布')
        navigate(`/workflows/template/${templateId}`)
      }
    } catch (err: any) {
      setError(err.message || '发布失败')
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

  // 加载状态
  if (loading) {
    return (
      <div className="page-container">
        <div className="flex-center" style={{ minHeight: '400px' }}>
          <div className="loading-spinner"></div>
          <span className="text-secondary" style={{ marginLeft: 'var(--spacing-sm)' }}>
            加载中...
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="create-template-page">
      {/* 页面头部 - 包含返回按钮 */}
      <PageHeader
        title={isEditMode ? '编辑模板' : '创建模板'}
        subtitle={isEditMode ? '修改现有工作流模板' : '创建新的工作流模板'}
        showBackButton={true}
        backTo="/workflows/templates"
        backText="返回模板库"
      />

      {/* 错误提示 */}
      {error && (
        <div className="error-alert">
          {error}
        </div>
      )}

      {/* 基本信息 */}
      <div className="form-section">
        <h2 className="form-section-title">基本信息</h2>
        
        <div className="form-item">
          <label className="form-label form-label-required">模板名称</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="请输入模板名称"
            className={`input ${validationErrors.name ? 'input-error' : ''}`}
          />
          {validationErrors.name && (
            <p className="form-error">{validationErrors.name}</p>
          )}
        </div>

        <div className="form-item">
          <label className="form-label">模板描述</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="请输入模板描述"
            className="textarea"
            rows={3}
          />
        </div>

        <div className="form-item">
          <label className="form-label">标签</label>
          <div className="flex" style={{ gap: 'var(--spacing-sm)' }}>
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleAddTag()
                }
              }}
              placeholder="输入标签后按Enter添加"
              className="input"
              style={{ flex: 1 }}
            />
            <Button type="default" onClick={handleAddTag}>
              添加
            </Button>
          </div>
          
          {tags.length > 0 && (
            <div className="tag-list">
              {tags.map(tag => (
                <span key={tag} className="tag-item">
                  {tag}
                  <span 
                    className="tag-remove" 
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

      {/* DAG配置 */}
      <div className="form-section">
        <h2 className="form-section-title">DAG 配置</h2>
        
        {validationErrors.dag && (
          <p className="form-error mb-3">{validationErrors.dag}</p>
        )}
        
        <div className="dag-editor-container">
          <DAGEditor
            dag={dag}
            onChange={setDag}
          />
        </div>
      </div>

      {/* 配置 */}
      <div className="form-section">
        <h2 className="form-section-title">高级配置</h2>
        
        <div className="form-grid">
          <div className="form-item">
            <label className="form-label">单步超时（秒）</label>
            <input
              type="number"
              value={config.single_step_timeout || 300}
              onChange={(e) => setConfig({
                ...config,
                single_step_timeout: parseInt(e.target.value) || 300
              })}
              min={60}
              className="input"
            />
            <p className="form-hint">建议范围: 60-1800秒</p>
          </div>

          <div className="form-item">
            <label className="form-label">工作流超时（秒）</label>
            <input
              type="number"
              value={config.workflow_timeout || 3600}
              onChange={(e) => setConfig({
                ...config,
                workflow_timeout: parseInt(e.target.value) || 3600
              })}
              min={300}
              className="input"
            />
            <p className="form-hint">建议范围: 300-86400秒</p>
          </div>

          <div className="form-item">
            <label className="form-label">最大重试次数</label>
            <input
              type="number"
              value={config.max_retries || 3}
              onChange={(e) => setConfig({
                ...config,
                max_retries: parseInt(e.target.value) || 3
              })}
              min={0}
              max={10}
              className="input"
            />
            <p className="form-hint">建议范围: 0-10次</p>
          </div>

          <div className="form-item">
            <label className="form-label">失败策略</label>
            <select
              value={config.failure_strategy || FailureStrategy.RETRY}
              onChange={(e) => setConfig({
                ...config,
                failure_strategy: e.target.value as FailureStrategy
              })}
              className="select"
            >
              <option value={FailureStrategy.RETRY}>自动重试</option>
              <option value={FailureStrategy.SKIP}>跳过步骤</option>
              <option value={FailureStrategy.ESCALATE}>上报处理</option>
              <option value={FailureStrategy.TERMINATE}>终止工作流</option>
            </select>
          </div>
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="page-actions">
        <Button 
          type="default" 
          onClick={() => navigate('/workflows')}
        >
          取消
        </Button>
        <Button 
          type="default" 
          onClick={handleSaveDraft}
          disabled={saving}
        >
          {saving ? '保存中...' : '保存草稿'}
        </Button>
        <Button 
          type="primary" 
          onClick={handlePublish}
          disabled={saving}
          loading={saving}
        >
          {saving ? '发布中...' : '保存并发布'}
        </Button>
      </div>
    </div>
  )
}
