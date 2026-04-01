import { useEffect, useState } from 'react'
import { Timeline, Tag, Empty, Button, Spin, Collapse } from 'antd'
import { ClockCircleOutlined } from '@ant-design/icons'
import { apiGet } from '../api/client'

interface ThoughtStep {
  id: string
  category: string
  content: string
  created_at: string
}

export function AgentThoughtPanel({ taskId }: { taskId: string }) {
  const [thoughts, setThoughts] = useState<ThoughtStep[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [limit, setLimit] = useState(10)

  const fetchThoughts = async () => {
    setLoading(true)
    try {
      const res = await apiGet<{ task_id: string; total: number; thoughts: ThoughtStep[] }>(`/tasks/${taskId}/thoughts?limit=${limit}`)
      setThoughts(res.thoughts || [])
      setTotal(res.total || 0)
    } catch {
      setThoughts([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchThoughts() }, [taskId, limit])

  if (loading) return <Spin style={{ display: 'block', margin: '20px auto' }} />

  const categoryColors: Record<string, string> = {
    analysis: 'blue', planning: 'green', execution: 'orange',
    reflection: 'purple', decision: 'red', question: 'cyan',
  }

  if (thoughts.length === 0) {
    return <Empty description="暂无思考记录" style={{ padding: 24 }} />
  }

  return (
    <div>
      <Timeline
        items={thoughts.map(t => ({
          dot: <ClockCircleOutlined style={{ fontSize: 14 }} />,
          children: (
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                <Tag color={categoryColors[t.category] || 'default'} style={{ margin: 0 }}>
                  {t.category || 'thought'}
                </Tag>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {t.created_at ? new Date(t.created_at).toLocaleString() : ''}
                </span>
              </div>
              <Collapse
                size="small"
                ghost
                items={[{
                  key: t.id,
                  label: <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{t.content?.slice(0, 80)}{t.content?.length > 80 ? '...' : ''}</span>,
                  children: <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.6 }}>{t.content}</div>,
                }]}
              />
            </div>
          ),
        }))}
      />
      {thoughts.length < total && (
        <Button type="link" onClick={() => setLimit(l => l + 10)} block>
          加载更多 ({total - thoughts.length} 条)
        </Button>
      )}
    </div>
  )
}
