import React from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { DAGViewer } from '../../components/workflow/DAGViewer'
import { useTemplate } from '../../hooks/useWorkflow'

export default function TemplateDetail() {
  const { id } = useParams<{ id: string }>()
  const { t } = useTranslation()
  const { data, loading, error } = useTemplate(id ?? null)

  if (!id) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-amber-800/60 bg-amber-950/30 p-6 text-amber-100">
          <h2 className="text-lg font-semibold mb-2">缺少模板 ID</h2>
          <p className="text-amber-200/80 mb-4">请从模板列表进入</p>
          <Link
            to="/workflows"
            className="inline-block rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500"
          >
            返回模板列表
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">
            {data?.name ?? t('breadcrumb.workflow_template')}
          </h1>
          <p className="text-gray-500 mt-1">模板结构、配置与 DAG 预览</p>
        </div>
        <Link
          to="/workflows"
          className="text-sm text-blue-400 hover:text-blue-300"
        >
          {t('app.back')}
        </Link>
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

      {!loading && !error && data && (
        <div className="space-y-4">
          {data.description && (
            <p className="text-sm text-gray-400">{data.description}</p>
          )}
          <div className="rounded-lg border border-gray-700 bg-gray-800/40 p-4 overflow-x-auto">
            <DAGViewer dag={data.dag} />
          </div>
        </div>
      )}
    </div>
  )
}
