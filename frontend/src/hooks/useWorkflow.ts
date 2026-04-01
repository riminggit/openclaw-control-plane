/**
 * 工作流相关 Hooks
 */

import { useState, useEffect, useCallback } from 'react'
import { templatesApi } from '../api/templates'
import { instancesApi } from '../api/instances'
import { stepsApi } from '../api/steps'
import { reviewsApi } from '../api/reviews'
import {
  WorkflowTemplate,
  WorkflowTemplateListItem,
  WorkflowInstance,
  WorkflowInstanceListItem,
  StepExecution,
  ReviewListItem,
  TemplateListParams,
  WorkflowListParams,
  PaginatedResponse
} from '../types/workflow'

/**
 * 模板列表 Hook
 */
export function useTemplates(params?: TemplateListParams) {
  const [data, setData] = useState<PaginatedResponse<WorkflowTemplateListItem> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await templatesApi.list(params)
      setData(result)
    } catch (err) {
      setError(err as Error)
    } finally {
      setLoading(false)
    }
  }, [params])

  useEffect(() => {
    fetch()
  }, [fetch])

  return { data, loading, error, refetch: fetch }
}

/**
 * 模板详情 Hook
 */
export function useTemplate(templateId: string | null) {
  const [data, setData] = useState<WorkflowTemplate | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!templateId) {
      setData(null)
      return
    }

    setLoading(true)
    setError(null)
    templatesApi.get(templateId)
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false))
  }, [templateId])

  return { data, loading, error }
}

/**
 * 工作流实例列表 Hook
 */
export function useWorkflowInstances(params?: WorkflowListParams) {
  const [data, setData] = useState<PaginatedResponse<WorkflowInstanceListItem> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await instancesApi.list(params)
      setData(result)
    } catch (err) {
      setError(err as Error)
    } finally {
      setLoading(false)
    }
  }, [params])

  useEffect(() => {
    fetch()
  }, [fetch])

  return { data, loading, error, refetch: fetch }
}

/**
 * 工作流实例详情 Hook
 */
export function useWorkflowInstance(workflowId: string | null) {
  const [data, setData] = useState<WorkflowInstance | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!workflowId) {
      setData(null)
      return
    }

    setLoading(true)
    setError(null)
    instancesApi.get(workflowId)
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false))
  }, [workflowId])

  return { data, loading, error }
}

/**
 * 工作流步骤列表 Hook
 */
export function useWorkflowSteps(workflowId: string | null) {
  const [data, setData] = useState<StepExecution[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!workflowId) {
      setData([])
      return
    }

    setLoading(true)
    setError(null)
    stepsApi.list(workflowId)
      .then(result => setData(result.data))
      .catch(setError)
      .finally(() => setLoading(false))
  }, [workflowId])

  return { data, loading, error }
}

/**
 * 待审核列表 Hook
 */
export function usePendingReviews() {
  const [data, setData] = useState<ReviewListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await reviewsApi.getPending()
      setData(result.data)
    } catch (err) {
      setError(err as Error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetch()
  }, [fetch])

  return { data, loading, error, refetch: fetch }
}

/**
 * 工作流操作 Hook
 */
export function useWorkflowActions() {
  const [loading, setLoading] = useState(false)

  const startWorkflow = async (templateId: string, input: Record<string, any>) => {
    setLoading(true)
    try {
      const result = await instancesApi.start({ template_id: templateId, input })
      return result
    } finally {
      setLoading(false)
    }
  }

  const pauseWorkflow = async (workflowId: string) => {
    setLoading(true)
    try {
      const result = await instancesApi.pause(workflowId)
      return result
    } finally {
      setLoading(false)
    }
  }

  const resumeWorkflow = async (workflowId: string) => {
    setLoading(true)
    try {
      const result = await instancesApi.resume(workflowId)
      return result
    } finally {
      setLoading(false)
    }
  }

  const terminateWorkflow = async (workflowId: string, reason: string) => {
    setLoading(true)
    try {
      const result = await instancesApi.terminate(workflowId, { reason })
      return result
    } finally {
      setLoading(false)
    }
  }

  return {
    loading,
    startWorkflow,
    pauseWorkflow,
    resumeWorkflow,
    terminateWorkflow
  }
}
