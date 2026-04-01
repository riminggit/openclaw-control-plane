/**
 * 步骤执行 API
 */

import { apiGet, apiPost } from './client'
import {
  StepExecution,
  StepExecutionDetail,
  SkipStepRequest,
  ForceCompleteStepRequest,
  ReassignAgentRequest,
  ReportProgressRequest,
  PaginatedResponse,
  StepOutput,
  StepInput,
  LogEntry,
  SuccessResponse
} from '../types/workflow'

const BASE = '/v1/workflows'

/**
 * 步骤执行 API
 */
export const stepsApi = {
  /**
   * 获取工作流的所有步骤
   */
  list: (workflowId: string, status?: string) => {
    const query = status ? `?status=${status}` : ''
    return apiGet<PaginatedResponse<StepExecution>>(`${BASE}/${workflowId}/steps${query}`)
  },

  /**
   * 获取步骤详情
   */
  get: (workflowId: string, stepExecutionId: string) => 
    apiGet<StepExecutionDetail>(`${BASE}/${workflowId}/steps/${stepExecutionId}`),

  /**
   * 重试步骤
   */
  retry: (workflowId: string, stepExecutionId: string) => 
    apiPost<StepExecutionDetail>(`${BASE}/${workflowId}/steps/${stepExecutionId}/retry`, {}),

  /**
   * 跳过步骤
   */
  skip: (workflowId: string, stepExecutionId: string, data: SkipStepRequest) => 
    apiPost<StepExecutionDetail>(`${BASE}/${workflowId}/steps/${stepExecutionId}/skip`, data),

  /**
   * 强制完成步骤
   */
  forceComplete: (workflowId: string, stepExecutionId: string, data: ForceCompleteStepRequest) => 
    apiPost<StepExecutionDetail>(`${BASE}/${workflowId}/steps/${stepExecutionId}/force-complete`, data),

  /**
   * 重新分配 Agent
   */
  reassign: (workflowId: string, stepExecutionId: string, data: ReassignAgentRequest) => 
    apiPost<StepExecutionDetail>(`${BASE}/${workflowId}/steps/${stepExecutionId}/reassign`, data),

  /**
   * Agent 上报进度
   */
  reportProgress: (workflowId: string, stepExecutionId: string, data: ReportProgressRequest) => 
    apiPost<SuccessResponse>(`${BASE}/${workflowId}/steps/${stepExecutionId}/progress`, data),

  /**
   * 获取步骤日志
   */
  getLogs: (workflowId: string, stepExecutionId: string, params?: { level?: string; limit?: number }) => {
    const query = new URLSearchParams(params as any).toString()
    return apiGet<{ data: LogEntry[]; total: number }>(`${BASE}/${workflowId}/steps/${stepExecutionId}/logs${query ? `?${query}` : ''}`)
  },

  /**
   * 获取步骤输出
   */
  getOutput: (workflowId: string, stepExecutionId: string) => 
    apiGet<StepOutput>(`${BASE}/${workflowId}/steps/${stepExecutionId}/output`),

  /**
   * 获取步骤输入
   */
  getInput: (workflowId: string, stepExecutionId: string) => 
    apiGet<StepInput>(`${BASE}/${workflowId}/steps/${stepExecutionId}/input`)
}
