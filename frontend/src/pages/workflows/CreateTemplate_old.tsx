import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { DAGEditor } from '../../components/workflow/DAGEditor'
import { templatesApi } from '../../api/templates'
import {
  DAG,
  DAGStep,
  WorkflowConfig,
  TemplateStatus,
  FailureStrategy
} from '../../types/workflow'

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
        setError(err.message || '加载模板失败')
      })
      .finally(() => setLoading(false))
  }, [id, isEditMode])

  // 验证表单
  const validate = (): boolean => {
    const errors: Record<string, string> = {}

    if (!name.trim()) {
      errors.name = '模板名称不能为空'
    }

    if (dag.steps.length === 0) {
      errors.dag = '至少需要一个步骤'
    }

    // 检查步骤是否有循环依赖
    const hasCycle = checkCycle(dag)
    if (hasCycle) {
      errors.dag = 'DAG 中存在循环依赖'
    }

    // 检查所有步骤的依赖是否存在
    const stepIds = new Set(dag.steps.map(s => s.id))
    for (const step of dag.steps) {
      for (const dep of step.depends_on) {
        if (!stepIds.has(dep)) {
          errors.dag = `步骤 "${step.name}" 依赖了不存在的步骤`
          break
        }
      }
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  // 检查循环依赖
  const checkCycle = (dag: DAG): boolean => {
    const visited = new Set<string>()
    const recursionStack = new Set<string>()

    const hasCycleDFS = (stepId: string): boolean => {
      visited.add(stepId)
      recursionStack.add(stepId)

      const step = dag.steps.find(s => s.id === stepId)
      if (step) {
        for (const dep of step.depends_on) {
          if (!visited.has(dep)) {
            if (hasCycleDFS(dep)) return true
          } else if (recursionStack.has(dep)) {
            return true
          }
        }
      }

      recursionStack.delete(stepId)
      return false
    }

    for (const step of dag.steps) {
      if (!visited.has(step.id)) {
        if (hasCycleDFS(step.id)) return true
      }
    }

    return false
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
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">加载中...</span>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {isEditMode ? '编辑模板' : '创建模板'}
          </h1>
          <p className="text-gray-500 mt-1">
            {isEditMode ? '修改现有工作流模板' : '创建新的工作流模板'}
          </p>
        </div>
        <button
          onClick={() => navigate(-1)}
          className="px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors"
        >
          返回
        </button>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {/* 基本信息 */}
      <div className="rounded-lg border bg-white p-6">
        <h2 className="text-lg font-semibold mb-4">基本信息</h2>
        <div className="space-y-4">
          {/* 模板名称 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              模板名称 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="输入模板名称"
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                validationErrors.name ? 'border-red-500 focus:ring-red-500' : 'focus:ring-blue-500'
              }`}
            />
            {validationErrors.name && (
              <p className="text-red-500 text-sm mt-1">{validationErrors.name}</p>
            )}
          </div>

          {/* 描述 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              描述
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="输入模板描述（可选）"
              rows={3}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 标签 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              标签
            </label>
            <div className="flex items-center gap-2 mb-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                placeholder="输入标签后按 Enter"
                className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleAddTag}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                添加
              </button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {tags.map((tag, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm flex items-center gap-2"
                  >
                    {tag}
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      className="text-blue-500 hover:text-blue-700"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* DAG 编辑器 */}
      <div className="rounded-lg border bg-white p-6">
        <h2 className="text-lg font-semibold mb-4">DAG 流程</h2>
        {validationErrors.dag && (
          <p className="text-red-500 text-sm mb-4">{validationErrors.dag}</p>
        )}
        <DAGEditor
          dag={dag}
          onChange={setDag}
          className="min-h-[400px]"
        />
      </div>

      {/* 配置 */}
      <div className="rounded-lg border bg-white p-6">
        <h2 className="text-lg font-semibold mb-4">配置</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 单步超时 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              单步超时（秒）
            </label>
            <input
              type="number"
              value={config.single_step_timeout || 300}
              onChange={(e) => setConfig({
                ...config,
                single_step_timeout: parseInt(e.target.value) || 300
              })}
              min={60}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 工作流超时 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              工作流超时（秒）
            </label>
            <input
              type="number"
              value={config.workflow_timeout || 3600}
              onChange={(e) => setConfig({
                ...config,
                workflow_timeout: parseInt(e.target.value) || 3600
              })}
              min={300}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 最大重试次数 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              最大重试次数
            </label>
            <input
              type="number"
              value={config.max_retries || 3}
              onChange={(e) => setConfig({
                ...config,
                max_retries: parseInt(e.target.value) || 3
              })}
              min={0}
              max={10}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 失败策略 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              失败策略
            </label>
            <select
              value={config.failure_strategy || FailureStrategy.RETRY}
              onChange={(e) => setConfig({
                ...config,
                failure_strategy: e.target.value as FailureStrategy
              })}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
      <div className="flex items-center justify-end gap-3">
        <button
          onClick={() => navigate(-1)}
          className="px-6 py-2 border rounded-lg hover:bg-gray-50 transition-colors"
        >
          取消
        </button>
        <button
          onClick={handleSaveDraft}
          disabled={saving}
          className="px-6 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-50"
        >
          {saving ? '保存中...' : '保存草稿'}
        </button>
        <button
          onClick={handlePublish}
          disabled={saving}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {saving ? '发布中...' : '保存并发布'}
        </button>
      </div>
    </div>
  )
}
