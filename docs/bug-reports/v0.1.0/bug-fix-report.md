# Bug 修复报告 — openclaw-control-plane

**日期**: 2026-04-01  
**执行者**: rd-commander  
**版本**: 0.2.0

---

## 修复总览

| # | Bug | 严重级别 | 状态 | 修改文件 |
|---|-----|---------|------|---------|
| 1 | Skills 页面崩溃 `n.map is not a function` | P0 | ✅ 已修复 | `SkillsPage.tsx`, `backend/api/skills.py` |
| 2 | Agent 面板不获取真实 agent | P0 | ✅ 已修复 | `api/modules/agentsMgmt.ts` |
| 3 | 记忆文件获取不到 | P0 | ✅ 已修复 | `MemoryPage.tsx`, `backend/api/memory.py` |
| 4 | input/select 样式问题 | P1 | ✅ 已修复 | `styles.css` |
| 5 | 渠道管理样式和功能问题 | P1 | ✅ 已修复 | `api/modules/channels.ts` |
| 6 | 成本分析样式和国际化问题 | P1 | ✅ 已修复 | `UsagePage.tsx` |

---

## 详细修复

### Bug 1: Skills 页面崩溃 (`n.map is not a function`)

**根因**: 后端 `GET /api/skills/installed` 返回 `{"skills": [...]}`，但前端直接 `setInstalled(await res.json())`，将对象赋值给数组状态变量，导致 `.map()` 调用崩溃。

**修复**:
- `SkillsPage.tsx`: 添加响应解包逻辑，从 `data.skills` 提取数组
- `SkillsPage.tsx`: 修复 uninstall/update API 路径（后端使用 path parameter `{name}`，前端原来发送 JSON body）

### Bug 2: Agent 面板不获取真实 agent

**根因**: `agentsMgmtApi.list()` 的 `apiGet<Agent[]>` 直接返回后端响应，但后端返回 `{"agents": [...], "total": N}`。`Array.isArray({...})` 为 false，导致 `setAgents([])` 始终为空。

**修复**: `agentsMgmt.ts` — `.list()` 添加 `.then(d => d.agents)` 解包。

### Bug 3: 记忆文件获取不到

**根因**: 
1. 前端调用 `/api/memory/tree` 和 `/api/memory/agents`，但后端没有这两个端点
2. 文件读取后端返回 JSON `{"content": ...}`，但前端用 `r.text()` 读取
3. 文件删除前端发 JSON body，后端用 query param 接收

**修复**:
- `backend/api/memory.py`: 新增 `/tree` 和 `/agents` 端点
- `MemoryPage.tsx`: 文件读取改用 `r.json()` 并提取 `.content`
- `backend/api/memory.py`: 删除端点改用 JSON body 接收参数

### Bug 4: input/select 样式问题

**根因**: 多个页面使用 `className="input"` 但 CSS 中未定义 `.input` 类。

**修复**: `styles.css` 新增:
- `.input` / `.input-field` 通用输入样式（含 focus 状态）
- `select.input` 自定义下拉箭头
- `textarea.input` 可调整大小
- `.card-grid` / `.skeleton-grid` / `.skeleton-card`
- `.page-container` / `.page-eyebrow` / `.page-title` / `.page-subtitle`
- `.badge-green/red/yellow/gray/blue` 徽章变体
- `.eyebrow` 通用眉文样式

### Bug 5: 渠道管理样式和功能问题

**根因**: 与 Bug 2 相同 — `channelsApi.list()` 和 `.status()` 期望数组，但后端返回 `{"channels": [...]}`。

**修复**: `channels.ts` — `.list()` 和 `.status()` 添加 `.then(d => d.channels)` 解包。

### Bug 6: 成本分析样式和国际化问题

**根因**: 
1. 前端用 `?range=7d` 参数，后端期望 `?days=7`
2. API 路径不匹配：前端 `/top-sessions` → 后端 `/sessions`；前端 `/models` → 后端 `/by-model`
3. 响应字段名不匹配：前端用 `totalTokens` → 后端 `total_tokens`

**修复**: 完整重写 `UsagePage.tsx`，对齐后端 API 参数和响应字段。

---

## 编译验证

- ✅ TypeScript 编译通过 (`tsc --noEmit` 退出码 0)
- ✅ Vite 生产构建成功
- ✅ 无新增类型错误

---

## 遗留事项

1. **组件库引入**: 当前使用自定义 CSS 实现表单控件，功能完备但交互细节（如多选、日期选择器、自动补全）尚需增强。建议后续评估引入 Ant Design 或 MUI。
2. **Skills 搜索结果解析**: 后端 `clawhub search` 返回的是原始文本，前端需要解析为结构化数据。
3. **Agent 状态**: 后端 Agent 状态目前无实时更新机制，`online/offline` 状态为静态配置。
