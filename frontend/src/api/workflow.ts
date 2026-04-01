/**
 * 工作流通用 API
 */

import { apiGet, apiPost } from './client'
import {
  HealthCheck,
  WorkflowStats,
  AgentStatsSummary,
  TaskStats,
  ReviewStatsSummary,
  StatsQueryParams
} from '../types/workflow'

const BASE = '/v1'

/**
 * 统计与监控 API
 */
export const workflowApi = {
  /**
   * 获取系统健康检查
   */
  getHealth: () => apiGet<HealthCheck>(`${BASE}/health`),

  /**
   * 获取工作流统计
   */
  getWorkflowStats: (params?: StatsQueryParams) => {
    const query = new URLSearchParams(params as any).toString()
    return apiGet<WorkflowStats>(`${BASE}/stats/workflows${query ? `?${query}` : ''}`)
  },

  /**
   * 获取 Agent 统计
   */
  getAgentStats: (params?: StatsQueryParams) => {
    const query = new URLSearchParams(params as any).toString()
    return apiGet<AgentStatsSummary>(`${BASE}/stats/agents${query ? `?${query}` : ''}`)
  },

  /**
   * 获取任务统计
   */
  getTaskStats: (params?: StatsQueryParams) => {
    const query = new URLSearchParams(params as any).toString()
    return apiGet<TaskStats>(`${BASE}/stats/tasks${query ? `?${query}` : ''}`)
  },

  /**
   * 获取审核统计
   */
  getReviewStats: (params?: StatsQueryParams) => {
    const query = new URLSearchParams(params as any).toString()
    return apiGet<ReviewStatsSummary>(`${BASE}/stats/reviews${query ? `?${query}` : ''}`)
  }
}
