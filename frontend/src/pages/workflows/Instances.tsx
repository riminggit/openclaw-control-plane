import React from 'react'
import { Link } from 'react-router-dom'
import { useWorkflowInstances } from '../../hooks/useWorkflow'
import { WorkflowStatus } from '../../types/workflow'

const statusLabel: Record<string, string> = {
  [WorkflowStatus.PENDING]: '等待中',
  [WorkflowStatus.RUNNING]: '运行中',
  [WorkflowStatus.PAUSED]: '已暂停',
  [WorkflowStatus.COMPLETED]: '已完成',
  [WorkflowStatus.FAILED]: '失败',
  [WorkflowStatus.TERMINATED]: '已终止',
}

function statusClass(status: string): string {
  switch (status) {
    case WorkflowStatus.RUNNING:
      return 'bg-blue-900/50 text-blue-200 border-blue-700'
    case WorkflowStatus.COMPLETED:
      return 'bg-emerald-900/50 text-emerald-200 border-emerald-700'
    case WorkflowStatus.FAILED:
    case WorkflowStatus.TERMINATED:
      return 'bg-red-900/50 text-red-200 border-red-700'
    case WorkflowStatus.PAUSED:
      return 'bg-amber-900/50 text-amber-200 border-amber-700'
    default:
      return 'bg-gray-700/80 text-gray-200 border-gray-600'
  }
}

export default function Instances() {
  const { data, loading, error } = useWorkflowInstances()

  return (
    <div className='p-6 space-y-4'>
      <div>
        <h1 className='text-2xl font-bold'>工作流实例</h1>
        <p className='text-gray-500'>查看运行中、已完成和异常终止的实例</p>
      </div>

      {loading && (
        <div className='rounded-lg border border-gray-700 bg-gray-800/50 p-8 text-center text-gray-400'>
          加载中…
        </div>
      )}

      {error && (
        <div className='rounded-lg border border-red-800 bg-red-950/40 p-4 text-red-300'>
          加载失败: {error.message}
        </div>
      )}

      {!loading && !error && data?.data.length === 0 && (
        <div className='rounded-lg border border-dashed border-gray-600 bg-gray-800/30 p-10 text-center'>
          <p className='text-gray-300 font-medium'>暂无工作流实例</p>
          <p className='mt-2 text-sm text-gray-500'>
            在模板页启动工作流后，实例将显示在这里。
          </p>
          <Link
            to='/workflows'
            className='mt-4 inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500'
          >
            前往模板
          </Link>
        </div>
      )}

      <div className='grid gap-4'>
        {data?.data.map(item => (
          <Link
            key={item.id}
            to={`/workflows/instance/${item.id}`}
            className='block rounded-lg border border-gray-700 bg-gray-800 p-4 shadow-sm transition hover:border-gray-500 hover:bg-gray-700/50'
          >
            <div className='flex flex-wrap items-center justify-between gap-3'>
              <div className='min-w-0'>
                <div className='font-semibold text-white truncate'>{item.template_name}</div>
                <div className='text-sm text-gray-500'>实例 ID: {item.id}</div>
              </div>
              <div className='flex flex-wrap items-center gap-2'>
                <span
                  className={`rounded border px-2 py-0.5 text-xs font-medium ${statusClass(item.status)}`}
                >
                  {statusLabel[item.status] ?? item.status}
                </span>
                <span className='text-sm text-gray-400 tabular-nums'>{item.progress}%</span>
                <span className='text-xs text-blue-400'>查看详情 →</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
