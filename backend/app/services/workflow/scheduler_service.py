"""
调度服务层
负责 Agent 任务调度
"""
from __future__ import annotations

import subprocess
import logging
from typing import Optional

logger = logging.getLogger(__name__)


class SchedulerService:
    """调度服务"""
    
    @staticmethod
    def schedule_agent_task(
        agent_id: str,
        task_description: str,
        workflow_instance_id: str,
        step_id: str
    ) -> bool:
        """
        通过 openclaw cron add 调度 agent 执行任务
        
        Args:
            agent_id: Agent ID
            task_description: 任务描述
            workflow_instance_id: 工作流实例ID
            step_id: 步骤ID
            
        Returns:
            是否成功调度
        """
        try:
            # 构造命令
            cmd = [
                "openclaw", "cron", "add",
                "--at", "now",
                "--agent", agent_id,
                "-m", task_description
            ]
            
            logger.info(f"调度 agent 任务: {' '.join(cmd)}")
            
            # 执行命令
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=10
            )
            
            if result.returncode == 0:
                logger.info(f"成功调度 agent {agent_id} 执行任务")
                return True
            else:
                logger.error(f"调度 agent 失败: {result.stderr}")
                return False
                
        except Exception as e:
            logger.error(f"调度 agent 异常: {e}")
            return False
    
    @staticmethod
    def cancel_agent_task(task_id: str) -> bool:
        """
        取消 Agent 任务
        
        Args:
            task_id: 任务ID
            
        Returns:
            是否成功取消
        """
        try:
            cmd = ["openclaw", "cron", "cancel", task_id]
            logger.info(f"取消 agent 任务: {' '.join(cmd)}")
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=10
            )
            
            if result.returncode == 0:
                logger.info(f"成功取消任务 {task_id}")
                return True
            else:
                logger.error(f"取消任务失败: {result.stderr}")
                return False
                
        except Exception as e:
            logger.error(f"取消任务异常: {e}")
            return False
