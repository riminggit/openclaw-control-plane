/**
 * 工作流实例 API
 */

import { apiGet, apiPost, apiDelete } from './client';
import {
  WorkflowInstance,
  WorkflowInstanceListItem,
  StartWorkflowRequest,
  TerminateWorkflowRequest,
  WorkflowListParams,
  PaginatedResponse,
  LogEntry,
  LogQueryParams,
  TimelineEvent,
  SuccessResponse,
} from '../types/workflow';

const BASE = '/v1/workflow-instances';

/**
 * 工作流实例 API
 */
export const instancesApi = {
  /**
   * 获取实例列表
   */
  list: (params?: WorkflowListParams) => {
    const query = new URLSearchParams(params as any).toString();
    return apiGet<PaginatedResponse<WorkflowInstanceListItem>>(
      `${BASE}${query ? `?${query}` : ''}`,
    );
  },

  /**
   * 获取实例详情
   */
  get: (workflowId: string) => apiGet<WorkflowInstance>(`${BASE}/${workflowId}`),

  /**
   * 启动新工作流
   */
  start: (data: StartWorkflowRequest) => apiPost<WorkflowInstance>(BASE, data),

  /**
   * 暂停工作流
   */
  pause: (workflowId: string) => apiPost<WorkflowInstance>(`${BASE}/${workflowId}/pause`, {}),

  /**
   * 恢复工作流
   */
  resume: (workflowId: string) => apiPost<WorkflowInstance>(`${BASE}/${workflowId}/resume`, {}),

  /**
   * 终止工作流
   */
  terminate: (workflowId: string, data: TerminateWorkflowRequest) =>
    apiPost<WorkflowInstance>(`${BASE}/${workflowId}/terminate`, data),

  /**
   * 删除工作流实例
   */
  delete: (workflowId: string) => apiDelete(`${BASE}/${workflowId}`),

  /**
   * 获取工作流日志
   */
  getLogs: (workflowId: string, params?: LogQueryParams) => {
    const query = new URLSearchParams(params as any).toString();
    return apiGet<{ data: LogEntry[]; total: number }>(
      `${BASE}/${workflowId}/logs${query ? `?${query}` : ''}`,
    );
  },

  /**
   * 导出工作流报告
   */
  exportReport: (workflowId: string, format: 'pdf' | 'json' | 'html' = 'pdf') =>
    `${BASE}/${workflowId}/export?format=${format}`,

  /**
   * 获取工作流事件时间线
   */
  getTimeline: (workflowId: string, eventTypes?: string) => {
    const query = eventTypes ? `?event_types=${eventTypes}` : '';
    return apiGet<{ data: TimelineEvent[]; total: number }>(
      `${BASE}/${workflowId}/timeline${query}`,
    );
  },
};
