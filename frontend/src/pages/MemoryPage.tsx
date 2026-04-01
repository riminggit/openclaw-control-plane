import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Input, Select, Card, Popconfirm } from 'antd'


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
    setLoading(true)
    fetch(`${API}/file?path=${encodeURIComponent(filePath)}`)
      .then(r => r.ok ? r.json() : Promise.resolve(null))
      .then(data => { const text = data?.content ?? ''; setFileContent(text); setOriginalContent(text) })
      .catch(() => { setFileContent(''); setOriginalContent('') })
      .finally(() => setLoading(false))
  }, [filePath])

  const handleSave = async () => {
    if (!filePath) return
    setSaving(true)
    try {
      await fetch(`${API}/file`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: filePath, content: fileContent }) })
      setOriginalContent(fileContent)
    } catch { /* ignore */ }
    setSaving(false)
  }

  const handleDelete = async () => {
    if (!filePath) return
    if (!confirm(t('memory.confirm_delete', '确定要删除此文件吗？'))) return
    try {
      await fetch(`${API}/file`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: filePath }) })
      setSelectedFile(null); setFileContent(''); setOriginalContent('')
      fetchTree(selectedAgent)
    } catch { /* ignore */ }
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
    } catch { /* ignore */ }
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
      }
    } catch { /* ignore */ }
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
        style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: '4px 8px', cursor: 'pointer', paddingLeft: 8 + depth * 16, borderRadius: 'var(--radius-sm)', background: selectedFile === node.path ? 'var(--accent-muted)' : 'transparent' }}
        onClick={() => node.type === 'file' && setSelectedFile(node.path)}
      >
        <span style={{ fontSize: 'var(--text-xs)' }}>{node.type === 'folder' ? '📁' : '📄'}</span>
        <span style={{ fontSize: 'var(--text-sm)', color: node.type === 'file' ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: node.type === 'folder' ? 500 : 400 }}>{node.name}</span>
      </div>
      {node.children && renderTree(node.children, depth + 1)}
    </div>
  ))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
        <div>
          <p className="eyebrow">{t('memory.eyebrow', '记忆浏览器')}</p>
          <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 600 }}>{t('memory.title', 'Memory 浏览器')}</h1>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
          <Select value={selectedAgent} onChange={e => { setSelectedAgent(e); setSelectedFile(null) }} style={{ padding: 'var(--space-2) var(--space-3)', background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)' }}>
            {agents.map(a => <Select.Option key={a} value={a}>{a}</Select.Option>)}
          </Select>
          <Button onClick={handleExportZip} style={{ fontSize: 'var(--text-xs)' }}>{t('memory.export_zip', '导出 ZIP')}</Button>
        </div>
      </div>

      {/* Search */}
      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
        <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} placeholder={t('memory.search_placeholder', '搜索文件内容...')} style={{ flex: 1 }} />
        <Button onClick={handleSearch}>{t('app.search')}</Button>
      </div>
      {searchResults.length > 0 && (
        <div style={{ maxHeight: 150, overflow: 'auto', background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', padding: 'var(--space-2)' }}>
          {searchResults.map((r, i) => (
            <div key={i} style={{ fontSize: 'var(--text-xs)', cursor: 'pointer', padding: '2px 4px' }} onClick={() => { setSelectedFile(r.path); setSearchResults([]) }}>
              <span style={{ color: 'var(--text-muted)' }}>{r.path}:{r.line}</span> — {r.text}
            </div>
          ))}
        </div>
      )}

      {/* Main Layout */}
      <div style={{ display: 'flex', gap: 'var(--space-4)', minHeight: 400 }}>
        {/* File Tree */}
        <div className="card" style={{ width: 260, minWidth: 200, overflow: 'auto', padding: 'var(--space-2)' }}>
          {renderTree(fileTree)}
          {fileTree.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', padding: 'var(--space-2)' }}>{t('memory.no_files', '暂无文件')}</p>}
        </div>

        {/* Editor */}
        <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Toolbar */}
          {selectedFile && (
            <div style={{ display: 'flex', gap: 'var(--space-2)', padding: 'var(--space-2) var(--space-3)', borderBottom: '1px solid var(--border-default)', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500, flex: 1 }}>{selectedFile}</span>
              <span className={`badge ${hasChanges ? 'badge-yellow' : 'badge-green'}`} style={{ fontSize: 'var(--text-xs)' }}>
                {hasChanges ? t('services.unsaved', '未保存') : t('services.saved', '已保存')}
              </span>
              <Button onClick={() => setPreviewMode(!previewMode)} style={{ fontSize: 'var(--text-xs)' }}>
                {previewMode ? t('memory.edit_mode', '编辑') : t('memory.preview_mode', '预览')}
              </Button>
              <Button type="primary" onClick={handleSave} disabled={!hasChanges || saving} style={{ fontSize: 'var(--text-xs)' }}>{t('app.save')}</Button>
              <Button onClick={handleNewFile} style={{ fontSize: 'var(--text-xs)' }}>{t('memory.new_file', '新建')}</Button>
              <Button danger onClick={handleDelete} style={{ fontSize: 'var(--text-xs)' }}>{t('app.delete')}</Button>
              <Button onClick={handleDownload} style={{ fontSize: 'var(--text-xs)' }}>{t('memory.download', '下载')}</Button>
            </div>
          )}
          <div style={{ flex: 1, overflow: 'auto', padding: 'var(--space-3)' }}>
            {!selectedFile ? (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: 'var(--space-8)' }}>{t('memory.select_file', '选择文件以查看内容')}</p>
            ) : previewMode ? (
              <pre style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', whiteSpace: 'pre-wrap', color: 'var(--text-primary)' }}>{fileContent}</pre>
            ) : (
              <Input.TextArea
                value={fileContent}
                onChange={e => setFileContent(e.target.value)}
                style={{ width: '100%', height: '100%', minHeight: 350, fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', background: 'transparent', color: 'var(--text-primary)', border: 'none', resize: 'none', outline: 'none' }}
                spellCheck={false}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
