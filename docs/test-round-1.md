# Test Report Round 1 — OpenClaw Control Plane Bug Fix v2

**测试人**: rd-commander  
**日期**: 2026-04-01  
**测试类型**: 后端 API 验证 + 前端编译验证  

---

## TC-001: Agent列表API返回真实数据
- **测试步骤**: `curl -s http://localhost:8000/api/agents-mgmt/list`
- **实际结果**: `{"agents":[42个agent对象], "total":42}`，每个 agent 含 `id`, `name`, `config.model` 嵌套结构
- **预期结果**: 返回非空 agent 数组，total ≥ 1
- **状态**: ✅ PASS

## TC-002: Agent数据映射正确性
- **测试步骤**: 检查 `agentsMgmt.ts` 中 `normalizeAgent` 函数对 `config.model.primary` 的提取
- **实际结果**: 函数定义 `typeof model === 'string' ? model : model?.primary || 'unknown'`，后端返回的 `config.model.primary = "zhipu/GLM-5-Turbo"` 可正确提取
- **预期结果**: `model` 字段为非空字符串
- **状态**: ✅ PASS

## TC-003: Memory树端点返回文件列表
- **测试步骤**: `curl -s 'http://localhost:8000/api/memory/tree?agent=main&category=memory'`
- **实际结果**: 返回 15 个 `{name, path, type:"file"}` 对象，first_path=`2026-03-18.md`
- **预期结果**: 返回非空数组，每个元素含 `path` 字段
- **状态**: ✅ PASS

## TC-004: Memory文件读取（无前缀）
- **测试步骤**: `curl -s 'http://localhost:8000/api/memory/file?path=2026-03-18.md'`
- **实际结果**: `{"detail":"File not found"}`
- **预期结果**: 404 — 验证了根因
- **状态**: ✅ PASS（确认问题存在）

## TC-005: Memory文件读取（有memory/前缀）
- **测试步骤**: `curl -s 'http://localhost:8000/api/memory/file?path=memory/2026-03-18.md'`
- **实际结果**: `{"path":"memory/2026-03-18.md","content":"# 2026-03-18 工作日志...","size_bytes":1425}`
- **预期结果**: 200，返回文件内容
- **状态**: ✅ PASS

## TC-006: Skills已安装列表
- **测试步骤**: `curl -s http://localhost:8000/api/skills/installed`
- **实际结果**: `{"skills":[64个skill对象]}`
- **预期结果**: 返回 `skills` 数组
- **状态**: ✅ PASS

## TC-007: Skills搜索结果格式
- **测试步骤**: `curl -s 'http://localhost:8000/api/skills/search?q=stock&source=skillhub'`
- **实际结果**: `{"query":"stock","results":"china-stock-analysis  China Stock Analysis  (3.634)\n...","ok":true}`
- **预期结果**: `results` 为 string 类型，非 array — 确认了崩溃根因
- **状态**: ✅ PASS（确认问题存在）

## TC-008: Channels列表返回enabled字段
- **测试步骤**: `curl -s http://localhost:8000/api/channels/list`
- **实际结果**: `{has_enabled=True, has_status=False}` — 后端返回 `enabled: boolean`，不返回 `status`
- **预期结果**: 确认 enabled→status 映射必要性
- **状态**: ✅ PASS

## TC-009: Analytics成本汇总
- **测试步骤**: `curl -s http://localhost:8000/api/analytics/cost/summary`
- **实际结果**: `{"today":{"tokens":0,"cost_usd":0},"week":{...},"month":{...},"period":"daily"}`
- **预期结果**: 返回 today/week/month 结构
- **状态**: ✅ PASS

## TC-010: Tasks CRUD完整性
- **测试步骤**: 
  1. `curl -s -X POST /api/tasks -d '{"project_id":"proj-ocp-001","title":"tc010"}'` → 创建成功
  2. `curl -s -X PUT /api/tasks/{id} -d '{"status":"in_progress"}'` → 更新成功
  3. `curl -s -X DELETE /api/tasks/{id}` → 删除成功(204)
- **实际结果**: 创建返回201+完整task对象，更新返回更新后对象，删除返回204
- **预期结果**: CRUD 全链路正常
- **状态**: ✅ PASS

## TC-011: Tasks action端点不存在
- **测试步骤**: `curl -s -X POST 'http://localhost:8000/api/tasks/task-rfa-01/action' -d '{"action":"start"}'`
- **实际结果**: `{"detail":"Not Found"}` — 确认后端无此路由
- **预期结果**: 404 — 确认根因
- **状态**: ✅ PASS（确认问题存在）

## TC-012: 前端编译通过
- **测试步骤**: `cd /root/.openclaw/workspace/project/openclaw-control-plane/frontend && npx tsc --noEmit`
- **实际结果**: 无输出，退出码 0
- **预期结果**: 编译无错误
- **状态**: ✅ PASS

## TC-013: CSS变量引用正确性
- **测试步骤**: `grep -rn 'var(--border)\|var(--card-bg)\|var(--info)\|var(--success)\|var(--danger)' frontend/src/`
- **实际结果**: 0 匹配（全部已替换为有效变量）
- **预期结果**: 无未定义的 CSS 变量引用
- **状态**: ✅ PASS

---

## 汇总
| 总用例 | PASS | FAIL | 跳过 | 未执行 |
|--------|------|------|------|--------|
| 13 | 13 | 0 | 0 | 0 |
