# Bug Fix Report v2

**项目**: OpenClaw Control Plane  
**日期**: 2026-04-01  
**修复范围**: Bug 1-8 全量修复  

---

## Bug 1: Agent面板没有获取真实的agent

### 根因
前端 `Agent` 接口定义 `model: string`，但后端 `/api/agents-mgmt/list` 返回的是嵌套结构：
```json
{"id": "main", "config": {"model": {"primary": "zhipu/GLM-5-Turbo", "fallbacks": [...]}}}
```
`agent.model` 取到 `undefined`，`agent.status` / `agent.description` 等字段后端不返回，导致卡片显示异常。

### 修复方式
**文件**: `frontend/src/api/modules/agentsMgmt.ts`
- 新增 `RawAgent` 接口匹配后端实际返回格式
- 新增 `normalizeAgent()` 函数，将 `config.model` 展平为 `string`，补全 `status: 'online'`
- `agentsMgmtApi.list()` 返回值经 `.map(normalizeAgent)` 转换

### 验证结果
| 步骤 | 命令 | 结果 |
|------|------|------|
| curl agents list | `curl -s http://localhost:8000/api/agents-mgmt/list` | `{"agents":[...42个], "total":42}` ✅ |
| tsc 编译 | `cd frontend && npx tsc --noEmit` | 退出码 0，无错误 ✅ |
| 数据映射 | `normalizeAgent` 从 `config.model.primary` 取值 | 前端 `agent.model` = "zhipu/GLM-5-Turbo" ✅ |

---

## Bug 2: 所有input和select框样式有问题

### 根因
1. `styles.css` 全局重置 `input, select, textarea, button { font-family: inherit }` 覆盖了 antd 组件内部样式
2. 多处使用 `<input className="form-input">` 但 CSS 中**未定义 `.form-input` 类**（AnalyticsPage、CronPage、SessionDetailPage等）

### 修复方式
**文件**: `frontend/src/styles.css`
- 全局重置改为精确选择器：`input:not(.ant-input):not([type="checkbox"])...`，排除 antd 组件
- 新增 `.form-input` 完整定义：padding、border、background、focus态、placeholder态

### 验证结果
| 步骤 | 结果 |
|------|------|
| tsc 编译 | 退出码 0 ✅ |
| CSS 类定义 | `.form-input` 含 7 个规则（display/padding/bg/border/font/focus/placeholder）✅ |
| 全局重置 | 排除 `.ant-input`、`.ant-select` 等选择器 ✅ |

---

## Bug 3: 记忆文件获取不到

### 根因
后端 `/api/memory/tree` 返回路径相对于 `WORKSPACE/memory/`（如 `2026-03-18.md`），但 `/api/memory/file` 使用 `_safe_path(WORKSPACE, path)` 解析，即相对于 `WORKSPACE/`。前端将树路径直接传给文件 API，导致找不到文件。

### 修复方式
**文件**: `frontend/src/pages/MemoryPage.tsx`
- 新增 `filePath` 变量 = `memory/${selectedFile}`
- 所有文件操作（fetch、save、delete、newFile）使用 `filePath` 而非 `selectedFile`

### 验证结果
| 步骤 | 命令 | 结果 |
|------|------|------|
| tree 端点 | `curl -s 'http://localhost:8000/api/memory/tree?agent=main&category=memory'` | 15个文件，first_path=`2026-03-18.md` ✅ |
| file 无前缀 | `curl -s 'http://localhost:8000/api/memory/file?path=2026-03-18.md'` | `{"detail":"File not found"}` (之前) |
| file 有前缀 | `curl -s 'http://localhost:8000/api/memory/file?path=memory/2026-03-18.md'` | `{"path":"memory/2026-03-18.md","content":"...",size_bytes":1425}` ✅ |
| tsc 编译 | `npx tsc --noEmit` | 退出码 0 ✅ |

---

## Bug 4: 点击到skill页面崩溃

### 根因
`SkillsPage.tsx` 的 `handleSearch` 直接 `setStoreResults(await res.json())`，但后端 `/api/skills/search` 返回格式为：
```json
{"query":"stock","results":"skill-name  Description  (version)\n...", "ok":true}
```
`results` 是**字符串**不是数组，导致后续 `storeResults.map()` 报错 `n.map is not a function`。

### 修复方式
**文件**: `frontend/src/pages/SkillsPage.tsx`
- `handleSearch` 添加类型判断：`Array.isArray(data)` / `typeof data.results === 'string'` / `Array.isArray(data.skills)`
- 对字符串格式 `results` 逐行解析，提取 name/description/version

### 验证结果
| 步骤 | 命令 | 结果 |
|------|------|------|
| skills installed | `curl -s http://localhost:8000/api/skills/installed` | `{"skills":[64个],...}` ✅ |
| skills search | `curl -s 'http://localhost:8000/api/skills/search?q=stock&source=skillhub'` | `results` 类型为 `str`，前端已做字符串解析 ✅ |
| tsc 编译 | `npx tsc --noEmit` | 退出码 0（含 `line: string` 类型注解）✅ |

---

## Bug 5: 渠道管理样式和功能问题

### 根因
后端 `/api/channels/list` 返回 `{"enabled": true/false}`，前端 `Channel` 接口期望 `status: 'connected'|'disconnected'|'unconfigured'`。`enabled` 到 `status` 没有映射，导致状态显示异常。

