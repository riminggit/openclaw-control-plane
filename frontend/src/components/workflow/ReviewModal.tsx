/**
 * 审核弹窗组件
 */

import React, { useState } from 'react'
import { ReviewDetail, ReviewAction } from '../../types/workflow'

export interface ReviewModalProps {
  review: ReviewDetail
  isOpen: boolean
  onClose: () => void
  onApprove: (comment: string) => Promise<void>
  onReject: (comment: string) => Promise<void>
  onRequestChanges: (comment: string) => Promise<void>
}

export const ReviewModal: React.FC<ReviewModalProps> = ({
  review,
  isOpen,
  onClose,
  onApprove,
  onReject,
  onRequestChanges
}) => {
  const [comment, setComment] = useState('')
  const [action, setAction] = useState<ReviewAction | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!isOpen) return null

  const handleSubmit = async (selectedAction: ReviewAction) => {
    if (!comment.trim()) {
      alert('请填写审核意见')
      return
    }

    setAction(selectedAction)
    setSubmitting(true)

    try {
      if (selectedAction === ReviewAction.APPROVE) {
        await onApprove(comment)
      } else if (selectedAction === ReviewAction.REJECT) {
        await onReject(comment)
      } else if (selectedAction === ReviewAction.REQUEST_CHANGES) {
        await onRequestChanges(comment)
      }
      onClose()
    } catch (error) {
      console.error('审核失败:', error)
      alert('审核失败，请重试')
    } finally {
      setSubmitting(false)
      setAction(null)
    }
  }

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${hours}小时${minutes}分钟`
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="border-b px-6 py-4">
          <h2 className="text-xl font-semibold">审核 - {review.step_name}</h2>
          <p className="text-sm text-gray-600 mt-1">
            工作流: {review.workflow_name}
          </p>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          {/* 基本信息 */}
          <div className="flex items-center gap-4 text-sm">
            <span className="text-gray-600">审核人: {review.reviewer_name}</span>
            <span className="text-gray-600">
              剩余时间: <span className="text-orange-600 font-semibold">
                {formatTime(review.remaining_time)}
              </span>
            </span>
            <span className="text-gray-600">轮次: {review.review_round}</span>
          </div>

          {/* 输出内容 */}
          <div className="border rounded-lg p-4 bg-gray-50">
            <h3 className="font-semibold mb-2">Agent 输出</h3>
            <p className="text-sm text-gray-700 mb-3">{review.outputs.summary}</p>

            {/* 文件列表 */}
            {review.outputs.files && review.outputs.files.length > 0 && (
              <div>
                <h4 className="font-semibold text-sm mb-2">产出文件</h4>
                <ul className="space-y-1">
                  {review.outputs.files.map((file, idx) => (
                    <li key={idx} className="text-sm">
                      <a
                        href={file.download_url || file.preview_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {file.name} ({(file.size_bytes / 1024).toFixed(2)} KB)
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 依赖步骤 */}
            {review.outputs.dependencies && review.outputs.dependencies.length > 0 && (
              <div className="mt-3">
                <h4 className="font-semibold text-sm mb-2">依赖步骤</h4>
                <ul className="space-y-1 text-sm text-gray-600">
                  {review.outputs.dependencies.map((dep, idx) => (
                    <li key={idx}>
                      {dep.step_name}: {dep.output_summary}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* 历史记录 */}
          {review.history && review.history.length > 0 && (
            <div className="border rounded-lg p-4">
              <h3 className="font-semibold mb-2">审核历史</h3>
              <div className="space-y-2">
                {review.history.map((item, idx) => (
                  <div key={idx} className="text-sm border-l-2 border-gray-300 pl-3">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{item.reviewer_name}</span>
                      <span className="px-2 py-0.5 text-xs rounded bg-gray-100">
                        {item.action}
                      </span>
                      <span className="text-gray-500 text-xs">
                        {new Date(item.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-gray-600 mt-1">{item.comment}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 审核意见 */}
          <div>
            <label className="block font-semibold mb-2">审核意见 *</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="w-full border rounded-lg p-3 min-h-[120px]"
              placeholder="请填写审核意见..."
              disabled={submitting}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-4 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
            disabled={submitting}
          >
            取消
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => handleSubmit(ReviewAction.REQUEST_CHANGES)}
              className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-50"
              disabled={submitting || !comment.trim()}
            >
              {submitting && action === ReviewAction.REQUEST_CHANGES ? '提交中...' : '要求修改'}
            </button>
            <button
              onClick={() => handleSubmit(ReviewAction.REJECT)}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
              disabled={submitting || !comment.trim()}
            >
              {submitting && action === ReviewAction.REJECT ? '提交中...' : '拒绝'}
            </button>
            <button
              onClick={() => handleSubmit(ReviewAction.APPROVE)}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
              disabled={submitting || !comment.trim()}
            >
              {submitting && action === ReviewAction.APPROVE ? '提交中...' : '通过'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
