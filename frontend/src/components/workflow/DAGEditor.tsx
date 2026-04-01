/**
 * DAG 编辑器组件 (使用 React Flow)
 * 
 * 注意: 此文件是基础框架,需要安装 reactflow 依赖
 * 安装命令: npm install reactflow
 */

import React, { useState, useCallback } from 'react'
// import ReactFlow, { 
//   addEdge, 
//   Background, 
//   Controls, 
//   MiniMap, 
//   Node, 
//   Edge, 
//   Connection,
//   OnNodesChange,
//   OnEdgesChange,
//   applyNodeChanges,
//   applyEdgeChanges
// } from 'reactflow'
// import 'reactflow/dist/style.css'
import { DAG, DAGStep } from '../../types/workflow'

export interface DAGEditorProps {
  dag?: DAG
  onChange?: (dag: DAG) => void
  readOnly?: boolean
  className?: string
}

/**
 * DAG 编辑器组件
 * 
 * 当前为基础实现,提供 DAG 编辑能力
 * 后续可集成 React Flow 提供更好的交互体验
 */
export const DAGEditor: React.FC<DAGEditorProps> = ({
  dag: initialDag = { steps: [], edges: [] },
  onChange,
  readOnly = false,
  className = ''
}) => {
  const [dag, setDag] = useState<DAG>(initialDag)
  const [selectedStep, setSelectedStep] = useState<string | null>(null)
  const [editingStep, setEditingStep] = useState<DAGStep | null>(null)

  // 添加步骤
  const handleAddStep = useCallback(() => {
    const newStep: DAGStep = {
      id: `step-${Date.now()}`,
      name: '新步骤',
      agent: 'agent-001',
      depends_on: []
    }

    const newDag = {
      ...dag,
      steps: [...dag.steps, newStep]
    }

    setDag(newDag)
    onChange?.(newDag)
    setEditingStep(newStep)
  }, [dag, onChange])

  // 更新步骤
  const handleUpdateStep = useCallback((updatedStep: DAGStep) => {
    const newDag = {
      ...dag,
      steps: dag.steps.map(s => s.id === updatedStep.id ? updatedStep : s)
    }

    setDag(newDag)
    onChange?.(newDag)
    setEditingStep(null)
  }, [dag, onChange])

  // 删除步骤
  const handleDeleteStep = useCallback((stepId: string) => {
    const newDag = {
      steps: dag.steps.filter(s => s.id !== stepId),
      edges: dag.edges.filter(e => e.source !== stepId && e.target !== stepId)
    }

    setDag(newDag)
    onChange?.(newDag)
  }, [dag, onChange])

  // 添加边
  const handleAddEdge = useCallback((source: string, target: string) => {
    // 检查是否已存在
    if (dag.edges.some(e => e.source === source && e.target === target)) {
      return
    }

    // 检查是否会形成循环
    const wouldCreateCycle = (from: string, to: string): boolean => {
      if (from === to) return true
      const outgoingEdges = dag.edges.filter(e => e.source === to)
      return outgoingEdges.some(e => wouldCreateCycle(from, e.target))
    }

    if (wouldCreateCycle(source, target)) {
      alert('不能添加会形成循环的边')
      return
    }

    const newDag = {
      ...dag,
      edges: [...dag.edges, { source, target }]
    }

    // 更新目标步骤的 depends_on
    const targetStep = dag.steps.find(s => s.id === target)
    if (targetStep) {
      newDag.steps = dag.steps.map(s => 
        s.id === target 
          ? { ...s, depends_on: [...s.depends_on, source] }
          : s
      )
    }

    setDag(newDag)
    onChange?.(newDag)
  }, [dag, onChange])

  // 删除边
  const handleDeleteEdge = useCallback((source: string, target: string) => {
    const newDag = {
      ...dag,
      edges: dag.edges.filter(e => !(e.source === source && e.target === target))
    }

    // 更新目标步骤的 depends_on
    const targetStep = dag.steps.find(s => s.id === target)
    if (targetStep) {
      newDag.steps = dag.steps.map(s => 
        s.id === target 
          ? { ...s, depends_on: s.depends_on.filter(d => d !== source) }
          : s
      )
    }

    setDag(newDag)
    onChange?.(newDag)
  }, [dag, onChange])

  return (
    <div className={`dag-editor ${className}`}>
      <div className="flex gap-4">
        {/* 步骤列表 */}
        <div className="flex-1 border rounded-lg p-4 bg-white">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">步骤列表</h3>
            {!readOnly && (
              <button
                onClick={handleAddStep}
                className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
              >
                添加步骤
              </button>
            )}
          </div>

          <div className="space-y-2">
            {dag.steps.map(step => (
              <div
                key={step.id}
                className={`border rounded p-3 cursor-pointer ${
                  selectedStep === step.id ? 'border-blue-500 bg-blue-50' : 'hover:border-gray-400'
                }`}
                onClick={() => setSelectedStep(step.id)}
              >
                <div className="font-semibold">{step.name}</div>
                <div className="text-sm text-gray-600">Agent: {step.agent}</div>
                {step.human_review && (
                  <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded">
                    需审核
                  </span>
                )}
              </div>
            ))}

            {dag.steps.length === 0 && (
              <div className="text-center text-gray-400 py-8">
                暂无步骤，点击上方按钮添加
              </div>
            )}
          </div>
        </div>

        {/* 边列表 */}
        <div className="flex-1 border rounded-lg p-4 bg-white">
          <h3 className="font-semibold mb-4">依赖关系</h3>
          
          <div className="space-y-2">
            {dag.edges.map((edge, idx) => {
              const sourceStep = dag.steps.find(s => s.id === edge.source)
              const targetStep = dag.steps.find(s => s.id === edge.target)

              return (
                <div key={idx} className="flex items-center gap-2 border rounded p-2">
                  <span className="font-semibold">{sourceStep?.name || edge.source}</span>
                  <span>→</span>
                  <span className="font-semibold">{targetStep?.name || edge.target}</span>
                  {!readOnly && (
                    <button
                      onClick={() => handleDeleteEdge(edge.source, edge.target)}
                      className="ml-auto text-red-500 hover:text-red-700"
                    >
                      删除
                    </button>
                  )}
                </div>
              )
            })}

            {dag.edges.length === 0 && (
              <div className="text-center text-gray-400 py-8">
                暂无依赖关系
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 步骤编辑表单 */}
      {editingStep && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="font-semibold text-lg mb-4">编辑步骤</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">步骤名称</label>
                <input
                  type="text"
                  value={editingStep.name}
                  onChange={(e) => setEditingStep({ ...editingStep, name: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Agent</label>
                <input
                  type="text"
                  value={editingStep.agent}
                  onChange={(e) => setEditingStep({ ...editingStep, agent: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">预估时长（分钟）</label>
                <input
                  type="number"
                  value={editingStep.estimated_duration || ''}
                  onChange={(e) => setEditingStep({ 
                    ...editingStep, 
                    estimated_duration: parseInt(e.target.value) || undefined 
                  })}
                  className="w-full border rounded px-3 py-2"
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={editingStep.human_review || false}
                  onChange={(e) => setEditingStep({ ...editingStep, human_review: e.target.checked })}
                  className="mr-2"
                />
                <label className="text-sm font-medium">需要人工审核</label>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setEditingStep(null)}
                className="flex-1 px-4 py-2 border rounded hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={() => handleUpdateStep(editingStep)}
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * TODO: 集成 React Flow 版本
 * 
 * 安装依赖: npm install reactflow
 * 
 * 使用示例:
 * import ReactFlow, { addEdge, Background, Controls } from 'reactflow'
 * import 'reactflow/dist/style.css'
 * 
 * const [nodes, setNodes] = useState<Node[]>([])
 * const [edges, setEdges] = useState<Edge[]>([])
 * 
 * const onNodesChange: OnNodesChange = useCallback(
 *   (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
 *   []
 * )
 * 
 * const onEdgesChange: OnEdgesChange = useCallback(
 *   (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
 *   []
 * )
 * 
 * const onConnect = useCallback(
 *   (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
 *   []
 * )
 * 
 * <ReactFlow
 *   nodes={nodes}
 *   edges={edges}
 *   onNodesChange={onNodesChange}
 *   onEdgesChange={onEdgesChange}
 *   onConnect={onConnect}
 * >
 *   <Background />
 *   <Controls />
 * </ReactFlow>
 */
