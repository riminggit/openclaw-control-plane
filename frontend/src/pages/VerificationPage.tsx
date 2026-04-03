import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { apiGet, apiPost } from '../api/client';
import {
  Button,
  Card,
  Table,
  Tag,
  Progress,
  Empty,
  Spin,
  Modal,
  Descriptions,
  message,
} from 'antd';

interface VerificationResult {
  criterion_id: string;
  criterion_name: string;
  status: string;
  score: number;
  message: string;
  evidence: string;
  duration_ms: number;
}

interface VerificationReport {
  id: string;
  task_id: string;
  step_id: string;
  workflow_instance_id: string;
  overall_status: string;
  overall_score: number;
  summary: string;
  created_at: string;
  completed_at: string | null;
  results: VerificationResult[];
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'default',
  running: 'processing',
  passed: 'success',
  failed: 'error',
  skipped: 'warning',
  error: 'error',
};

export function VerificationPage() {
  const { t } = useTranslation();
  const [reports, setReports] = useState<VerificationReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<VerificationReport | null>(null);

  const fetchReports = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiGet<{ reports: VerificationReport[]; total: number }>(
        '/api/v2/verification/reports',
      );
      setReports(res?.reports || []);
    } catch {
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleRunVerification = async (reportId: string) => {
    try {
      await apiPost(`/api/v2/verification/reports/${reportId}/run`, {});
      message.success(t('verification.run_started', '验证已启动'));
      fetchReports();
    } catch (e: any) {
      message.error(e?.message || t('app.error'));
    }
  };

  const columns = [
    {
      title: t('verification.report_id', '报告 ID'),
      dataIndex: 'id',
      key: 'id',
      render: (id: string) => id.slice(0, 8) + '...',
      width: 120,
    },
    {
      title: t('verification.task_id', '任务 ID'),
      dataIndex: 'task_id',
      key: 'task_id',
      render: (id: string) => id.slice(0, 8) + '...',
      width: 120,
    },
    {
      title: t('verification.status', '状态'),
      dataIndex: 'overall_status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={STATUS_COLORS[status] || 'default'}>{status.toUpperCase()}</Tag>
      ),
    },
    {
      title: t('verification.score', '得分'),
      dataIndex: 'overall_score',
      key: 'score',
      width: 120,
      render: (score: number) => <Progress percent={Math.round(score * 100)} size='small' />,
    },
    {
      title: t('verification.criteria_count', '检查项'),
      key: 'criteria',
      width: 80,
      render: (_: any, r: VerificationReport) => r.results?.length || 0,
    },
    {
      title: t('verification.created', '创建时间'),
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (d: string) => (d ? new Date(d).toLocaleString() : '-'),
    },
    {
      title: t('app.actions', '操作'),
      key: 'actions',
      width: 180,
      render: (_: any, r: VerificationReport) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button size='small' onClick={() => setSelectedReport(r)}>
            {t('verification.view_detail', '详情')}
          </Button>
          {r.overall_status === 'pending' && (
            <Button size='small' type='primary' onClick={() => handleRunVerification(r.id)}>
              {t('verification.run', '运行')}
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className='page-header'>
        <p className='page-header-eyebrow'>{t('verification.eyebrow', 'Phase 3')}</p>
        <h1>{t('verification.title', '验证报告')}</h1>
        <p className='page-header-desc'>
          {t('verification.subtitle', '自动化验证 Agent 输出质量')}
        </p>
      </div>

      <div className='card'>
        {loading ? (
          <div className='card-body' style={{ textAlign: 'center', padding: 'var(--space-10)' }}>
            <Spin />
          </div>
        ) : reports.length === 0 ? (
          <div
            className='card-body'
            style={{ padding: 'var(--space-10)', display: 'flex', justifyContent: 'center' }}
          >
            <Empty description={t('verification.no_reports', '暂无验证报告')} />
          </div>
        ) : (
          <Table
            dataSource={reports}
            columns={columns}
            rowKey='id'
            pagination={{ pageSize: 20 }}
            size='small'
          />
        )}
      </div>

      <Modal
        open={!!selectedReport}
        title={t('verification.report_detail', '验证报告详情')}
        onCancel={() => setSelectedReport(null)}
        footer={null}
        width={720}
      >
        {selectedReport && (
          <div>
            <Descriptions bordered size='small' column={2} style={{ marginBottom: 16 }}>
              <Descriptions.Item label='ID'>{selectedReport.id}</Descriptions.Item>
              <Descriptions.Item label={t('verification.task_id', '任务 ID')}>
                {selectedReport.task_id}
              </Descriptions.Item>
              <Descriptions.Item label={t('verification.status', '状态')}>
                <Tag color={STATUS_COLORS[selectedReport.overall_status] || 'default'}>
                  {selectedReport.overall_status.toUpperCase()}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label={t('verification.score', '得分')}>
                <Progress percent={Math.round(selectedReport.overall_score * 100)} size='small' />
              </Descriptions.Item>
            </Descriptions>
            <h4>{t('verification.results', '检查结果')}</h4>
            <Table
              dataSource={selectedReport.results || []}
              columns={[
                {
                  title: t('verification.criterion', '检查项'),
                  dataIndex: 'criterion_name',
                  key: 'name',
                },
                {
                  title: t('verification.status', '状态'),
                  dataIndex: 'status',
                  key: 'status',
                  width: 80,
                  render: (s: string) => (
                    <Tag color={STATUS_COLORS[s] || 'default'}>{s.toUpperCase()}</Tag>
                  ),
                },
                {
                  title: t('verification.score', '得分'),
                  dataIndex: 'score',
                  key: 'score',
                  width: 80,
                  render: (s: number) => `${Math.round(s * 100)}%`,
                },
                { title: t('verification.message', '消息'), dataIndex: 'message', key: 'message' },
              ]}
              rowKey='criterion_id'
              pagination={false}
              size='small'
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
