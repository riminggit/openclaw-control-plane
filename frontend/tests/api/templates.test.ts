import { describe, it, expect, vi, beforeEach } from 'vitest'
import { templatesApi } from '@/api/templates'

global.fetch = vi.fn()

describe('templatesApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('前置条件：接口可用；操作步骤：调用 list；预期结果：返回模板分页列表', async () => {
    const mockResponse = {
      data: [{ id: 't1', name: 'Template 1', status: 'published' }],
      total: 1,
      page: 1,
      page_size: 20,
      total_pages: 1,
    }

    ;(global.fetch as any).mockResolvedValueOnce({ ok: true, json: async () => mockResponse })

    const result = await templatesApi.list()

    expect(fetch).toHaveBeenCalledWith('/api/v1/workflow-templates')
    expect(result.total).toBe(1)
    expect(result.data[0].id).toBe('t1')
  })

  it('前置条件：存在筛选参数；操作步骤：调用 list({status})；预期结果：URL 带查询参数', async () => {
    const mockResponse = { data: [], total: 0, page: 1, page_size: 20, total_pages: 0 }
    ;(global.fetch as any).mockResolvedValueOnce({ ok: true, json: async () => mockResponse })

    await templatesApi.list({ status: 'published' } as any)

    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/v1/workflow-templates?status=published'))
  })

  it('前置条件：模板存在；操作步骤：调用 get(id)；预期结果：返回模板详情', async () => {
    const mockTemplate = { id: 't1', name: 'Demo', dag: { steps: [], edges: [] } }
    ;(global.fetch as any).mockResolvedValueOnce({ ok: true, json: async () => mockTemplate })

    const result = await templatesApi.get('t1')

    expect(fetch).toHaveBeenCalledWith('/api/v1/workflow-templates/t1')
    expect(result.id).toBe('t1')
  })

  it('前置条件：创建数据合法；操作步骤：调用 create(data)；预期结果：返回新建模板', async () => {
    const payload = { name: 'New', description: 'desc', dag: { steps: [{ id: 's1', name: 'Step 1', agent: 'a1', human_review: false }], edges: [] } }
    const mockResponse = { id: 't2', status: 'draft', version: 'v1.0', ...payload }
    ;(global.fetch as any).mockResolvedValueOnce({ ok: true, json: async () => mockResponse })

    const result = await templatesApi.create(payload as any)

    expect(fetch).toHaveBeenCalledWith('/api/v1/workflow-templates', expect.objectContaining({ method: 'POST' }))
    expect(result.id).toBe('t2')
    expect(result.status).toBe('draft')
  })

  it('前置条件：更新数据合法；操作步骤：调用 update(id,data)；预期结果：返回更新后的模板', async () => {
    const mockResponse = { id: 't1', name: 'Updated' }
    ;(global.fetch as any).mockResolvedValueOnce({ ok: true, json: async () => mockResponse })

    const result = await templatesApi.update('t1', { name: 'Updated' } as any)

    expect(fetch).toHaveBeenCalledWith('/api/v1/workflow-templates/t1', expect.objectContaining({ method: 'PUT' }))
    expect(result.name).toBe('Updated')
  })

  it('前置条件：模板存在；操作步骤：调用 publish(id)；预期结果：状态变为 published', async () => {
    const mockResponse = { id: 't1', status: 'published' }
    ;(global.fetch as any).mockResolvedValueOnce({ ok: true, json: async () => mockResponse })

    const result = await templatesApi.publish('t1')

    expect(fetch).toHaveBeenCalledWith('/api/v1/workflow-templates/t1/publish', expect.objectContaining({ method: 'POST' }))
    expect(result.status).toBe('published')
  })

  it('前置条件：模板存在；操作步骤：调用 archive(id)；预期结果：状态变为 archived', async () => {
    const mockResponse = { id: 't1', status: 'archived' }
    ;(global.fetch as any).mockResolvedValueOnce({ ok: true, json: async () => mockResponse })

    const result = await templatesApi.archive('t1')

    expect(fetch).toHaveBeenCalledWith('/api/v1/workflow-templates/t1/archive', expect.objectContaining({ method: 'POST' }))
    expect(result.status).toBe('archived')
  })

  it('前置条件：模板存在；操作步骤：调用 duplicate(id,data)；预期结果：返回复制后的新模板', async () => {
    const mockResponse = { id: 't-copy', name: 'Copy', status: 'draft' }
    ;(global.fetch as any).mockResolvedValueOnce({ ok: true, json: async () => mockResponse })

    const result = await templatesApi.duplicate('t1', { name: 'Copy' })

    expect(fetch).toHaveBeenCalledWith('/api/v1/workflow-templates/t1/duplicate', expect.objectContaining({ method: 'POST' }))
    expect(result.id).toBe('t-copy')
  })

  it('前置条件：模板存在多个版本；操作步骤：调用 getVersions(id)；预期结果：返回版本列表', async () => {
    const mockResponse = { data: [{ version: 'v1.0' }, { version: 'v1.1' }], total: 2 }
    ;(global.fetch as any).mockResolvedValueOnce({ ok: true, json: async () => mockResponse })

    const result = await templatesApi.getVersions('t1')

    expect(fetch).toHaveBeenCalledWith('/api/v1/workflow-templates/t1/versions')
    expect(result.total).toBe(2)
  })

  it('前置条件：存在历史版本；操作步骤：调用 rollback(id,version)；预期结果：返回回滚后的模板', async () => {
    const mockResponse = { id: 't1', version: 'v1.2' }
    ;(global.fetch as any).mockResolvedValueOnce({ ok: true, json: async () => mockResponse })

    const result = await templatesApi.rollback('t1', 'v1.0')

    expect(fetch).toHaveBeenCalledWith('/api/v1/workflow-templates/t1/rollback', expect.objectContaining({ method: 'POST' }))
    expect(result.version).toBe('v1.2')
  })

  it('前置条件：后端返回错误；操作步骤：调用 get(id)；预期结果：抛出 Error', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({ ok: false, status: 404, text: async () => 'Not Found', statusText: 'Not Found' })

    await expect(templatesApi.get('missing')).rejects.toThrow('API 404')
  })
})
