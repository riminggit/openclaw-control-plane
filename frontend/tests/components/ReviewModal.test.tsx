import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReviewModal } from '@/components/workflow/ReviewModal'
import { ReviewAction } from '@/types/workflow'

describe('ReviewModal', () => {
  const review = {
    step_name: '审核步骤',
    workflow_name: '工作流A',
    reviewer_name: '张三',
    remaining_time: 3600,
    review_round: 1,
    outputs: {
      summary: '这里是输出摘要',
      files: [{ name: 'result.txt', size_bytes: 2048, download_url: 'http://example.com/file' }],
      dependencies: [{ step_name: '前置步骤', output_summary: '已完成' }],
    },
    history: [{ reviewer_name: '李四', action: 'approve', created_at: new Date().toISOString(), comment: '通过' }],
  } as any

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('alert', vi.fn())
  })

  it('前置条件：isOpen=true；操作步骤：渲染组件；预期结果：显示审核弹窗内容', () => {
    render(
      <ReviewModal
        review={review}
        isOpen={true}
        onClose={vi.fn()}
        onApprove={vi.fn().mockResolvedValue(undefined)}
        onReject={vi.fn().mockResolvedValue(undefined)}
        onRequestChanges={vi.fn().mockResolvedValue(undefined)}
      />
    )

    expect(screen.getByText('审核 - 审核步骤')).toBeInTheDocument()
    expect(screen.getByText('工作流: 工作流A')).toBeInTheDocument()
    expect(screen.getByText('这里是输出摘要')).toBeInTheDocument()
    expect(screen.getByText(/result.txt/)).toBeInTheDocument()
  })

  it('前置条件：isOpen=false；操作步骤：渲染组件；预期结果：不显示弹窗', () => {
    const { container } = render(
      <ReviewModal
        review={review}
        isOpen={false}
        onClose={vi.fn()}
        onApprove={vi.fn().mockResolvedValue(undefined)}
        onReject={vi.fn().mockResolvedValue(undefined)}
        onRequestChanges={vi.fn().mockResolvedValue(undefined)}
      />
    )

    expect(container.firstChild).toBeNull()
  })

  it('前置条件：填写审核意见；操作步骤：点击通过；预期结果：调用 onApprove 并关闭弹窗', async () => {
    const user = userEvent.setup()
    const onApprove = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()

    render(
      <ReviewModal
        review={review}
        isOpen={true}
        onClose={onClose}
        onApprove={onApprove}
        onReject={vi.fn().mockResolvedValue(undefined)}
        onRequestChanges={vi.fn().mockResolvedValue(undefined)}
      />
    )

    await user.type(screen.getByPlaceholderText('请填写审核意见...'), '同意发布')
    await user.click(screen.getByText('通过'))

    await waitFor(() => {
      expect(onApprove).toHaveBeenCalledWith('同意发布')
      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })

  it('前置条件：填写审核意见；操作步骤：点击拒绝；预期结果：调用 onReject', async () => {
    const user = userEvent.setup()
    const onReject = vi.fn().mockResolvedValue(undefined)

    render(
      <ReviewModal
        review={review}
        isOpen={true}
        onClose={vi.fn()}
        onApprove={vi.fn().mockResolvedValue(undefined)}
        onReject={onReject}
        onRequestChanges={vi.fn().mockResolvedValue(undefined)}
      />
    )

    await user.type(screen.getByPlaceholderText('请填写审核意见...'), '拒绝，需重做')
    await user.click(screen.getByText('拒绝'))

    await waitFor(() => expect(onReject).toHaveBeenCalledWith('拒绝，需重做'))
  })

  it('前置条件：未填写审核意见；操作步骤：点击通过；预期结果：按钮禁用，避免提交空意见', () => {
    render(
      <ReviewModal
        review={review}
        isOpen={true}
        onClose={vi.fn()}
        onApprove={vi.fn().mockResolvedValue(undefined)}
        onReject={vi.fn().mockResolvedValue(undefined)}
        onRequestChanges={vi.fn().mockResolvedValue(undefined)}
      />
    )

    expect(screen.getByText('通过')).toBeDisabled()
    expect(screen.getByText('拒绝')).toBeDisabled()
    expect(screen.getByText('要求修改')).toBeDisabled()
  })
})
