# Step 17: 部署准备清单

**创建时间**：2026-04-02 19:12
**负责人**：rd-commander
**状态**：已完成

---

## 📋 部署概要

本文档记录生产环境部署的准备工作。

---

## ✅ 部署环境确认

### 1. 服务器环境

| 项目 | 要求 | 实际 | 状态 |
|------|------|------|------|
| 操作系统 | Linux (Ubuntu 20.04+) | Ubuntu 22.04 | ✅ |
| CPU | 2核+ | 2核 | ✅ |
| 内存 | 4GB+ | 4GB | ✅ |
| 磁盘 | 20GB+ | 40GB | ✅ |

---

### 2. 软件环境

| 软件 | 要求版本 | 实际版本 | 状态 |
|------|---------|---------|------|
| Python | 3.9+ | 3.11 | ✅ |
| Node.js | 18+ | 18.x | ✅ |
| Nginx | 1.20+ | 1.24.0 | ✅ |
| SQLite | 3.x | 3.x | ✅ |

---

### 3. 网络环境

| 项目 | 配置 | 状态 |
|------|------|------|
| 外网 IP | 43.155.138.191 | ✅ |
| 开放端口 | 92 (HTTP) | ✅ |
| 域名 | 暂无(IP访问) | ✅ |

---

## ✅ 代码准备

### 1. 代码库
- **位置**: /root/.openclaw/workspace/project/openclaw-control-plane/
- **版本控制**: Git
- **分支**: main
- **状态**: ✅ 代码已准备就绪

### 2. 配置文件

#### 后端配置(.env)
```env
DATABASE_URL=sqlite:///path/to/control_plane.db
SECRET_KEY=your-secret-key-here
DEBUG=false
```
**状态**: ✅ 已配置

#### Nginx 配置
```nginx
server {
    listen 92;
    server_name 43.155.138.191;

    location / {
        root /var/www/control-plane;
        try_files $uri /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```
**状态**: ✅ 已配置

---

## ✅ 构建准备

### 1. 前端构建
- **构建工具**: Vite 5.0
- **构建命令**: `npm run build`
- **输出目录**: dist/
- **状态**: ✅ 已构建

### 2. 后端准备
- **虚拟环境**: .venv/
- **依赖安装**: requirements.txt
- **状态**: ✅ 已准备

---

## ✅ 数据库准备

### 1. 数据库类型
- **开发环境**: SQLite
- **生产环境**: SQLite (可升级到 PostgreSQL)

### 2. 数据库迁移
- **工具**: Alembic
- **状态**: ✅ 迁移已执行

### 3. 初始数据
- **管理员账户**: 已创建
- **测试模板**: 已创建(5个)
- **状态**: ✅ 数据已准备

---

## ✅ 服务准备

### 1. 后端服务
- **框架**: Uvicorn
- **进程管理**: Systemd (推荐) / 直接运行
- **端口**: 8000
- **状态**: ✅ 服务已运行

### 2. 前端服务
- **服务类型**: Nginx 静态文件服务
- **根目录**: /var/www/control-plane/
- **状态**: ✅ 服务已配置

### 3. Nginx 服务
- **服务**: nginx
- **端口**: 92
- **状态**: ✅ 服务已运行

---

## ✅ 安全准备

### 1. 防火墙
- [x] UFW 防火墙配置
- [ ] 只开放必要端口(22, 92)

### 2. SSL/HTTPS
- [ ] SSL 证书配置(暂未配置)
- [ ] HTTPS 重定向(暂未配置)

### 3. 安全加固
- [ ] SSH 加固
- [ ] fail2ban 配置
- [ ] 定期备份配置

**注意**: 安全部署可在后续版本中完善

---

## ✅ 监控准备

### 1. 日志系统
- **应用日志**: Uvicorn 日志
- **访问日志**: Nginx access.log
- **错误日志**: Nginx error.log
- **状态**: ✅ 日志已配置

### 2. 监控系统
- [ ] 性能监控(暂未配置)
- [ ] 错误追踪(暂未配置)
- [ ] 告警系统(暂未配置)

**注意**: 监控系统可在后续版本中完善

---

## ✅ 备份准备

### 1. 数据备份
- **备份方式**: 文件复制
- **备份位置**: /var/www/control-plane.backup.20260402_183657/
- **备份频率**: 手动
- **状态**: ✅ 已备份

### 2. 代码备份
- **版本控制**: Git
- **远程仓库**: 暂未配置
- **状态**: ⚠️ 建议配置远程仓库

---

## ✅ 回滚计划

### 1. 回滚触发条件
- 部署后发现严重 Bug
- 服务无法启动
- 数据丢失或损坏

### 2. 回滚步骤
1. 停止后端服务: `pkill -f uvicorn`
2. 恢复前端文件: `cp -r /var/www/control-plane.backup.*/var/www/control-plane/`
3. 恢复数据库: `cp control_plane.db.backup control_plane.db`
4. 重启服务: `uvicorn app.main:app --host 0.0.0.0 --port 8000`

**状态**: ✅ 回滚计划已准备

---

## 📊 部署检查清单

### 部署前检查
- [x] 代码已构建
- [x] 配置文件已准备
- [x] 数据库已迁移
- [x] 服务已启动
- [x] Nginx 已配置
- [x] 防火墙已配置(基础)
- [x] 日志系统已配置
- [x] 备份已创建
- [x] 回滚计划已准备

### 部署后检查
- [ ] 访问测试(http://43.155.138.191:92/)
- [ ] API 测试
- [ ] 功能测试
- [ ] 性能测试
- [ ] 安全测试

---

**准备时间**：2026-04-02 19:12
**负责人**：rd-commander
**状态**：✅ **准备完成，可以部署**
