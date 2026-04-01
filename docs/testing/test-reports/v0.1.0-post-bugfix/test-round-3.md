# Test Report Round 3 — 集成与回归验证

**测试人**: rd-commander  
**日期**: 2026-04-01  
**测试类型**: 全链路集成验证 + 回归检查  

---

## TC-R3-001: 后端全部API端点可达性
- **测试步骤**: 对所有已注册路由执行 GET 请求
- **实际结果**:
  - `/api/health` → 200 `{"status":"ok"}` ✅
  - `/api/agents-mgmt/list` → 200 42 agents ✅
  - `/api/skills/installed` → 200 ✅
  - `/api/skills/list` → 200 ✅
  - `/api/memory/tree` → 200 ✅
  - `/api/memory/files` → 200 ✅
  - `/api/memory/agents` → 200 `["main"]` ✅
  - `/api/channels/list` → 200 ✅
  - `/api/channels/status` → 200 ✅
  - `/api/usage/summary` → 200 ✅
  - `/api/usage/sessions` → 200 ✅
  - `/api/usage/by-model` → 200 ✅
  - `/api/analytics/cost/summary` → 200 ✅
  - `/api/analytics/cost/trend` → 200 ✅
  - `/api/analytics/cost/by-agent` → 200 ✅
  - `/api/analytics/cost/budget` → 200 ✅
  - `/api/tasks` → 200 ✅
  - `/api/projects` → 200 ✅
- **预期结果**: 全部 200
- **状态**: ✅ PASS

## TC-R3-002: 前端编译无错误无警告
- **测试步骤**: `cd frontend && npx tsc --noEmit 2>&1`
- **实际结果**: 无输出，退出码 0
- **预期结果**: 零错误零警告
- **状态**: ✅ PASS

## TC-R3-003: 无未定义CSS变量引用
- **测试步骤**: `grep -rn 'var(--border)\b\|var(--card-bg)\|var(--info)\|var(--success)\|var(--danger)\|var(--warning)\b' frontend/src/ --include='*.tsx' --include='*.ts'`
- **实际结果**: 0 匹配
- **预期结果**: 0 匹配（之前的无效变量已全部替换）
- **状态**: ✅ PASS

## TC-R3-004: .form-input 类被正确定义
- **测试步骤**: `grep -c 'form-input' frontend/src/styles.css`
- **实际结果**: 7 处（.form-input 定义 + textarea.form-input + placeholder + :focus）
- **预期结果**: ≥ 1（类已定义）
- **状态**: ✅ PASS

## TC-R3-005: 无裸 input/select 未被覆盖
- **测试步骤**: `grep -rn '<input' frontend/src/pages/ --include='*.tsx' | grep -v 'antd\|type=\|className=' | grep -v form-input`
- **实际结果**: 
  - `AnalyticsPage.tsx`: 无裸 input（已替换为 antd Input/InputNumber）✅
  - `MemoryPage.tsx`: 无裸 input（搜索用裸 input 但有 inline style + 已有 .form-input 类可用）
  - `SkillsPage.tsx`: 搜索输入仍为裸 `<input>` 带 inline style
- **预期结果**: 所有裸 input 有样式（通过 .form-input 或 inline style）
- **状态**: ⚠️ PARTIAL — SkillsPage/MemoryPage 的搜索 input 仍为裸 input，但有 inline style 兜底，不阻塞

## TC-R3-006: antd Dropdown 替换完整性
- **测试步骤**: `grep -c 'themeOpen\|langOpen\|mousedown' frontend/src/layouts/AppLayout.tsx`
- **实际结果**: 0 匹配
- **预期结果**: 0（手写 dropdown 代码已完全移除）
- **状态**: ✅ PASS

## TC-R3-007: TaskForm projectsApi 调用
- **测试步骤**: `curl -s http://localhost:8000/api/projects`
- **实际结果**: `{"items":[{"id":"proj-ocp-001","code":"OCP",...}], "total":1}`
- **预期结果**: TaskForm 的 `projectsApi.list()` 返回 `{items: ProjectItem[]}`，Select 可正确渲染选项
- **状态**: ✅ PASS

---

## 汇总
| 总用例 | PASS | PARTIAL | FAIL | 跳过 | 未执行 |
|--------|------|---------|------|------|--------|
| 7 | 6 | 1 | 0 | 0 | 0 |

## 遗留项
1. **TC-R3-005 PARTIAL**: SkillsPage 和 MemoryPage 搜索 input 仍为裸 HTML input，有 inline style 但未替换为 antd Input。不影响功能，属于样式增强项。
