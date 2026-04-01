import React from 'react'
import { useWorkflowInstances } from '../../hooks/useWorkflow'

export default function Instances() {
  const { data, loading, error } = useWorkflowInstances()

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">工作流实例</h1>
        <p className="text-gray-500">查看运行中、已完成和异常终止的实例</p>
      </div>
      {loading && <div>加载中...</div>}
      {error && <div className="text-red-500">加载失败: {error.message}</div>}
      <div className="grid gap-4">
        {data?.data.map((item) => (
          <div key={item.id} className="rounded-lg border bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold">{item.template_name}</div>
                <div className="text-sm text-gray-500">实例ID: {item.id}</div>
              </div>
              <div className="text-sm">{item.progress}%</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
