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

interface PluginInfo {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  homepage: string;
  entry_point: string;
  state: string;
  skills: string[];
  tools: string[];
  hooks: string[];
  error_message: string;
  loaded_at: string | null;
}

const STATE_COLORS: Record<string, string> = {
  discovered: 'default',
  loading: 'processing',
  loaded: 'blue',
  active: 'success',
  error: 'error',
  unloaded: 'default',
};

const STATE_LABELS: Record<string, string> = {
  discovered: '已发现',
  loading: '加载中',
  loaded: '已加载',
  active: '已激活',
  error: '错误',
  unloaded: '已卸载',
};

export function PluginsPage() {
  const { t } = useTranslation();
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [form] = Form.useForm();

  const fetchPlugins = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiGet<{ plugins: PluginInfo[]; total: number }>('/api/v2/plugins');
      setPlugins(res?.plugins || []);
    } catch {
      setPlugins([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlugins();
  }, [fetchPlugins]);

  const handleRegister = async (values: any) => {
    setRegistering(true);
    try {
      await apiPost('/api/v2/plugins', values);
      message.success(t('plugins.registered', '插件注册成功'));
      setRegisterOpen(false);
      form.resetFields();
      fetchPlugins();
    } catch (e: any) {
      message.error(e?.message || t('app.error'));
    } finally {
      setRegistering(false);
    }
  };

  const handleAction = async (pluginId: string, action: string) => {
    try {
      await apiPost(`/api/v2/plugins/${pluginId}/${action}`, {});
      message.success(t('plugins.action_success', '操作成功'));
      fetchPlugins();
    } catch (e: any) {
      message.error(e?.message || t('app.error'));
    }
  };

  const handleDelete = async (pluginId: string) => {
    if (!confirm(t('plugins.confirm_delete', '确定删除该插件？'))) return;
    try {
      await fetch(`/api/v2/plugins/${pluginId}`, { method: 'DELETE' });
      message.success(t('app.deleted'));
      fetchPlugins();
    } catch (e: any) {
      message.error(e?.message || t('app.error'));
    }
  };

  const columns = [
    {
      title: t('plugins.name', '名称'),
      dataIndex: 'name',
      key: 'name',
      render: (name: string, r: PluginInfo) => (
        <div>
          <div style={{ fontWeight: 600 }}>{name}</div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>v{r.version}</div>
        </div>
      ),
    },
    {
      title: t('plugins.description', '描述'),
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: t('plugins.state', '状态'),
      dataIndex: 'state',
      key: 'state',
      width: 100,
      render: (state: string) => (
        <Badge
          status={state === 'active' ? 'success' : state === 'error' ? 'error' : 'default'}
          text={STATE_LABELS[state] || state}
        />
      ),
    },
    {
      title: t('plugins.skills', '技能'),
      dataIndex: 'skills',
      key: 'skills',
      width: 150,
      render: (skills: string[]) =>
        skills.length > 0 ? (
          skills.slice(0, 3).map(s => <Tag key={s}>{s}</Tag>)
        ) : (
          <span style={{ color: 'var(--text-muted)' }}>-</span>
        ),
    },
    {
      title: t('plugins.author', '作者'),
      dataIndex: 'author',
      key: 'author',
      width: 100,
      ellipsis: true,
    },
    {
      title: t('app.actions', '操作'),
      key: 'actions',
      width: 220,
      render: (_: any, r: PluginInfo) => (
        <Space size='small'>
          {r.state === 'discovered' && (
            <Button size='small' type='primary' onClick={() => handleAction(r.id, 'load')}>
              {t('plugins.load', '加载')}
            </Button>
          )}
          {r.state === 'loaded' && (
            <Button size='small' type='primary' onClick={() => handleAction(r.id, 'activate')}>
              {t('plugins.activate', '激活')}
            </Button>
          )}
          {r.state === 'active' && (
            <Button size='small' onClick={() => handleAction(r.id, 'deactivate')}>
              {t('plugins.deactivate', '停用')}
            </Button>
          )}
          {(r.state === 'loaded' || r.state === 'active') && (
            <Button size='small' danger onClick={() => handleAction(r.id, 'unload')}>
              {t('plugins.unload', '卸载')}
            </Button>
          )}
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
        <p className='page-header-eyebrow'>{t('plugins.eyebrow', 'Phase 3')}</p>
        <h1>{t('plugins.title', '插件管理')}</h1>
        <p className='page-header-desc'>{t('plugins.subtitle', '管理和扩展 Agent 能力')}</p>
      </div>

      <div style={{ marginBottom: 'var(--space-4)', display: 'flex', gap: 'var(--space-3)' }}>
        <Button type='primary' onClick={() => setRegisterOpen(true)}>
          {t('plugins.register', '注册插件')}
        </Button>
        <Button onClick={fetchPlugins} disabled={loading}>
          🔄 {t('app.retry')}
        </Button>
      </div>

      <div className='card'>
        {loading ? (
          <div className='card-body' style={{ textAlign: 'center', padding: 'var(--space-10)' }}>
            <Spin />
          </div>
        ) : plugins.length === 0 ? (
          <div
            className='card-body'
            style={{ padding: 'var(--space-10)', display: 'flex', justifyContent: 'center' }}
          >
            <Empty description={t('plugins.no_plugins', '暂无插件')} />
          </div>
        ) : (
          <Table
            dataSource={plugins}
            columns={columns}
            rowKey='id'
            pagination={{ pageSize: 20 }}
            size='small'
          />
        )}
      </div>

      <Modal
        open={registerOpen}
        title={t('plugins.register', '注册插件')}
        onCancel={() => setRegisterOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={registering}
      >
        <Form form={form} layout='vertical' onFinish={handleRegister}>
          <Form.Item name='name' label={t('plugins.name', '名称')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name='version' label={t('plugins.version', '版本')} initialValue='0.1.0'>
            <Input />
          </Form.Item>
          <Form.Item name='description' label={t('plugins.description', '描述')}>
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name='entry_point' label={t('plugins.entry_point', '入口点')}>
            <Input placeholder='e.g., my_plugin.main' />
          </Form.Item>
          <Form.Item name='author' label={t('plugins.author', '作者')}>
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
