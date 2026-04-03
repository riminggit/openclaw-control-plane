import React from 'react'
import { usePendingReviews } from '../../hooks/useWorkflow'

export default function Reviews() {
  const { data, loading, error } = usePendingReviews()

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-white">审核中心</h1>
        <p className="text-gray-500">处理待审核步骤与查看审核队列</p>
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

      {!loading && !error && data.length === 0 && (
        <div className="rounded-lg border border-dashed border-gray-600 bg-gray-800/30 p-10 text-center">
          <p className="text-gray-300 font-medium">暂无待审核项</p>
          <p className="mt-2 text-sm text-gray-500">有新的审核任务时会出现在这里。</p>
        </div>
      )}

      <div className="grid gap-4">
        {data.map((item) => {
          const hours =
            item.remaining_time != null && item.remaining_time > 0
              ? Math.floor(item.remaining_time / 3600)
              : null
          return (
            <div
              key={item.id}
              className="rounded-lg border border-gray-700 bg-gray-800 p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-white">{item.step_name}</div>
                  <div className="text-sm text-gray-500">{item.workflow_name}</div>
                </div>
                {hours != null && (
                  <div className="text-sm text-amber-400/90 tabular-nums">剩余约 {hours} 小时</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
