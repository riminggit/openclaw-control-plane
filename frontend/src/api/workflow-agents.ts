/**
 * Agent 管理 API (工作流相关)
 */

import { apiGet, apiPost } from './client'
import {
  AgentListItem,
  AgentDetail,
  AgentListParams,
  BatchCleanupRequest,
  AgentLoadStatsResponse,
  SuccessResponse
} from '../types/workflow'

const BASE = '/v1/agents'

/**
 * Agent 管理 API
 */
export const workflowAgentsApi = {
  /**
   * 获取 Agent 列表
   */
  list: (params?: AgentListParams) => {
    const query = new URLSearchParams(params as any).toString()
    return apiGet<{ data: AgentListItem[]; total: number }>(`${BASE}${query ? `?${query}` : ''}`)
  },

  /**
   * 获取 Agent 详情
   */
  get: (agentId: string) => 
    apiGet<AgentDetail>(`${BASE}/${agentId}`),

  /**
   * 同步 Agent 状态
   */
  sync: (agentId: string) => 
    apiPost<{ success: boolean; agent: AgentListItem }>(`${BASE}/${agentId}/sync`, {}),

  /**
   * 清理 Agent 数据
   */
  cleanup: (agentId: string) => 
    apiPost<SuccessResponse>(`${BASE}/${agentId}/cleanup`, {}),

  /**
   * 停止 Agent
   */
  stop: (agentId: string) => 
    apiPost<{ success: boolean; agent: AgentListItem }>(`${BASE}/${agentId}/stop`, {}),

  /**
   * 重启 Agent
   */
  restart: (agentId: string) => 
    apiPost<{ success: boolean; agent: AgentListItem }>(`${BASE}/${agentId}/restart`, {}),

  /**
   * 批量同步 Agent
   */
  batchSync: () => 
    apiPost<{ success: boolean; synced_count: number; failed_count: number }>(`${BASE}/batch-sync`, {}),

  /**
   * 批量清理 Agent
   */
  batchCleanup: (data: BatchCleanupRequest) => 
    apiPost<{ success: boolean; cleaned_count: number }>(`${BASE}/batch-cleanup`, data),

  /**
   * 获取 Agent 负载统计
   */
  getLoadStats: () => 
    apiGet<AgentLoadStatsResponse>(`${BASE}/load-stats`)
}
