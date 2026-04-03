/**
 * 工作流模板 API
 */

import { apiGet, apiPost, apiPut, apiDelete } from './client';
import {
  WorkflowTemplate,
  WorkflowTemplateListItem,
  CreateTemplateRequest,
  UpdateTemplateRequest,
  TemplateListParams,
  PaginatedResponse,
  TemplateVersion,
  SuccessResponse,
} from '../types/workflow';

const BASE = '/v1/workflow-templates';

/**
 * 工作流模板 API
 */
export const templatesApi = {
  /**
   * 获取模板列表
   */
  list: (params?: TemplateListParams) => {
    const query = new URLSearchParams(params as any).toString();
    return apiGet<PaginatedResponse<WorkflowTemplateListItem>>(
      `${BASE}${query ? `?${query}` : ''}`,
    );
  },

  /**
   * 获取模板详情
   */
  get: (templateId: string) => apiGet<WorkflowTemplate>(`${BASE}/${templateId}`),

  /**
   * 创建模板
   */
  create: (data: CreateTemplateRequest) => apiPost<WorkflowTemplate>(BASE, data),

  /**
   * 更新模板
   */
  update: (templateId: string, data: UpdateTemplateRequest) =>
    apiPut<WorkflowTemplate>(`${BASE}/${templateId}`, data),

  /**
   * 删除模板
   */
  delete: (templateId: string) => apiDelete(`${BASE}/${templateId}`),

  /**
   * 发布模板
   */
  publish: (templateId: string) => apiPost<WorkflowTemplate>(`${BASE}/${templateId}/publish`, {}),

  /**
   * 归档模板
   */
  archive: (templateId: string) => apiPost<WorkflowTemplate>(`${BASE}/${templateId}/archive`, {}),

  /**
   * 复制模板
   */
  duplicate: (templateId: string, data: { name: string; description?: string }) =>
    apiPost<WorkflowTemplate>(`${BASE}/${templateId}/duplicate`, data),

  /**
   * 导入模板
   */
  import: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return fetch(`${BASE}/import`, {
      method: 'POST',
      body: formData,
    }).then(res => {
      if (!res.ok) throw new Error(`Import failed: ${res.statusText}`);
      return res.json();
    });
  },

  /**
   * 导出模板
   */
  export: (templateId: string, format: 'json' | 'yaml' = 'json') =>
    `${BASE}/${templateId}/export?format=${format}`,

  /**
   * 获取模板版本历史
   */
  getVersions: (templateId: string) =>
    apiGet<{ data: TemplateVersion[]; total: number }>(`${BASE}/${templateId}/versions`),

  /**
   * 回滚到指定版本
   */
  rollback: (templateId: string, version: string) =>
    apiPost<WorkflowTemplate>(`${BASE}/${templateId}/rollback`, { version }),
};