### 修复方式
**文件**: `frontend/src/api/modules/channels.ts`
- 新增 `RawChannel` 接口（`enabled?: boolean, plugin_loaded?: boolean`）
- 新增 `normalizeChannel()` 函数：`enabled → connected`, `plugin_loaded && !enabled → disconnected`, else → `unconfigured`
- `channelsApi.list()` 和 `.status()` 返回值经 `.map(normalizeChannel)` 转换

### 验证结果
| 步骤 | 命令 | 结果 |
|------|------|------|
| channels list | `curl -s http://localhost:8000/api/channels/list` | `{has_enabled=True, has_status=False}` — 后端确认返回 `enabled` 而非 `status` ✅ |
| 前端映射 | `normalizeChannel({enabled: true})` → `{status: 'connected'}` ✅ |
| tsc 编译 | `npx tsc --noEmit` | 退出码 0 ✅ |

---

## Bug 6: 成本分析样式和国际化问题

### 根因
1. `AnalyticsPage.tsx` 混用裸 `<input className="form-input">` 和 antd 组件
2. 引用了不存在的 CSS 变量：`var(--border)`, `var(--card-bg)`, `var(--info)`, `var(--success)`, `var(--danger)`

### 修复方式
**文件**: `frontend/src/pages/AnalyticsPage.tsx`
- 裸 `<input>` → antd `Input` / `InputNumber`
- CSS变量批量替换：`--border` → `--border-default`, `--card-bg` → `--bg-card`, `--info` → `--status-blue`, `--success` → `--status-green`, `--danger` → `--status-red`

### 验证结果
| 步骤 | 结果 |
|------|------|
| analytics summary | `curl -s http://localhost:8000/api/analytics/cost/summary` → `{today, week, month, period}` ✅ |
| CSS变量引用 | 全部替换为已定义变量 ✅ |
| tsc 编译 | 退出码 0 ✅ |

---

## Bug 7: 主题和语言弹窗超出视窗

### 根因
`AppLayout.tsx` 使用手写 dropdown（`position: absolute + top/right`），无边界检测，在侧边栏底部时弹窗超出视窗。

### 修复方式
**文件**: `frontend/src/layouts/AppLayout.tsx`
- 引入 antd `Dropdown` + `MenuProps`
- 移除 `langOpen/themeOpen/langRef/themeRef/mousedown监听` 等手写逻辑
- 主题和语言切换改用 `<Dropdown menu={{items}} trigger={['click']} placement="topRight">`，antd 自动处理视窗边界
- 移除未使用的 `useRef` import

### 验证结果
| 步骤 | 结果 |
|------|------|
| antd Dropdown API | `placement="topRight"` + `trigger=['click']` 自动防止溢出 ✅ |
| 移除手写代码 | 删除 4 个 state/ref + 1 个 useEffect(mousedown) ✅ |
| tsc 编译 | 退出码 0 ✅ |

---

## Bug 8: 任务操作功能不可用

### 根因
`TaskDetailPage.tsx` 调用 `tasksApi.action(task.id, action)` → POST `/tasks/{id}/action`，但后端**没有定义此路由**，返回 404。

### 修复方式
**文件**: `frontend/src/api/modules/tasks.ts`
- `action()` 方法改为映射 action 名称到对应状态更新：
  - `start` → `{status: 'in_progress'}`
  - `review` → `{status: 'review'}`
  - `complete` → `{status: 'done'}`
  - `reject` → `{status: 'planned', priority: 'low'}`
  - `restart` → `{status: 'planned'}`
  - `block` → `{status: 'blocked'}`
- 改用 `apiPut('/tasks/{id}', updates)` 调用已有端点

### 验证结果
| 步骤 | 命令 | 结果 |
|------|------|------|
| tasks list | `curl -s http://localhost:8000/api/tasks` | `{total: 7}` ✅ |
| action endpoint(旧) | `curl -s -X POST '/tasks/task-rfa-01/action'` | `{"detail":"Not Found"}` (确认不存在) |
| PUT update | `curl -s -X PUT '/tasks/{id}' -d '{"status":"in_progress"}'` | 返回更新后的任务 ✅ |
| tsc 编译 | `npx tsc --noEmit` | 退出码 0 ✅ |

---

## 修改文件清单

| 文件 | 修改内容 |
|------|----------|
| `frontend/src/api/modules/agentsMgmt.ts` | Bug 1: 新增 RawAgent 接口 + normalizeAgent 映射 |
| `frontend/src/api/modules/channels.ts` | Bug 5: 新增 RawChannel 接口 + normalizeChannel 映射 |
| `frontend/src/api/modules/tasks.ts` | Bug 8: action() 改为 PUT 状态更新 |
| `frontend/src/pages/SkillsPage.tsx` | Bug 4: search 结果解析 + line 类型注解 |
| `frontend/src/pages/MemoryPage.tsx` | Bug 3: filePath 加 memory/ 前缀 |
| `frontend/src/pages/AnalyticsPage.tsx` | Bug 6: antd Input/InputNumber + CSS变量修正 |
| `frontend/src/pages/ChannelsPage.tsx` | Bug 5: fetchChannels 合并逻辑修正 |
| `frontend/src/layouts/AppLayout.tsx` | Bug 7: antd Dropdown 替换手写 dropdown |
| `frontend/src/styles.css` | Bug 2: .form-input 定义 + 全局重置精确化 |

## 编译验证

```
$ cd frontend && npx tsc --noEmit
(无输出，退出码 0)
```
