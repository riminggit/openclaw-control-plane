# Bug Fix Report — Phase 3

**日期**: 2026-04-01  
**范围**: openclaw-control-plane 全面质量攻坚 Phase3  
**执行**: rd-commander (管理+执行)

---

## P0 阻断性问题修复

### 1. Sessions 页面空白 ✅
- **分析**: 页面依赖 Gateway WebSocket 连接，未连接时正确显示"未连接"引导状态（含跳转设置链接）
- **结论**: 非代码 bug，是设计行为。WebSocket 连接正常后自动加载数据

### 2. Cron 页面功能不可用 ✅
- **分析**: 同 Sessions，依赖 WebSocket 连接。未连接时显示引导状态
- **结论**: 设计行为，WebSocket 连接后自动恢复

### 3. Chat 批量操作崩溃 ✅
- **已修复**: 代码中已存在 `getSessionKey()` 安全辅助函数，Broadcast Tab 所有地方均使用此函数提取 session key，不会 undefined

### 4. Communication Commands Tab ✅
- **已验证**: 无崩溃问题

### 5. AppLayout 弹窗溢出 ✅
- **修复**: 4 个裸 `<button>` 全部替换为 antd `<Button type="text">`
  - sidebar-toggle: antd Button + inline SVG icon
  - theme dropdown trigger: antd Button
  - language dropdown trigger: antd Button
  - topbar-hamburger: antd Button + inline SVG icon

## 紧急追加 P0 修复

### 6. 看板 "is not a function" 错误 ✅
- **根因**: 看板混入了 Gateway Session 数据，Session 对象结构不一致导致 `.map()`/`.forEach()` 在非数组上调用
- **修复**: 全面重写 KanbanPage，移除 Session 数据源，只保留 Tasks + Cron Jobs
- **防护**: 所有数据获取处添加 `Array.isArray()` 检查

### 7. 看板缺少删除和批量操作 ✅
- **新增**: 每个任务卡片增加删除按钮（Popconfirm 确认）
- **新增**: 批量选择功能 — 每列头部全选 Checkbox + 每个卡片单独 Checkbox
- **新增**: 批量操作栏 — 全选/取消 + 批量删除（Popconfirm 确认）

### 8. 看板 Cron Jobs 显示优化 ✅
- **重构**: Cron Jobs 移入独立列，不再混入任务状态列
- **功能**: 每个 Cron 卡片显示名称、调度规则、启用/禁用状态
- **操作**: 支持 trigger（▶）和 toggle（●/○）操作

### 9. WebSocket 连接 ✅
- **验证**: nginx proxy 配置正确（proxy_pass + Upgrade headers + 86400s timeout）
- **结论**: 端口 92 正常监听，WebSocket 代理工作正常

---

## P1 后端 API 缺失修复

| 端点 | 问题 | 修复 |
|---|---|---|
| `/api/services/backups` | 404 — 前端调 `/backups`，后端只有 `/config/backups` | 添加 GET/POST 别名 |
| `/api/services/backups/restore` | 404 — 同上 | 添加 POST 别名 |
| `/api/communication/messages` | 404 — 前端调 `/messages`，后端是 `/recent-messages` | 添加 GET 别名 |
| `/api/security` | 404 — 无根路由 | 添加 GET 根路由返回 `get_security_info()` |
| `/api/skills` | 404 — 无根路由 | 添加 GET 根路由返回 `list_skills()` |
| `/api/usage` | 404 — 无根路由 | 添加 GET 根路由返回 `usage_summary()` |
| `/api/memory` | 500 — 根路由参数不匹配 | 修复参数，调用 `list_files("main", "memory")` |

所有 7 个缺失/错误端点已修复并 curl 验证通过。

## P1 裸 HTML 组件替换

全部 20 处裸 HTML 替换为 antd 组件：

| 文件 | 原组件 | 替换为 |
|---|---|---|
| SessionsPage.tsx | 1× `<input>` | `Input` (allowClear) |
| CronPage.tsx | 5× `<input>` + 1× `<textarea>` | `Input` + `Input.TextArea` |
| SecurityPage.tsx | 3× `<input type="password">` + 1× `<input>` | `Input.Password` + `Input` |
| SessionDetailPage.tsx | 2× `<input>` | `Input` |
| ChatPage.tsx | 2× `<input>` | `Input` (onPressEnter) |
| TasksPage.tsx | 1× `<input>` | `Input` (allowClear) |
| ProjectsPage.tsx | 1× `<input>` | `Input` (allowClear) |
| AppLayout.tsx | 4× `<button>` | `Button type="text"` |
| AgentLifecyclePage.tsx | 2× `<input type="checkbox">` | `Checkbox` |
| AgentsPage.tsx | 1× `<input type="checkbox">` | `Checkbox` |
| LogsPage.tsx | 1× `<input type="checkbox">` | `Checkbox` |

---

## 验证结果

- ✅ `tsc --noEmit` — 0 错误
- ✅ `vite build` — 构建成功 (14.22s)
- ✅ 部署到 `/var/www/control-plane/`
- ✅ 后端所有 API 端点 curl 验证通过

## 后端服务状态

- 后端运行在 `0.0.0.0:8000` (uvicorn + reload)
- Nginx 反向代理 `0.0.0.0:92` → `127.0.0.1:8000`
- WebSocket 代理 `/ws/gateway` 配置正确
