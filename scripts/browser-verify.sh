#!/bin/bash

# 浏览器全站验证脚本
BASE_URL="http://43.155.138.191:92"
OUTPUT_DIR="/root/.openclaw/workspace/project/openclaw-control-plane/docs/testing/test-reports/v0.1.0/screenshots"
REPORT_FILE="/root/.openclaw/workspace/project/openclaw-control-plane/docs/testing/test-reports/v0.1.0/browser-verification.md"

mkdir -p "$OUTPUT_DIR"

# 页面列表
declare -a PAGES=(
    "Dashboard|/"
    "Sessions|/sessions"
    "Cron|/cron"
    "Chat|/chat"
    "Settings|/settings"
    "Kanban|/kanban"
    "Tasks|/tasks"
    "Projects|/projects"
    "Analytics|/analytics/cost"
    "AgentLifecycle|/agents/lifecycle"
    "Agents|/agents-mgmt"
    "Channels|/channels"
    "Logs|/logs"
    "Services|/services"
    "Skills|/skills"
    "Memory|/memory"
    "Usage|/usage"
    "Security|/security"
    "Extensions|/extensions"
    "Communication|/communication"
)

TOTAL=0
SUCCESS=0
FAILED=0

echo "开始浏览器全站验证..."
echo "基础URL: $BASE_URL"
echo ""

for page_info in "${PAGES[@]}"; do
    IFS='|' read -r name path <<< "$page_info"
    url="${BASE_URL}${path}"
    safe_name=$(echo "$name" | tr '[:upper:]' '[:lower:]')
    screenshot_file="${OUTPUT_DIR}/${safe_name}.png"
    
    TOTAL=$((TOTAL + 1))
    echo "[$TOTAL/${#PAGES[@]}] $name ($path)"
    
    if timeout 15 chromium-browser --headless --no-sandbox --disable-gpu \
       --window-size=1920,1080 \
       --screenshot="$screenshot_file" \
       "$url" 2>/dev/null; then
        
        file_size=$(stat -c%s "$screenshot_file" 2>/dev/null || echo "0")
        
        if [ "$file_size" -lt 10240 ]; then
            echo "  ⚠️  警告: 文件大小偏小(${file_size}字节)"
            FAILED=$((FAILED + 1))
        else
            echo "  ✅ 成功: ${file_size}字节"
            SUCCESS=$((SUCCESS + 1))
        fi
    else
        echo "  ❌ 失败"
        FAILED=$((FAILED + 1))
    fi
    
    sleep 0.5
done

echo ""
echo "=== 验证完成 ==="
echo "总计: $TOTAL | 成功: $SUCCESS | 失败: $FAILED"
