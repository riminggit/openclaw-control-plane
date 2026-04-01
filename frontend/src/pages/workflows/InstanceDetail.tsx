import React from 'react'
import { DAGViewer } from '../../components/workflow/DAGViewer'
import { StepCard } from '../../components/workflow/StepCard'
import { useWorkflowInstance } from '../../hooks/useWorkflow'

export default function InstanceDetail() {
  const { data, loading, error } = useWorkflowInstance(null)

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">实例详情</h1>
        <p className="text-gray-500">工作流执行状态、步骤明细与 DAG 进展</p>
      </div>
      {loading && <div>加载中...</div>}
      {error && <div className="text-red-500">加载失败: {error.message}</div>}
      {data ? (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-lg border bg-white p-4">状态: {data.status}</div>
            <div className="rounded-lg border bg-white p-4">进度: {data.progress}%</div>
            <div className="rounded-lg border bg-white p-4">模板: {data.template_name}</div>
          </div>
          <DAGViewer
            dag={{
              steps: data.steps.map((s) => ({ id: s.step_id, name: s.name, agent: s.agent_name || '-', depends_on: [] })),
              edges: []
            }}
            stepsStatus={Object.fromEntries(data.steps.map((s) => [s.step_id, s.status]))}
            stepsProgress={Object.fromEntries(data.steps.map((s) => [s.step_id, s.progress || 0]))}
          />
          <div className="grid gap-4">
            {data.steps.map((step) => <StepCard key={step.id} step={step} />)}
          </div>
        </>
      ) : (
        <div className="rounded border border-dashed p-8 text-gray-400">等待接入路由参数加载实例详情</div>
      )}
    </div>
  )
}
