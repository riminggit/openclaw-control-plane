import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { useTemplates, useWorkflowActions } from '@/hooks/useWorkflow'

vi.mock('@/api/templates', () => ({
  templatesApi: {
    list: vi.fn(),
  },
}))

vi.mock('@/api/instances', () => ({
  instancesApi: {
    start: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    terminate: vi.fn(),
  },
}))

import { templatesApi } from '@/api/templates'
import { instancesApi } from '@/api/instances'

function TemplatesProbe() {
  const { data, loading, error } = useTemplates()
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="error">{error ? error.message : ''}</span>
      <span data-testid="total">{data ? data.total : -1}</span>
    </div>
  )
}

function ActionsProbe() {
  const { loading, startWorkflow, pauseWorkflow, resumeWorkflow, terminateWorkflow } = useWorkflowActions()
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <button onClick={() => startWorkflow('t1', {})}>start</button>
      <button onClick={() => pauseWorkflow('i1')}>pause</button>
      <button onClick={() => resumeWorkflow('i1')}>resume</button>
      <button onClick={() => terminateWorkflow('i1', 'reason')}>terminate</button>
    </div>
  )
}

describe('useWorkflow hooks', () => {
  beforeEach(() => vi.clearAllMocks())

  it('前置条件：模板接口成功；操作步骤：渲染 useTemplates；预期结果：加载完成后返回数据', async () => {
    ;(templatesApi.list as any).mockResolvedValueOnce({ data: [], total: 0, page: 1, page_size: 20, total_pages: 0 })

    render(<TemplatesProbe />)

    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'))
    expect(screen.getByTestId('total').textContent).toBe('0')
    expect(templatesApi.list).toHaveBeenCalledTimes(1)
  })

  it('前置条件：模板接口失败；操作步骤：渲染 useTemplates；预期结果：error 被设置', async () => {
    ;(templatesApi.list as any).mockRejectedValueOnce(new Error('network failed'))

    render(<TemplatesProbe />)

    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'))
    expect(screen.getByTestId('error').textContent).toContain('network failed')
  })

  it('前置条件：工作流动作接口可用；操作步骤：调用 start/pause/resume/terminate；预期结果：对应 API 被调用', async () => {
    ;(instancesApi.start as any).mockResolvedValue({ id: 'i1' })
    ;(instancesApi.pause as any).mockResolvedValue({ id: 'i1', status: 'paused' })
    ;(instancesApi.resume as any).mockResolvedValue({ id: 'i1', status: 'running' })
    ;(instancesApi.terminate as any).mockResolvedValue({ id: 'i1', status: 'terminated' })

    render(<ActionsProbe />)

    screen.getByText('start').click()
    screen.getByText('pause').click()
    screen.getByText('resume').click()
    screen.getByText('terminate').click()

    await waitFor(() => {
      expect(instancesApi.start).toHaveBeenCalledWith({ template_id: 't1', input: {} })
      expect(instancesApi.pause).toHaveBeenCalledWith('i1')
      expect(instancesApi.resume).toHaveBeenCalledWith('i1')
      expect(instancesApi.terminate).toHaveBeenCalledWith('i1', { reason: 'reason' })
    })
  })
})
