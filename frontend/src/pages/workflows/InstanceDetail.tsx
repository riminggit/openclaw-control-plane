import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { DAGViewer } from '../../components/workflow/DAGViewer'
import { StepCard } from '../../components/workflow/StepCard'
import { useWorkflowInstance } from '../../hooks/useWorkflow'
import { DAG } from '../../types/workflow'

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
      return this.props.fallback || (
        <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
          <h2 className="text-lg font-semibold text-red-800 mb-2">页面出错了</h2>
          <p className="text-red-600 mb-4">{this.state.error?.message || '未知错误'}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            刷新页面
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

/**
 * 加载状态组件
 */
const LoadingSpinner: React.FC = () => (
  <div className="flex items-center justify-center p-12">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    <span className="ml-3 text-gray-600">加载中...</span>
  </div>
)

/**
 * 工作流实例详情页面
 */
export default function InstanceDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data, loading, error } = useWorkflowInstance(id || null)
  const [dagData, setDagData] = useState<DAG | null>(null)

  // 从模板加载完整的 DAG 数据（包括 edges）
  useEffect(() => {
    if (data?.template_id) {
      // 这里需要从 API 获取模板的完整 DAG 定义
      // 暂时使用实例的步骤数据构建 DAG
      if (data.steps && data.steps.length > 0) {
        const steps = data.steps.map((s) => ({
          id: s.step_id,
          name: s.name,
          agent: s.agent_name || '-',
          depends_on: [] // TODO: 从模板获取依赖关系
        }))

        // 构建 edges（从步骤的依赖关系）
        const edges: Array<{ source: string; target: string }> = []
        data.steps.forEach((step) => {
          // 如果步骤有 depends_on 字段，构建对应的边
          // 暂时使用简单的顺序关系
          const currentIndex = data.steps.findIndex(s => s.step_id === step.step_id)
          if (currentIndex > 0) {
            const prevStep = data.steps[currentIndex - 1]
            edges.push({
              source: prevStep.step_id,
              target: step.step_id
            })
          }
        })

        setDagData({ steps, edges })
      }
    }
  }, [data])

  // 参数验证
  if (!id) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-yellow-800 mb-2">缺少实例ID</h2>
          <p className="text-yellow-600 mb-4">请从工作流列表中选择一个实例查看</p>
          <button
            onClick={() => navigate('/workflows/instances')}
            className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
          >
            返回实例列表
          </button>
        </div>
      </div>
    )
  }

  // 错误状态
  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-red-800 mb-2">加载失败</h2>
          <p className="text-red-600 mb-4">{error.message || '未知错误'}</p>
          <button
            onClick={() => navigate('/workflows/instances')}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            返回实例列表
          </button>
        </div>
      </div>
    )
  }

  // 加载状态
  if (loading || !data) {
    return <LoadingSpinner />
  }

  return (
    <ErrorBoundary>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">实例详情</h1>
          <p className="text-gray-500">工作流执行状态、步骤明细与 DAG 进展</p>
        </div>

        {/* 状态卡片 */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-lg border bg-white p-4">
            <div className="text-sm text-gray-500">状态</div>
            <div className="text-lg font-semibold">{data.status}</div>
          </div>
          <div className="rounded-lg border bg-white p-4">
            <div className="text-sm text-gray-500">进度</div>
            <div className="text-lg font-semibold">{data.progress}%</div>
          </div>
          <div className="rounded-lg border bg-white p-4">
            <div className="text-sm text-gray-500">模板</div>
            <div className="text-lg font-semibold">{data.template_name || '未知模板'}</div>
          </div>
        </div>

        {/* DAG 可视化 */}
        {dagData && (
          <DAGViewer
            dag={dagData}
            stepsStatus={Object.fromEntries(data.steps.map((s) => [s.step_id, s.status]))}
            stepsProgress={Object.fromEntries(data.steps.map((s) => [s.step_id, s.progress || 0]))}
          />
        )}

        {/* 步骤列表 */}
        <div>
          <h2 className="text-xl font-bold mb-4">步骤列表</h2>
          <div className="grid gap-4">
            {data.steps.map((step) => <StepCard key={step.id} step={step} />)}
          </div>
        </div>
      </div>
    </ErrorBoundary>
  )
}
