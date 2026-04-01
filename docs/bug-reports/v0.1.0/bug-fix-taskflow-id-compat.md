# Bug Fix: Task ID 兼容性

## 问题描述
workflow 端点查询 Task 表时，担心旧 task ID（短字符串如 `task-rba-01`）与新 task ID（UUID）不兼容。

## 排查结论
**无需修复。** Task 模型 `id` 字段定义为 `String`，两种格式均可正常查询。

## 测试用例

### TC1: 短格式 ID 查询
- **命令**: `curl http://localhost:8000/api/tasks/task-rba-01`
- **返回**: `{"id":"task-rba-01","title":"初始化后端骨架",...}`
- **预期**: HTTP 200，返回完整 task 对象
- **状态**: ✅ PASS

### TC2: UUID 格式 ID 查询
- **命令**: `curl http://localhost:8000/api/tasks/c781d910-f64f-44a0-a9dc-fbe085f0e604`
- **返回**: `{"id":"c781d910-f64f-44a0-a9dc-fbe085f0e604","title":"Reject Test",...}`
- **预期**: HTTP 200
- **状态**: ✅ PASS

### TC3: 短格式 ID workflow transitions 查询
- **命令**: `curl http://localhost:8000/api/workflow/tasks/task-rba-01/transitions`
- **返回**: 正常 JSON（transitions 数组）
- **状态**: ✅ PASS
