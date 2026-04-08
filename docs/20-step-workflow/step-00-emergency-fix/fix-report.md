# Step 0: 紧急修复 - 修复执行报告

## 📋 修复概要
- **修复时间**：2026-04-02 18:35
- **修复内容**：修复前端无限循环导致的页面闪烁问题
- **影响范围**：`frontend/src/hooks/useWorkflow.ts`
- **修复文件数**：1 个文件
- **修改行数**：2 处关键修改

## 🔧 修复详情

### 1. useTemplates Hook 修复

**位置**：`frontend/src/hooks/useWorkflow.ts` 第 14-38 行

**修改前**：
```typescript
export function useTemplates(params?: TemplateListParams) {
  const [data, setData] = useState<PaginatedResponse<WorkflowTemplateListItem> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const fetch = useCallback(async () => {
    // ... API 调用
  }, [params])  // ❌ params 每次都是新对象

  useEffect(() => {
    fetch()
  }, [fetch])

  return { data, loading, error, refetch: fetch }
}
```

**修改后**：
```typescript
export function useTemplates(params?: TemplateListParams) {
  const [data, setData] = useState<PaginatedResponse<WorkflowTemplateListItem> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  // 稳定化 params 对象，避免无限循环
  const paramsKey = JSON.stringify(params)  // ✅ 新增

  const fetch = useCallback(async () => {
    // ... API 调用
  }, [paramsKey])  // ✅ 使用稳定化的 key

  useEffect(() => {
    fetch()
  }, [fetch])

  return { data, loading, error, refetch: fetch }
}
```

### 2. useWorkflowInstances Hook 修复

**位置**：`frontend/src/hooks/useWorkflow.ts` 第 64-88 行

**修改前**：
```typescript
export function useWorkflowInstances(params?: WorkflowListParams) {
  // ... state 定义
  
  const fetch = useCallback(async () => {
    // ... API 调用
  }, [params])  // ❌ 同样的问题

  useEffect(() => {
    fetch()
  }, [fetch])

  return { data, loading, error, refetch: fetch }
}
```

**修改后**：
```typescript
export function useWorkflowInstances(params?: WorkflowListParams) {
  // ... state 定义

  // 稳定化 params 对象，避免无限循环
  const paramsKey = JSON.stringify(params)  // ✅ 新增

  const fetch = useCallback(async () => {
    // ... API 调用
  }, [paramsKey])  // ✅ 使用稳定化的 key

  useEffect(() => {
    fetch()
  }, [fetch])

  return { data, loading, error, refetch: fetch }
}
```

## 🎯 修复原理

### 问题根源
React 的 `useCallback` 依赖比较是浅比较（shallow comparison）。当 params 是一个对象时：
- 每次组件渲染，都会创建一个新的 params 对象（即使内容相同）
- 新对象的引用不同，导致 `useCallback` 认为 params 变化了
- `fetch` 函数被重新创建
- `useEffect` 检测到 `fetch` 变化，重新执行
- 触发 API 调用 → 更新 state → 组件重新渲染 → 循环...

### 解决方案
使用 `JSON.stringify(params)` 将对象转换为字符串：
- 相同内容的对象会生成相同的字符串
- 字符串是基本类型，比较是值比较
- 只有 params 内容真正变化时，才会触发重新请求

## 📊 修复效果对比

### 修复前
- ❌ 页面一直闪烁
- ❌ 网络面板显示大量重复的 API 请求
- ❌ 浏览器控制台可能有性能警告
- ❌ 用户无法正常使用功能

### 修复后（预期）
- ✅ 页面稳定，不再闪烁
- ✅ 只在参数真正变化时发起一次请求
- ✅ 性能正常，无警告
- ✅ 用户可以正常使用功能

## 🔍 后续验证步骤

1. **本地验证**
   ```bash
   cd /root/.openclaw/workspace/project/openclaw-control-plane/frontend
   npm run build
   ```

2. **部署到生产**
   ```bash
   # 构建前端
   npm run build
   
   # 部署到 Nginx 目录
   cp -r dist/* /var/www/control-plane/
   ```

3. **浏览器验证**
   - 访问 http://43.155.138.191:92/workflows
   - 检查页面是否正常显示
   - 打开开发者工具 Network 面板，确认只有一次 API 请求
   - 测试搜索、筛选功能是否正常

4. **性能验证**
   - 页面加载应该流畅，无卡顿
   - CPU 使用率应该正常
   - 无内存泄漏

## 📝 其他注意事项

### 是否影响其他页面？
- ✅ 修复是向后兼容的
- ✅ 不影响其他使用这些 hooks 的页面
- ✅ 其他 hooks（useTemplate、useWorkflowInstance、useWorkflowSteps、usePendingReviews）没有这个问题

### 是否需要数据库迁移？
- ❌ 不需要，这是纯前端修复

### 是否需要后端修改？
- ❌ 不需要，后端工作正常

## 🚀 下一步

1. ⏳ 执行前端构建
2. ⏳ 部署到生产环境
3. ⏳ 执行冒烟测试
4. ⏳ 继续 20 步流程的后续步骤

---
**创建时间**：2026-04-02 18:35
**负责人**：rd-commander
**状态**：修复完成，待构建部署
