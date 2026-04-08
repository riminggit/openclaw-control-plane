import { describe, it, expect, vi, beforeEach } from 'vitest'
import { instancesApi } from '@/api/instances'

global.fetch = vi.fn()

describe('instancesApi', () => {
  beforeEach(() => vi.clearAllMocks())

  it('前置条件：接口可用；操作步骤：调用 list；预期结果：返回实例分页列表', async () => {
    const mockResponse = { data: [{ id: 'i1', status: 'running' }], total: 1, page: 1, page_size: 20, total_pages: 1 }
    ;(global.fetch as any).mockResolvedValueOnce({ ok: true, json: async () => mockResponse })

    const result = await instancesApi.list()

    expect(fetch).toHaveBeenCalledWith('/api/v1/workflows')
    expect(result.total).toBe(1)
  })

  it('前置条件：实例存在；操作步骤：调用 get(id)；预期结果：返回实例详情', async () => {
    const mockResponse = { id: 'i1', status: 'pending' }
    ;(global.fetch as any).mockResolvedValueOnce({ ok: true, json: async () => mockResponse })

    const result = await instancesApi.get('i1')

    expect(fetch).toHaveBeenCalledWith('/api/v1/workflows/i1')
    expect(result.id).toBe('i1')
  })

  it('前置条件：启动参数合法；操作步骤：调用 start(data)；预期结果：返回新实例', async () => {
    const mockResponse = { id: 'i2', status: 'pending' }
    ;(global.fetch as any).mockResolvedValueOnce({ ok: true, json: async () => mockResponse })

    const result = await instancesApi.start({ template_id: 't1', input: {} } as any)

    expect(fetch).toHaveBeenCalledWith('/api/v1/workflows', expect.objectContaining({ method: 'POST' }))
    expect(result.id).toBe('i2')
  })

  it('前置条件：实例运行中；操作步骤：调用 pause(id)；预期结果：返回暂停后的实例', async () => {
    const mockResponse = { id: 'i1', status: 'paused' }
    ;(global.fetch as any).mockResolvedValueOnce({ ok: true, json: async () => mockResponse })

    const result = await instancesApi.pause('i1')

    expect(fetch).toHaveBeenCalledWith('/api/v1/workflows/i1/pause', expect.objectContaining({ method: 'POST' }))
    expect(result.status).toBe('paused')
  })

  it('前置条件：实例已暂停；操作步骤：调用 resume(id)；预期结果：返回恢复后的实例', async () => {
    const mockResponse = { id: 'i1', status: 'running' }
    ;(global.fetch as any).mockResolvedValueOnce({ ok: true, json: async () => mockResponse })

    const result = await instancesApi.resume('i1')

    expect(fetch).toHaveBeenCalledWith('/api/v1/workflows/i1/resume', expect.objectContaining({ method: 'POST' }))
    expect(result.status).toBe('running')
  })

  it('前置条件：实例存在；操作步骤：调用 terminate(id,reason)；预期结果：返回已终止实例', async () => {
    const mockResponse = { id: 'i1', status: 'terminated' }
    ;(global.fetch as any).mockResolvedValueOnce({ ok: true, json: async () => mockResponse })

    const result = await instancesApi.terminate('i1', { reason: 'manual stop' } as any)

    expect(fetch).toHaveBeenCalledWith('/api/v1/workflows/i1/terminate', expect.objectContaining({ method: 'POST' }))
    expect(result.status).toBe('terminated')
  })

  it('前置条件：实例存在；操作步骤：调用 getLogs(id)；预期结果：返回日志列表', async () => {
    const mockResponse = { data: [{ id: 'l1', level: 'INFO', message: 'ok' }], total: 1 }
    ;(global.fetch as any).mockResolvedValueOnce({ ok: true, json: async () => mockResponse })

    const result = await instancesApi.getLogs('i1')

    expect(fetch).toHaveBeenCalledWith('/api/v1/workflows/i1/logs')
    expect(result.total).toBe(1)
  })

  it('前置条件：后端错误；操作步骤：调用 list；预期结果：抛出 Error', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({ ok: false, status: 500, text: async () => 'server error', statusText: 'Internal Server Error' })
    await expect(instancesApi.list()).rejects.toThrow('API 500')
  })
})
