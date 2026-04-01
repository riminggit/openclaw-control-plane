import React from 'react'
import { usePendingReviews } from '../../hooks/useWorkflow'

export default function Reviews() {
  const { data, loading, error } = usePendingReviews()

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">审核中心</h1>
        <p className="text-gray-500">处理待审核步骤与查看审核队列</p>
      </div>
      {loading && <div>加载中...</div>}
      {error && <div className="text-red-500">加载失败: {error.message}</div>}
      <div className="grid gap-4">
        {data.map((item) => (
          <div key={item.id} className="rounded-lg border bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold">{item.step_name}</div>
                <div className="text-sm text-gray-500">{item.workflow_name}</div>
              </div>
              <div className="text-sm text-orange-600">剩余 {Math.floor(item.remaining_time / 3600)}h</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
