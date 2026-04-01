import React from 'react'
import { useTemplates } from '../../hooks/useWorkflow'

export default function Templates() {
  const { data, loading, error } = useTemplates()

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">工作流模板</h1>
        <p className="text-gray-500">查看、创建与管理工作流模板</p>
      </div>
      {loading && <div>加载中...</div>}
      {error && <div className="text-red-500">加载失败: {error.message}</div>}
      <div className="grid gap-4">
        {data?.data.map((item) => (
          <div key={item.id} className="rounded-lg border bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold">{item.name}</div>
                <div className="text-sm text-gray-500">{item.description}</div>
              </div>
              <div className="text-sm text-gray-500">{item.status}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
