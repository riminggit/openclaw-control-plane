#!/usr/bin/env python3
"""
测试工作流管理 API 端点
验证 Step 10 的检查项
"""

import requests
import json

BASE_URL = "http://localhost:8000"

def test_api_endpoint(method, path, data=None, expected_status=200):
    """测试单个 API 端点"""
    url = f"{BASE_URL}{path}"
    try:
        if method == "GET":
            response = requests.get(url, timeout=5)
        elif method == "POST":
            response = requests.post(url, json=data, timeout=5)
        elif method == "PUT":
            response = requests.put(url, json=data, timeout=5)
        elif method == "DELETE":
            response = requests.delete(url, timeout=5)
        else:
            return False, f"不支持的 HTTP 方法: {method}"
        
        if response.status_code == expected_status:
            return True, f"✅ {method} {path} - 状态码: {response.status_code}"
        else:
            return False, f"❌ {method} {path} - 期望状态码: {expected_status}, 实际状态码: {response.status_code}"
    except Exception as e:
        return False, f"❌ {method} {path} - 错误: {str(e)}"


def main():
    print("=" * 80)
    print("工作流管理 API 端点测试")
    print("=" * 80)
    print()
    
    # 测试结果统计
    total_tests = 0
    passed_tests = 0
    failed_tests = 0
    
    # 1. 测试模板列表
    print("📋 测试 1: 获取模板列表")
    success, message = test_api_endpoint("GET", "/api/v1/workflow-templates")
    print(message)
    total_tests += 1
    if success:
        passed_tests += 1
    else:
        failed_tests += 1
    print()
    
    # 2. 测试创建模板
    print("📋 测试 2: 创建模板")
    template_data = {
        "name": "测试模板",
        "description": "这是一个测试模板",
        "dag": {
            "steps": [
                {
                    "id": "step1",
                    "name": "步骤1",
                    "agent": "test-agent",
                    "capabilities": [],
                    "estimated_duration": 60,
                    "human_review": False,
                    "depends_on": []
                }
            ],
            "edges": []
        },
        "config": {
            "maxRetries": 3,
            "timeout": 3600,
            "parallelism": 1
        },
        "tags": ["test"]
    }
    success, message = test_api_endpoint("POST", "/api/v1/workflow-templates", template_data, 201)
    print(message)
    total_tests += 1
    if success:
        passed_tests += 1
    else:
        failed_tests += 1
    print()
    
    # 3. 测试获取实例列表
    print("📋 测试 3: 获取实例列表")
    success, message = test_api_endpoint("GET", "/api/v1/workflow-instances")
    print(message)
    total_tests += 1
    if success:
        passed_tests += 1
    else:
        failed_tests += 1
    print()
    
    # 4. 测试获取审核列表
    print("📋 测试 4: 获取审核列表")
    success, message = test_api_endpoint("GET", "/api/v1/reviews/pending")
    print(message)
    total_tests += 1
    if success:
        passed_tests += 1
    else:
        failed_tests += 1
    print()
    
    # 5. 测试获取审核统计
    print("📋 测试 5: 获取审核统计")
    success, message = test_api_endpoint("GET", "/api/v1/reviews/stats")
    print(message)
    total_tests += 1
    if success:
        passed_tests += 1
    else:
        failed_tests += 1
    print()
    
    # 6. 测试获取 agent 列表
    print("📋 测试 6: 获取 agent 列表")
    success, message = test_api_endpoint("GET", "/api/v1/workflow/agents")
    print(message)
    total_tests += 1
    if success:
        passed_tests += 1
    else:
        failed_tests += 1
    print()
    
    # 7. 测试获取 Gateway 状态
    print("📋 测试 7: 获取 Gateway 状态")
    success, message = test_api_endpoint("GET", "/api/gateway/status")
    print(message)
    total_tests += 1
    if success:
        passed_tests += 1
    else:
        failed_tests += 1
    print()
    
    # 8. 测试获取 Gateway health
    print("📋 测试 8: 获取 Gateway health")
    success, message = test_api_endpoint("GET", "/api/gateway/health")
    print(message)
    total_tests += 1
    if success:
        passed_tests += 1
    else:
        failed_tests += 1
    print()
    
    # 输出测试结果汇总
    print("=" * 80)
    print("测试结果汇总")
    print("=" * 80)
    print(f"总测试数: {total_tests}")
    print(f"通过: {passed_tests} ✅")
    print(f"失败: {failed_tests} ❌")
    print(f"通过率: {(passed_tests/total_tests*100):.1f}%")
    print("=" * 80)
    
    if failed_tests == 0:
        print("\n✅ 所有 API 端点测试通过！")
        return 0
    else:
        print(f"\n❌ 有 {failed_tests} 个测试失败")
        return 1


if __name__ == "__main__":
    exit(main())
