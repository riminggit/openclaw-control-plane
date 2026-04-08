# Code Review Round 2B — Workflow/Compatibility Follow-up

**日期**: 2026-04-02  
**范围**: backend SQLite 兼容性、基础 API 兼容性、工作流链路稳定性复核

## 已确认通过

1. **SQLite 兼容性修复有效**
   - `text("now()")` 改为 `func.now()` 后，模型建表恢复正常
   - `JSONB` 改为 `JSON` 后，SQLite 编译错误消失
   - `Task` 重复时间字段移除后，模型定义更一致

2. **基础接口兼容性增强有效**
   - `/projects`、`/tasks` 创建/更新接口同时兼容 JSON Body 与 Query 参数
   - 避免了既有 smoke tests 全量 422 的兼容问题
   - `exclude_none=True` 修复了更新时空值覆盖 NOT NULL 字段的问题

3. **基础质量结果**
   - smoke tests: **11/11 PASS**
   - workflow model tests: **9/9 PASS**
   - frontend build: **PASS**

## 仍需处理

### 工作流操作层失败点（14项）
集中于：
- retry failed step
- skip step
- approve/reject review step
- force complete
- dependency wait
- instance/step progress calculation

## 结论

- 本轮修复质量**通过**，方向正确，未引入新的基础层回归
- 但工作流操作链路尚未达到稳定放行标准
- 建议在第3轮中专门围绕 `workflow_ops_api` 进行缺陷收敛与回归验证
