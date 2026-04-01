# 旧系统与新系统迁移指南

## 系统定位说明

### 旧系统 (ops.py)
**文件位置**: `backend/app/api/workflow/ops.py`

**定位**: 早期原型实现，基于 Task 的简单状态机逻辑

**特点**:
- 简单的任务执行流程
- 基本的状态管理
- 有限的错误处理
- 无 WebSocket 支持
- 无 Agent 管理功能

**状态**: ⚠️ **已弃用** - 保留用于参考，不建议在生产环境使用

### 新系统 (instances.py + templates.py)
**文件位置**: 
- `backend/app/api/workflow/instances.py` - 工作流实例管理
- `backend/app/api/workflow/templates.py` - 工作流模板管理
- `backend/app/services/workflow/` - 服务层业务逻辑

**定位**: 生产级工作流管理系统

**特点**:
- ✅ 完整的 DAG 工作流引擎
- ✅ 模板版本管理
- ✅ 步骤级别的状态控制
- ✅ 人工审核流程
- ✅ Agent 调度集成
- ✅ WebSocket 实时推送（计划中）
- ✅ 完善的错误处理和重试机制

**状态**: ✅ **推荐使用** - 当前开发和维护的主要版本

## 迁移路径

### Phase 1: 并行运行（当前阶段）
- 新旧系统并存
- 新功能仅在新系统中实现
- 旧系统保持维护模式

### Phase 2: 功能迁移
- 将依赖旧系统的功能迁移到新系统
- 提供数据迁移脚本
- 兼容性测试

### Phase 3: 完全切换
- 停止旧系统维护
- 移除旧系统代码
- 文档更新

## API 兼容性

| 功能 | 旧系统 API | 新系统 API | 状态 |
|------|-----------|-----------|------|
| 创建工作流 | POST /api/workflow/start | POST /api/v1/workflow-instances | ✅ 新系统 |
| 查询状态 | GET /api/workflow/status/{id} | GET /api/v1/workflow-instances/{id} | ✅ 新系统 |
| 模板管理 | ❌ 无 | /api/v1/workflow-templates | ✅ 新系统 |
| 步骤控制 | ❌ 无 | /api/v1/workflow-instances/{id}/steps | ✅ 新系统 |
| 审核流程 | ❌ 无 | /api/v1/workflow-instances/{id}/steps/{step_id}/approve | ✅ 新系统 |

## 数据模型差异

### 旧系统
```python
# 简单的 Task 模型
class Task:
    id: str
    name: str
    status: str
    created_at: datetime
```

### 新系统
```python
# 完整的工作流模型
class WorkflowTemplate:
    id: str
    name: str
    dag: JSON  # DAG 定义
    version: str
    
class WorkflowInstance:
    id: str
    template_id: str
    status: str
    input: JSON
    output: JSON
    
class StepExecution:
    id: str
    workflow_instance_id: str
    status: str
    agent_name: str
```

## 迁移建议

### 对于开发者
1. **新项目**: 直接使用新系统 API
2. **现有项目**: 评估迁移成本，制定迁移计划
3. **测试**: 充分测试迁移后的功能

### 对于运维
1. **监控**: 同时监控新旧系统
2. **日志**: 分离日志收集
3. **备份**: 迁移前做好数据备份

## 技术支持

如有迁移相关问题，请联系研发团队：
- 研发负责人: rd-lead
- 后端架构: rd-backend-arch

## 更新日志

- **2026-04-02**: 创建迁移指南，明确新旧系统定位
- **2026-04-02**: 新系统完成服务层重构和认证集成
