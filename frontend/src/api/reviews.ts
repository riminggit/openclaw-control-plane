/**
 * 人工审核 API
 */

import { apiGet, apiPost } from './client'
import {
  ReviewListItem,
  ReviewDetail,
  ReviewRequest,
  ReviewListParams,
  ReviewStats,
  PaginatedResponse,
  SuccessResponse
} from '../types/workflow'

const BASE = '/v1/reviews'
const WORKFLOW_BASE = '/v1/workflows'

/**
 * 人工审核 API
 */
export const reviewsApi = {
  /**
   * 获取待审核列表
   */
  getPending: (params?: ReviewListParams) => {
    const query = new URLSearchParams(params as any).toString()
    return apiGet<PaginatedResponse<ReviewListItem>>(`${BASE}/pending${query ? `?${query}` : ''}`)
  },

  /**
   * 获取审核详情
   */
  get: (reviewId: string) => 
    apiGet<ReviewDetail>(`${BASE}/${reviewId}`),

  /**
   * 通过审核
   */
  approve: (reviewId: string, data: ReviewRequest) => 
    apiPost<{
      success: boolean;
      review: ReviewDetail;
      workflow: { id: string; status: string; progress: number };
    }>(`${BASE}/${reviewId}/approve`, data),

  /**
   * 拒绝审核
   */
  reject: (reviewId: string, data: ReviewRequest) => 
    apiPost<{
      success: boolean;
      review: ReviewDetail;
      workflow: { id: string; status: string; progress: number };
    }>(`${BASE}/${reviewId}/reject`, data),

  /**
   * 要求修改
   */
  requestChanges: (reviewId: string, data: ReviewRequest) => 
    apiPost<{
      success: boolean;
      review: ReviewDetail;
      workflow: { id: string; status: string; progress: number };
    }>(`${BASE}/${reviewId}/request-changes`, data),

  /**
   * 获取工作流的审核记录
   */
  getWorkflowReviews: (workflowId: string) => 
    apiGet<PaginatedResponse<{
      id: string;
      step_name: string;
      reviewer_name: string;
      action: string;
      comment: string;
      created_at: string;
      review_round: number;
    }>>(`${WORKFLOW_BASE}/${workflowId}/reviews`),

  /**
   * 获取审核统计
   */
  getStats: (params?: { reviewer_id?: string; start_date?: string; end_date?: string }) => {
    const query = new URLSearchParams(params as any).toString()
    return apiGet<ReviewStats>(`${BASE}/stats${query ? `?${query}` : ''}`)
  }
}
