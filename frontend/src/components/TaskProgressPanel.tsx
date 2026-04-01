import { useEffect, useState } from 'react'
import { Progress, Statistic, Row, Col, Spin } from 'antd'
import { ClockCircleOutlined, FieldTimeOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { apiGet } from '../api/client'

interface ProgressData {
  task_id: string
  status: string
  estimated_duration_seconds: number | null
  estimated_progress: number
  progress_source: string
  elapsed_seconds: number
  remaining_seconds: number | null
  is_overtime: boolean
  actual_duration_seconds: number | null
}

function fmtDuration(sec: number | null, t: (key: string, fallback: string) => string): string {
  if (sec == null || sec < 0) return t('task_progress.calculating', '计算中...')
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

export function TaskProgressPanel({ taskId }: { taskId: string }) {
  const { t } = useTranslation()
  const [data, setData] = useState<ProgressData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    apiGet<ProgressData>(`/tasks/${taskId}/progress`)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [taskId])

  if (loading) return <Spin style={{ display: 'block', margin: '20px auto' }} />
  if (!data) return <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 16 }}>{t('task_progress.no_data', '无进度数据')}</div>

  const pct = Math.min(100, Math.round(data.estimated_progress))
  const strokeColor = data.is_overtime ? '#faad14' : '#52c41a'

  return (
    <div>
      <Progress
        percent={pct}
        strokeColor={strokeColor}
        format={(p) => `${p}%`}
        style={{ marginBottom: 16 }}
      />
      <Row gutter={16}>
        <Col span={8}>
          <Statistic
            title={t('task_progress.estimated_duration', '预估总时长')}
            value={data.estimated_duration_seconds ? fmtDuration(data.estimated_duration_seconds, t) : t('task_progress.not_set', '未设置')}
            prefix={<FieldTimeOutlined />}
            valueStyle={{ fontSize: 14 }}
          />
        </Col>
        <Col span={8}>
          <Statistic
            title={t('task_progress.elapsed_time', '已用时间')}
            value={fmtDuration(data.elapsed_seconds, t)}
            prefix={<ClockCircleOutlined />}
            valueStyle={{ fontSize: 14 }}
          />
        </Col>
        <Col span={8}>
          <Statistic
            title={t('task_progress.remaining_time', '剩余时间')}
            value={fmtDuration(data.remaining_seconds, t)}
            prefix={<ClockCircleOutlined />}
            valueStyle={{ fontSize: 14, color: data.is_overtime ? '#faad14' : undefined }}
          />
        </Col>
      </Row>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
        {t('task_progress.progress_source', '进度来源')}: {data.progress_source} | {t('task_progress.status', '状态')}: {data.status}
        {data.actual_duration_seconds != null && ` | ${t('task_progress.actual_duration', '实际用时')}: ${fmtDuration(data.actual_duration_seconds, t)}`}
      </div>
    </div>
  )
}
