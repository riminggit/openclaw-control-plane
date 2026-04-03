import React from 'react'
import { Link } from 'react-router-dom'
import { useTemplates } from '../../hooks/useWorkflow'

export default function Templates() {
  const { data, loading, error } = useTemplates()

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-white">工作流模板</h1>
        <p className="text-gray-500">查看、创建与管理工作流模板</p>
      </div>

      {loading && (
        <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-8 text-center text-gray-400">
          加载中…
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-800 bg-red-950/40 p-4 text-red-300">
          加载失败: {error.message}
        </div>
      )}

      {!loading && !error && data?.data.length === 0 && (
        <div className="rounded-lg border border-dashed border-gray-600 bg-gray-800/30 p-10 text-center">
          <p className="text-gray-300 font-medium">暂无模板</p>
          <p className="mt-2 text-sm text-gray-500">创建或发布模板后将显示在这里。</p>
        </div>
      )}

      <div className="grid gap-4">
        {data?.data.map((item) => (
          <Link
            key={item.id}
            to={`/workflows/template/${item.id}`}
            className="block rounded-lg border border-gray-700 bg-gray-800 p-4 shadow-sm transition hover:border-gray-500 hover:bg-gray-700/50"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold text-white truncate">{item.name}</div>
                {item.description && (
                  <div className="text-sm text-gray-500 truncate">{item.description}</div>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="rounded border border-gray-600 px-2 py-0.5 text-xs text-gray-300">
                  {item.status}
                </span>
                <span className="text-xs text-blue-400">查看 →</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
