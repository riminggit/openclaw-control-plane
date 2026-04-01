import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Input, Select, Card, Empty, Spin, Skeleton, message } from 'antd'
import { FileOutlined, FolderOutlined, SaveOutlined, DeleteOutlined, DownloadOutlined, FileAddOutlined, SearchOutlined } from '@ant-design/icons'


interface FileNode {
  name: string
  path: string
  type: 'file' | 'folder'
  children?: FileNode[]
}

const API = '/api/memory'

export function MemoryPage() {
  const { t } = useTranslation()
  const [agents, setAgents] = useState<string[]>(['main'])
  const [selectedAgent, setSelectedAgent] = useState('main')
  const [fileTree, setFileTree] = useState<FileNode[]>([])
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [fileContent, setFileContent] = useState('')
  const [originalContent, setOriginalContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [fileLoading, setFileLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<{ path: string; line: number; text: string }[]>([])
  const [previewMode, setPreviewMode] = useState(false)
  const [saving, setSaving] = useState(false)

  const treeBase = 'memory'

  const fetchTree = useCallback(async (agent: string) => {
    try {
      const res = await fetch(`${API}/tree?agent=${encodeURIComponent(agent)}`)
      if (res.ok) setFileTree(await res.json())
    } catch { /* ignore */ }
  }, [])

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch(`${API}/agents`)
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data) && data.length) setAgents(data)
      }
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    Promise.all([fetchTree(selectedAgent), fetchAgents()]).finally(() => setLoading(false))
  }, [selectedAgent])

  // Tree returns paths relative to WORKSPACE/memory, but /memory/file resolves against WORKSPACE
  // So we need to prefix with 'memory/' when calling file API
  const filePath = selectedFile ? `memory/${selectedFile}` : null

  useEffect(() => {
    if (!filePath) return
    setFileLoading(true)
    fetch(`${API}/file?path=${encodeURIComponent(filePath)}`)
      .then(r => r.ok ? r.json() : Promise.resolve(null))
      .then(data => { const text = data?.content ?? ''; setFileContent(text); setOriginalContent(text) })
      .catch(() => { setFileContent(''); setOriginalContent('') })
      .finally(() => setFileLoading(false))
  }, [filePath])

  const handleSave = async () => {
    if (!filePath) return
    setSaving(true)
    try {
      await fetch(`${API}/file`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: filePath, content: fileContent }) })
      setOriginalContent(fileContent)
      message.success(t('app.saved', '保存成功'))
    } catch {
      message.error(t('app.error', '操作失败'))
    }
    setSaving(false)
  }

  const handleDelete = async () => {
    if (!filePath) return
    if (!confirm(t('memory.confirm_delete', '确定要删除此文件吗？'))) return
    try {
      await fetch(`${API}/file`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: filePath }) })
      setSelectedFile(null); setFileContent(''); setOriginalContent('')
      fetchTree(selectedAgent)
      message.success(t('app.deleted', '删除成功'))
    } catch {
      message.error(t('app.error', '操作失败'))
    }
  }

  const handleNewFile = async () => {
    const name = prompt(t('memory.new_file_prompt', '新文件名:'))
    if (!name) return
    const parentDir = selectedFile ? selectedFile.substring(0, selectedFile.lastIndexOf('/')) : ''
    const fullPath = parentDir ? `${parentDir}/${name}` : name
    try {
      await fetch(`${API}/file`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: `memory/${fullPath}`, content: '' }) })
      fetchTree(selectedAgent)
      setSelectedFile(fullPath)
      message.success(t('app.created', '创建成功'))
    } catch {
      message.error(t('app.error', '操作失败'))
    }
  }

  const handleDownload = () => {
    if (!selectedFile) return
    const blob = new Blob([fileContent], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = selectedFile.split('/').pop()!; a.click()
    URL.revokeObjectURL(url)
  }

  const handleExportZip = async () => {
    try {
      const res = await fetch(`${API}/export?agent=${encodeURIComponent(selectedAgent)}`)
      if (res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = `memory-${selectedAgent}.zip`; a.click()
        URL.revokeObjectURL(url)
        message.success(t('app.exported', '导出成功'))
      }
    } catch {
      message.error(t('app.error', '操作失败'))
    }
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    try {
      const res = await fetch(`${API}/search?agent=${encodeURIComponent(selectedAgent)}&q=${encodeURIComponent(searchQuery)}`)
      if (res.ok) setSearchResults(await res.json())
    } catch { /* ignore */ }
  }

  const hasChanges = fileContent !== originalContent

  const renderTree = (nodes: FileNode[], depth: number = 0) => nodes.map(node => (
    <div key={node.path}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          padding: '6px 12px',
          cursor: node.type === 'file' ? 'pointer' : 'default',
          paddingLeft: 12 + depth * 20,
          borderRadius: 'var(--radius-md)',
          background: selectedFile === node.path ? 'var(--accent-muted)' : 'transparent',
          transition: 'background var(--transition-fast)',
        }}
        onClick={() => node.type === 'file' && setSelectedFile(node.path)}
        onMouseEnter={(e) => {
          if (node.type === 'file' && selectedFile !== node.path) {
            e.currentTarget.style.background = 'var(--bg-surface-hover)'
          }
        }}
        onMouseLeave={(e) => {
          if (node.type === 'file' && selectedFile !== node.path) {
            e.currentTarget.style.background = 'transparent'
          }
        }}
      >
        {node.type === 'folder' ? (
          <FolderOutlined style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }} />
        ) : (
          <FileOutlined style={{ fontSize: 'var(--text-sm)', color: 'var(--accent)' }} />
        )}
        <span style={{
          fontSize: 'var(--text-sm)',
          color: node.type === 'file' ? 'var(--text-primary)' : 'var(--text-secondary)',
          fontWeight: node.type === 'folder' ? 600 : 400,
        }}>
          {node.name}
        </span>
      </div>
      {node.children && renderTree(node.children, depth + 1)}
    </div>
  ))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <div className="page-eyebrow">{t('memory.eyebrow', '记忆浏览器')}</div>
          <h1 className="page-title">{t('memory.title', 'Memory 浏览器')}</h1>
          <p className="page-subtitle">{t('memory.subtitle', '浏览和管理 Agent 记忆文件')}</p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
          <Select value={selectedAgent} onChange={e => { setSelectedAgent(e); setSelectedFile(null) }} style={{ width: 150 }}>
            {agents.map(a => <Select.Option key={a} value={a}>{a}</Select.Option>)}
          </Select>
          <Button icon={<DownloadOutlined />} onClick={handleExportZip}>{t('memory.export_zip', '导出 ZIP')}</Button>
        </div>
      </div>

      {/* Search */}
      <Input.Search
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
        onSearch={handleSearch}
        placeholder={t('memory.search_placeholder', '搜索文件内容...')}
        prefix={<SearchOutlined />}
        allowClear
        style={{ maxWidth: 600 }}
      />
      
      {searchResults.length > 0 && (
        <Card size="small" style={{ maxHeight: 200, overflow: 'auto' }}>
          {searchResults.map((r, i) => (
            <div
              key={i}
              style={{
                fontSize: 'var(--text-sm)',
                cursor: 'pointer',
                padding: 'var(--space-2)',
                borderRadius: 'var(--radius-sm)',
                transition: 'background var(--transition-fast)',
              }}
              onClick={() => { setSelectedFile(r.path); setSearchResults([]) }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-surface-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>
                {r.path}:{r.line}
              </span>
              {' — '}
              <span style={{ color: 'var(--text-primary)' }}>{r.text}</span>
            </div>
          ))}
        </Card>
      )}

      {/* Main Layout */}
      <div style={{ display: 'flex', gap: 'var(--space-4)', minHeight: 500 }}>
        {/* File Tree */}
        <Card
          style={{ width: 280, minWidth: 240 }}
          styles={{ body: { padding: 'var(--space-3)', maxHeight: 500, overflow: 'auto' } }}
        >
          {loading ? (
            <Spin />
          ) : fileTree.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={t('memory.no_files', '暂无文件')}
              style={{ padding: 'var(--space-6) 0' }}
            />
          ) : (
            renderTree(fileTree)
          )}
        </Card>

        {/* Editor */}
        <Card
          style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
          styles={{ body: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 } }}
        >
          {/* Toolbar */}
          {selectedFile && (
            <div style={{
              display: 'flex',
              gap: 'var(--space-2)',
              padding: 'var(--space-3) var(--space-4)',
              borderBottom: '1px solid var(--border-default)',
              alignItems: 'center',
              flexWrap: 'wrap',
              background: 'var(--bg-surface)',
            }}>
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, flex: 1, fontFamily: 'var(--font-mono)' }}>
                {selectedFile}
              </span>
              <span className={`badge ${hasChanges ? 'badge-yellow' : 'badge-green'}`}>
                {hasChanges ? t('services.unsaved', '未保存') : t('services.saved', '已保存')}
              </span>
              <Button size="small" onClick={() => setPreviewMode(!previewMode)}>
                {previewMode ? t('memory.edit_mode', '编辑') : t('memory.preview_mode', '预览')}
              </Button>
              <Button size="small" type="primary" icon={<SaveOutlined />} onClick={handleSave} disabled={!hasChanges || saving} loading={saving}>
                {t('app.save')}
              </Button>
              <Button size="small" icon={<FileAddOutlined />} onClick={handleNewFile}>
                {t('memory.new_file', '新建')}
              </Button>
              <Button size="small" danger icon={<DeleteOutlined />} onClick={handleDelete}>
                {t('app.delete')}
              </Button>
              <Button size="small" icon={<DownloadOutlined />} onClick={handleDownload}>
                {t('memory.download', '下载')}
              </Button>
            </div>
          )}
          
          <div style={{ flex: 1, overflow: 'auto', padding: 'var(--space-4)' }}>
            {!selectedFile ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={t('memory.select_file', '选择文件以查看内容')}
                style={{ marginTop: 'var(--space-16)' }}
              />
            ) : fileLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <Spin size="large" />
              </div>
            ) : previewMode ? (
              <pre style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-sm)',
                whiteSpace: 'pre-wrap',
                color: 'var(--text-primary)',
                margin: 0,
                lineHeight: 1.6,
              }}>
                {fileContent}
              </pre>
            ) : (
              <Input.TextArea
                value={fileContent}
                onChange={e => setFileContent(e.target.value)}
                style={{
                  width: '100%',
                  height: '100%',
                  minHeight: 400,
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--text-sm)',
                  background: 'transparent',
                  color: 'var(--text-primary)',
                  border: 'none',
                  resize: 'none',
                  outline: 'none',
                  lineHeight: 1.6,
                }}
                spellCheck={false}
              />
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
