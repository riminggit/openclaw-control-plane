# OpenClaw Control Plane

OpenClaw Runtime 上层任务编排与可视化控制平面。

## 当前进度
- 已完成：项目骨架、FastAPI 基础 API、React 前端首页、Docker Compose、install.sh
- 下一步：
  - 接入真实数据库模型
  - 完成 Project / Task CRUD
  - 增加 Kanban / Task Detail / Review Center 页面
  - 封装 OpenClaw Adapter 与 Feishu Archive Adapter

## 目录结构
- `backend/` FastAPI 服务
- `frontend/` React + Vite 前端
- `deploy/` Docker Compose
- `scripts/` 辅助脚本
- `docs/` 方案与执行文档（位于 workspace/docs）

## 快速启动
```bash
./install.sh
```
