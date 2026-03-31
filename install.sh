#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "[1/3] setup backend venv"
python3 -m venv "$ROOT_DIR/.venv"
source "$ROOT_DIR/.venv/bin/activate"
pip install --upgrade pip
pip install -r "$ROOT_DIR/backend/requirements.txt"

echo "[2/3] install frontend deps"
cd "$ROOT_DIR/frontend"
npm install

cat <<MSG

安装完成。
启动方式：
1. 后端：source $ROOT_DIR/.venv/bin/activate && cd $ROOT_DIR/backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8080
2. 前端：cd $ROOT_DIR/frontend && npm run dev -- --host 0.0.0.0 --port 5173
3. Docker：cd $ROOT_DIR/deploy && docker compose up
MSG
