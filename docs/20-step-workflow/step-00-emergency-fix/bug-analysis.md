# Step 0: 紧急修复 - Bug 分析报告

## 🐛 Bug 描述
- **现象**：http://43.155.138.191:92/workflows 页面加载不出数据，一直闪烁
- **影响**：用户无法使用工作流模板功能
- **严重性**：P0 - 核心功能不可用

## 🔍 问题诊断

### 1. 环境检查
✅ 后端服务正常运行（uvicorn on port 8000）
✅ Nginx 代理配置正确
✅ API `/api/v1/workflow-templates` 可以正常返回数据
✅ 前端文件已部署到 `/var/www/control-plane/`

### 2. 根因分析

#### 问题代码位置
- **文件**：`frontend/src/hooks/useWorkflow.ts`
- **函数**：`useTemplates`

#### Bug 原理

**Templates.tsx (第29-35行)**：
```typescript
const { data, loading, error, refetch } = useTemplates({
  search,
  status: statusFilter || undefined,
  page,
  page_size: pageSize
})
```

每次组件渲染都会创建新的 params 对象。

**useWorkflow.ts (第20-32行)**：
```typescript
const fetch = useCallback(async () => {
  setLoading(true)
  setError(null)
  try {
    const result = await templatesApi.list(params)
    setData(result)
  } catch (err) {
    setError(err as Error)
  } finally {
    setLoading(false)
  }
}, [params])  // ❌ params 每次都是新对象引用

useEffect(() => {
  fetch()
}, [fetch])  // ❌ fetch 不断变化 → 无限循环
```

#### 无限循环流程
```
组件渲染 
  → 创建新 params 对象 
  → useCallback 重新创建 fetch 
  → useEffect 触发 
  → 调用 fetch() 
  → 更新 state 
  → 组件重新渲染 
  → 循环...
```

## 🎯 修复方案

### 方案 1：稳定化 params 对象（推荐）
在 `useWorkflow.ts` 中使用 `JSON.stringify` 稳定化依赖：

```typescript
export function useTemplates(params?: TemplateListParams) {
  const [data, setData] = useState<PaginatedResponse<WorkflowTemplateListItem> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  // 稳定化 params
  const paramsKey = JSON.stringify(params)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await templatesApi.list(params)
      setData(result)
    } catch (err) {
      setError(err as Error)
    } finally {
      setLoading(false)
    }
  }, [paramsKey])  // ✅ 使用稳定化的 key

  useEffect(() => {
    fetch()
  }, [fetch])

  return { data, loading, error, refetch: fetch }
}
```

### 方案 2：在 Templates.tsx 中使用 useMemo
在组件中稳定化 params：

```typescript
const params = useMemo(() => ({
  search,
  status: statusFilter || undefined,
  page,
  page_size: pageSize
}), [search, statusFilter, page, pageSize])

const { data, loading, error, refetch } = useTemplates(params)
```

## 📋 修复步骤

1. ✅ 诊断问题根因
2. ⏳ 修复 `useWorkflow.ts`
3. ⏳ 重新构建前端
4. ⏳ 部署到生产环境
5. ⏳ 验证修复效果

## 📊 修复后预期
- 页面不再闪烁
- 数据正常加载
- API 请求频率正常（只在参数变化时请求）

---
**创建时间**：2026-04-02
**负责人**：rd-commander
**状态**：进行中
