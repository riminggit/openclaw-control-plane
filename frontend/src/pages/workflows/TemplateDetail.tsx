import React from 'react'
import { DAGViewer } from '../../components/workflow/DAGViewer'
import { useTemplate } from '../../hooks/useWorkflow'

export default function TemplateDetail() {
  const { data, loading, error } = useTemplate(null)

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">模板详情</h1>
        <p className="text-gray-500">模板结构、配置与 DAG 预览</p>
      </div>
      {loading && <div>加载中...</div>}
      {error && <div className="text-red-500">加载失败: {error.message}</div>}
      {data ? <DAGViewer dag={data.dag} /> : <div className="rounded border border-dashed p-8 text-gray-400">等待接入路由参数加载模板详情</div>}
    </div>
  )
}
