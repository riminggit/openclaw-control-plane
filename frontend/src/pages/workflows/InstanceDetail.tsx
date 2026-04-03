import React, { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { DAGViewer } from '../../components/workflow/DAGViewer'
import { StepCard } from '../../components/workflow/StepCard'
import { useWorkflowInstance } from '../../hooks/useWorkflow'
import { templatesApi } from '../../api/templates'
import { DAG, WorkflowStatus } from '../../types/workflow'

const statusLabel: Record<string, string> = {
  [WorkflowStatus.PENDING]: '等待中',
  [WorkflowStatus.RUNNING]: '运行中',
  [WorkflowStatus.PAUSED]: '已暂停',
  [WorkflowStatus.COMPLETED]: '已完成',
  [WorkflowStatus.FAILED]: '失败',
  [WorkflowStatus.TERMINATED]: '已终止',
}

/**
 * 错误边界组件
 */
class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode; fallback?: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="p-6 rounded-lg border border-red-800 bg-red-950/40 text-red-100">
            <h2 className="text-lg font-semibold mb-2">页面出错了</h2>
            <p className="text-red-200/90 mb-4">{this.state.error?.message || '未知错误'}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-red-700 text-white rounded hover:bg-red-600"
            >
              刷新页面
            </button>
          </div>
        )
      )
    }

    return this.props.children
  }
}

const LoadingSpinner: React.FC = () => (
  <div className="flex items-center justify-center p-12">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
    <span className="ml-3 text-gray-400">加载中…</span>
  </div>
)

export default function InstanceDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { data, loading, error } = useWorkflowInstance(id || null)
  const [dagData, setDagData] = useState<DAG | null>(null)

  useEffect(() => {
    if (!data?.template_id) return
    let cancelled = false

    const fallbackLinearDag = () => {
      if (!data.steps?.length) return
      const steps = data.steps.map((s) => ({
        id: s.step_id,
        name: s.name,
        agent: s.agent_name || '-',
        depends_on: [] as string[],
      }))
      const edges: Array<{ source: string; target: string }> = []
      data.steps.forEach((step, i) => {
        if (i > 0) {
          edges.push({ source: data.steps[i - 1].step_id, target: step.step_id })
        }
      })
      setDagData({ steps, edges })
    }

    templatesApi
      .get(data.template_id)
      .then((tpl) => {
        if (cancelled) return
        const dag = tpl.dag
        if (!dag?.steps?.length) {
          fallbackLinearDag()
          return
        }
        const steps = dag.steps.map((s) => ({
          id: s.id,
          name: s.name,
          agent: s.agent,
          depends_on: s.depends_on ?? [],
        }))
        const edges: Array<{ source: string; target: string }> = []
        for (const s of dag.steps) {
          for (const dep of s.depends_on ?? []) {
            edges.push({ source: dep, target: s.id })
          }
        }
        setDagData({ steps, edges })
      })
      .catch(() => {
        if (!cancelled) fallbackLinearDag()
      })

    return () => {
      cancelled = true
    }
  }, [data])

  if (!id) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-amber-800/60 bg-amber-950/30 p-6 text-amber-100">
          <h2 className="text-lg font-semibold mb-2">缺少实例 ID</h2>
          <p className="text-amber-200/80 mb-4">请从工作流列表中选择一个实例查看</p>
          <button
            type="button"
            onClick={() => navigate('/workflows/instances')}
            className="px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-500"
          >
            返回实例列表
          </button>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-800 bg-red-950/40 p-6 text-red-100">
          <h2 className="text-lg font-semibold mb-2">加载失败</h2>
          <p className="text-red-200/90 mb-4">{error.message || '未知错误'}</p>
          <button
            type="button"
            onClick={() => navigate('/workflows/instances')}
            className="px-4 py-2 bg-red-700 text-white rounded hover:bg-red-600"
          >
            返回实例列表
          </button>
        </div>
      </div>
    )
  }

  if (loading || !data) {
    return <LoadingSpinner />
  }

  const statusText = statusLabel[data.status] ?? data.status

  return (
    <ErrorBoundary>
      <div className="p-6 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">实例详情</h1>
            <p className="text-gray-500 mt-1">工作流执行状态、步骤明细与 DAG 进展</p>
          </div>
          <Link to="/workflows/instances" className="text-sm text-blue-400 hover:text-blue-300">
            {t('app.back')}
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-lg border border-gray-700 bg-gray-800/60 p-4">
            <div className="text-sm text-gray-500">状态</div>
            <div className="text-lg font-semibold text-white mt-1">{statusText}</div>
          </div>
          <div className="rounded-lg border border-gray-700 bg-gray-800/60 p-4">
            <div className="text-sm text-gray-500">进度</div>
            <div className="text-lg font-semibold text-white mt-1 tabular-nums">{data.progress}%</div>
          </div>
          <div className="rounded-lg border border-gray-700 bg-gray-800/60 p-4">
            <div className="text-sm text-gray-500">模板</div>
            <div className="text-lg font-semibold text-white mt-1 truncate">
              {data.template_name || '未知模板'}
            </div>
          </div>
        </div>

        {dagData && (
          <div className="rounded-lg border border-gray-700 bg-gray-800/40 p-4 overflow-x-auto">
            <DAGViewer
              dag={dagData}
              stepsStatus={Object.fromEntries(data.steps.map((s) => [s.step_id, s.status]))}
              stepsProgress={Object.fromEntries(data.steps.map((s) => [s.step_id, s.progress || 0]))}
            />
          </div>
        )}

        <div>
          <h2 className="text-xl font-bold text-white mb-4">步骤列表</h2>
          <div className="grid gap-4">
            {data.steps.map((step) => (
              <StepCard key={step.id} step={step} />
            ))}
          </div>
        </div>
      </div>
    </ErrorBoundary>
  )
}
