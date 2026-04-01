/**
 * 步骤卡片组件
 */

import React from 'react'
import { StepExecution, StepStatus } from '../../types/workflow'
import { ProgressRing } from './ProgressRing'

export interface StepCardProps {
  step: StepExecution
  onClick?: () => void
  className?: string
}

const statusColors: Record<StepStatus, string> = {
  [StepStatus.PENDING]: 'bg-gray-100 text-gray-600',
  [StepStatus.READY]: 'bg-blue-100 text-blue-600',
  [StepStatus.ASSIGNED]: 'bg-blue-100 text-blue-600',
  [StepStatus.RUNNING]: 'bg-yellow-100 text-yellow-700',
  [StepStatus.AWAITING_REVIEW]: 'bg-purple-100 text-purple-700',
  [StepStatus.APPROVED]: 'bg-green-100 text-green-700',
  [StepStatus.REJECTED]: 'bg-red-100 text-red-700',
  [StepStatus.RETRYING]: 'bg-orange-100 text-orange-700',
  [StepStatus.COMPLETED]: 'bg-green-100 text-green-700',
  [StepStatus.FAILED]: 'bg-red-100 text-red-700',
  [StepStatus.CANCELLED]: 'bg-gray-100 text-gray-600',
  [StepStatus.SKIPPED]: 'bg-gray-100 text-gray-600'
}

const statusLabels: Record<StepStatus, string> = {
  [StepStatus.PENDING]: '待执行',
  [StepStatus.READY]: '就绪',
  [StepStatus.ASSIGNED]: '已分配',
  [StepStatus.RUNNING]: '执行中',
  [StepStatus.AWAITING_REVIEW]: '等待审核',
  [StepStatus.APPROVED]: '已通过',
  [StepStatus.REJECTED]: '已拒绝',
  [StepStatus.RETRYING]: '重试中',
  [StepStatus.COMPLETED]: '已完成',
  [StepStatus.FAILED]: '失败',
  [StepStatus.CANCELLED]: '已取消',
  [StepStatus.SKIPPED]: '已跳过'
}

export const StepCard: React.FC<StepCardProps> = ({
  step,
  onClick,
  className = ''
}) => {
  const progressColor = step.status === StepStatus.FAILED ? '#ef4444' :
                       step.status === StepStatus.COMPLETED ? '#10b981' :
                       '#3b82f6'

  return (
    <div
      className={`step-card border rounded-lg p-4 bg-white shadow-sm hover:shadow-md transition-shadow cursor-pointer ${className}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-semibold text-lg">{step.name}</h3>
            <span className={`px-2 py-1 text-xs rounded-full ${statusColors[step.status]}`}>
              {statusLabels[step.status]}
            </span>
            {step.human_review && (
              <span className="px-2 py-1 text-xs rounded-full bg-purple-100 text-purple-700">
                需审核
              </span>
            )}
          </div>

          {step.agent_name && (
            <p className="text-sm text-gray-600 mb-2">
              执行者: {step.agent_name}
            </p>
          )}

          {step.progress_message && (
            <p className="text-sm text-gray-600 mb-2">
              {step.progress_message}
            </p>
          )}

          {step.error_message && (
            <p className="text-sm text-red-600 mt-2">
              错误: {step.error_message}
            </p>
          )}

          <div className="flex items-center gap-4 text-xs text-gray-500 mt-2">
            {step.started_at && (
              <span>开始: {new Date(step.started_at).toLocaleString()}</span>
            )}
            {step.completed_at && (
              <span>完成: {new Date(step.completed_at).toLocaleString()}</span>
            )}
            {step.duration && (
              <span>耗时: {Math.round(step.duration / 60)}分钟</span>
            )}
            {step.retry_count > 0 && (
              <span>重试: {step.retry_count}次</span>
            )}
          </div>
        </div>

        {step.progress !== undefined && step.progress > 0 && (
          <ProgressRing
            progress={step.progress}
            size={60}
            strokeWidth={4}
            color={progressColor}
            showText={true}
          />
        )}
      </div>
    </div>
  )
}
