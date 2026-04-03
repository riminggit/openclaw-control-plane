import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { apiGet, apiPost } from '../api/client';
import {
  Button,
  Card,
  Table,
  Tag,
  Empty,
  Spin,
  Modal,
  Form,
  Input,
  Select,
  message,
  Space,
  Badge,
} from 'antd';

interface TriggerConfig {
  id: string;
  name: string;
  description: string;
  trigger_type: string;
  state: string;
  webhook_url: string;
  allowed_ips: string[];
  workflow_template_id: string;
  agent_id: string;
  rate_limit_per_minute: number;
  created_at: string;
  updated_at: string | null;
}

interface TriggerEvent {
  id: string;
  trigger_id: string;
  verified: boolean;
  source_ip: string;
  result: any;
  error: string;
  created_at: string;
}

export function TriggersPage() {
  const { t } = useTranslation();
  const [triggers, setTriggers] = useState<TriggerConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [eventsOpen, setEventsOpen] = useState(false);
  const [events, setEvents] = useState<TriggerEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [form] = Form.useForm();

  const fetchTriggers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiGet<{ triggers: TriggerConfig[]; total: number }>('/api/v2/triggers');
      setTriggers(res?.triggers || []);
    } catch {
      setTriggers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTriggers();
  }, [fetchTriggers]);

  const handleCreate = async (values: any) => {
    setCreating(true);
    try {
      await apiPost('/api/v2/triggers', values);
      message.success(t('triggers.created', '触发器创建成功'));
      setCreateOpen(false);
      form.resetFields();
      fetchTriggers();
    } catch (e: any) {
      message.error(e?.message || t('app.error'));
    } finally {
      setCreating(false);
    }
  };

  const handleViewEvents = async (triggerId: string) => {
    setEventsOpen(true);
    setEventsLoading(true);
    try {
      const res = await apiGet<{ events: TriggerEvent[]; total: number }>(
        `/api/v2/triggers/${triggerId}/events`,
      );
      setEvents(res?.events || []);
    } catch {
      setEvents([]);
    } finally {
      setEventsLoading(false);
    }
  };

  const handleDelete = async (triggerId: string) => {
    if (!confirm(t('triggers.confirm_delete', '确定删除该触发器？'))) return;
    try {
      await fetch(`/api/v2/triggers/${triggerId}`, { method: 'DELETE' });
      message.success(t('app.deleted'));
      fetchTriggers();
    } catch (e: any) {
      message.error(e?.message || t('app.error'));
    }
  };

  const columns = [
    {
      title: t('triggers.name', '名称'),
      dataIndex: 'name',
      key: 'name',
      render: (name: string, r: TriggerConfig) => (
        <div>
          <div style={{ fontWeight: 600 }}>{name}</div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            {r.trigger_type}
          </div>
        </div>
      ),
    },
    {
      title: t('triggers.type', '类型'),
      dataIndex: 'trigger_type',
      key: 'type',
      width: 120,
      render: (type: string) => <Tag>{type}</Tag>,
    },
    {
      title: t('triggers.state', '状态'),
      dataIndex: 'state',
      key: 'state',
      width: 80,
      render: (state: string) => (
        <Badge status={state === 'active' ? 'success' : 'default'} text={state} />
      ),
    },
    {
      title: t('triggers.webhook_url', 'Webhook URL'),
      dataIndex: 'webhook_url',
      key: 'webhook_url',
      ellipsis: true,
      render: (url: string) => (
        <code
          style={{
            fontSize: 'var(--text-xs)',
            background: 'var(--bg-tertiary)',
            padding: '2px 6px',
            borderRadius: 4,
          }}
        >
          {url}
        </code>
      ),
    },
    {
      title: t('triggers.rate_limit', '速率限制'),
      dataIndex: 'rate_limit_per_minute',
      key: 'rate_limit',
      width: 100,
      render: (limit: number) => `${limit}/min`,
    },
    {
      title: t('app.actions', '操作'),
      key: 'actions',
      width: 180,
      render: (_: any, r: TriggerConfig) => (
        <Space size='small'>
          <Button size='small' onClick={() => handleViewEvents(r.id)}>
            {t('triggers.events', '事件')}
          </Button>
          <Button size='small' type='text' danger onClick={() => handleDelete(r.id)}>
            {t('app.delete')}
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className='page-header'>
        <p className='page-header-eyebrow'>{t('triggers.eyebrow', 'Phase 3')}</p>
        <h1>{t('triggers.title', '远程触发器')}</h1>
        <p className='page-header-desc'>{t('triggers.subtitle', 'Webhook 和远程触发管理')}</p>
      </div>

      <div style={{ marginBottom: 'var(--space-4)', display: 'flex', gap: 'var(--space-3)' }}>
        <Button type='primary' onClick={() => setCreateOpen(true)}>
          {t('triggers.create', '创建触发器')}
        </Button>
        <Button onClick={fetchTriggers} disabled={loading}>
          🔄 {t('app.retry')}
        </Button>
      </div>

      <div className='card'>
        {loading ? (
          <div className='card-body' style={{ textAlign: 'center', padding: 'var(--space-10)' }}>
            <Spin />
          </div>
        ) : triggers.length === 0 ? (
          <div
            className='card-body'
            style={{ padding: 'var(--space-10)', display: 'flex', justifyContent: 'center' }}
          >
            <Empty description={t('triggers.no_triggers', '暂无触发器')} />
          </div>
        ) : (
          <Table
            dataSource={triggers}
            columns={columns}
            rowKey='id'
            pagination={{ pageSize: 20 }}
            size='small'
          />
        )}
      </div>

      {/* Create Trigger Modal */}
      <Modal
        open={createOpen}
        title={t('triggers.create', '创建触发器')}
        onCancel={() => setCreateOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={creating}
      >
        <Form form={form} layout='vertical' onFinish={handleCreate}>
          <Form.Item name='name' label={t('triggers.name', '名称')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name='trigger_type' label={t('triggers.type', '类型')} initialValue='webhook'>
            <Select>
              <Select.Option value='webhook'>Webhook</Select.Option>
              <Select.Option value='api_callback'>API Callback</Select.Option>
              <Select.Option value='event_bridge'>Event Bridge</Select.Option>
              <Select.Option value='custom'>Custom</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name='description' label={t('triggers.description', '描述')}>
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name='workflow_template_id' label={t('triggers.workflow', '工作流模板 ID')}>
            <Input />
          </Form.Item>
          <Form.Item
            name='rate_limit_per_minute'
            label={t('triggers.rate_limit', '速率限制 (次/分)')}
            initialValue={60}
          >
            <Input type='number' />
          </Form.Item>
        </Form>
      </Modal>

      {/* Events Modal */}
      <Modal
        open={eventsOpen}
        title={t('triggers.recent_events', '最近事件')}
        onCancel={() => setEventsOpen(false)}
        footer={null}
        width={640}
      >
        {eventsLoading ? (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <Spin />
          </div>
        ) : events.length === 0 ? (
          <Empty description={t('triggers.no_events', '暂无事件')} />
        ) : (
          <Table
            dataSource={events}
            columns={[
              {
                title: 'ID',
                dataIndex: 'id',
                key: 'id',
                render: (id: string) => id.slice(0, 8),
                width: 80,
              },
              {
                title: t('triggers.verified', '已验证'),
                dataIndex: 'verified',
                key: 'verified',
                width: 80,
                render: (v: boolean) => (v ? '✅' : '❌'),
              },
              { title: 'IP', dataIndex: 'source_ip', key: 'ip', width: 120 },
              {
                title: t('triggers.time', '时间'),
                dataIndex: 'created_at',
                key: 'time',
                render: (d: string) => new Date(d).toLocaleString(),
              },
            ]}
            rowKey='id'
            pagination={{ pageSize: 10 }}
            size='small'
          />
        )}
      </Modal>
    </div>
  );
}
