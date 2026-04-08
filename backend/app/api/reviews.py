"""人工审核 API"""

from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel
from sqlalchemy import select, func, and_
from sqlalchemy.orm import Session, joinedload

from app.db import get_db
from app.models.workflow import ReviewRecord, WorkflowInstance, WorkflowTemplate, StepExecution

router = APIRouter(prefix="/api/v1/reviews", tags=["reviews"])


# ==================== Schemas ====================

class ReviewRequest(BaseModel):
    comment: str


class ReviewOutput(BaseModel):
    summary: str
    files: Optional[list] = None
    reasoning: Optional[str] = None


class ReviewListItem(BaseModel):
    id: str
    workflow_instance_id: str
    workflow_name: str
    step_execution_id: str
    step_name: str
    reviewer_id: str
    reviewer_name: str
    created_at: str
    timeout_at: str
    remaining_time: int
    review_round: int
    outputs: Optional[ReviewOutput] = None


class ReviewHistory(BaseModel):
    round: int
    action: str
    comment: Optional[str]
    created_at: str
    reviewer_name: str


class ReviewDetail(ReviewListItem):
    action: Optional[str] = None
    comment: Optional[str] = None
    updated_at: str
    timeout_action: Optional[str] = None
    history: Optional[list[ReviewHistory]] = None


class ReviewStats(BaseModel):
    total_pending: int
    total_completed_today: int
    timeout_warnings: int
    avg_review_time_seconds: float
    by_action: dict[str, int]


class PaginatedResponse(BaseModel):
    total: int
    page: int
    page_size: int
    total_pages: int
    data: list


# ==================== Helper Functions ====================

def calculate_remaining_time(timeout_at: Optional[str]) -> int:
    """计算剩余时间（秒）"""
    if not timeout_at:
        return 0
    
    try:
        timeout_dt = datetime.fromisoformat(timeout_at.replace('Z', '+00:00'))
        now = datetime.utcnow()
        remaining = (timeout_dt - now).total_seconds()
        return max(0, int(remaining))
    except:
        return 0


def get_step_outputs(step_execution: StepExecution) -> Optional[dict]:
    """获取步骤的输出"""
    if step_execution.output:
        try:
            import json
            output_data = json.loads(step_execution.output)
            return output_data
        except:
            return None
    return None


# ==================== API Endpoints ====================

@router.get("/pending", response_model=PaginatedResponse)
async def get_pending_reviews(
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    reviewer_id: Optional[str] = Query(None)
):
    """获取待审核列表"""
    # 构建查询：查找 action 为 None 的审核记录
    query = (
        select(ReviewRecord)
        .options(
            joinedload(ReviewRecord.workflow_instance).joinedload(WorkflowInstance.template),
            joinedload(ReviewRecord.step_execution)
        )
        .where(ReviewRecord.action.is_(None))
        .order_by(ReviewRecord.created_at.desc())
    )
    
    if reviewer_id:
        query = query.where(ReviewRecord.reviewer_id == reviewer_id)
    
    # 获取总数
    count_query = (
        select(func.count())
        .select_from(ReviewRecord)
        .where(ReviewRecord.action.is_(None))
    )
    if reviewer_id:
        count_query = count_query.where(ReviewRecord.reviewer_id == reviewer_id)
    
    total = db.execute(count_query).scalar()
    
    # 分页
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)
    
    reviews = db.execute(query).scalars().all()
    
    # 构建返回数据
    data = []
    for review in reviews:
        workflow = review.workflow_instance
        step = review.step_execution
        
        # 获取步骤输出
        outputs = None
        if step:
            outputs = get_step_outputs(step)
        
        item = ReviewListItem(
            id=review.id,
            workflow_instance_id=review.workflow_instance_id,
            workflow_name=workflow.template.name if workflow and workflow.template else (workflow.template_id if workflow else ""),
            step_execution_id=review.step_execution_id,
            step_name=step.name if step else "",
            reviewer_id=review.reviewer_id,
            reviewer_name=review.reviewer_name or "",
            created_at=review.created_at,
            timeout_at=review.timeout_at or "",
            remaining_time=calculate_remaining_time(review.timeout_at),
            review_round=review.review_round,
            outputs=outputs
        )
        data.append(item)
    
    total_pages = (total + page_size - 1) // page_size
    
    return PaginatedResponse(
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        data=data
    )


@router.get("/stats", response_model=ReviewStats)
async def get_review_stats(
    db: Session = Depends(get_db),
    reviewer_id: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None)
):
    """获取审核统计"""
    # 统计待审核数量
    pending_query = select(func.count()).select_from(ReviewRecord).where(
        ReviewRecord.action.is_(None)
    )
    if reviewer_id:
        pending_query = pending_query.where(ReviewRecord.reviewer_id == reviewer_id)
    total_pending = db.execute(pending_query).scalar()
    
    # 统计今日完成数量
    today = datetime.utcnow().date()
    today_start = datetime.combine(today, datetime.min.time())
    today_end = datetime.combine(today, datetime.max.time())
    
    completed_query = select(func.count()).select_from(ReviewRecord).where(
        and_(
            ReviewRecord.action.isnot(None),
            ReviewRecord.updated_at >= today_start.isoformat(),
            ReviewRecord.updated_at <= today_end.isoformat()
        )
    )
    if reviewer_id:
        completed_query = completed_query.where(ReviewRecord.reviewer_id == reviewer_id)
    total_completed_today = db.execute(completed_query).scalar()
    
    # 统计即将超时的数量（剩余时间 < 1小时）
    timeout_warnings = 0
    # TODO: 实现超时预警逻辑
    
    # 按动作统计
    by_action = {"approve": 0, "reject": 0, "request_changes": 0}
    action_query = (
        select(ReviewRecord.action, func.count())
        .where(ReviewRecord.action.isnot(None))
        .group_by(ReviewRecord.action)
    )
    if reviewer_id:
        action_query = action_query.where(ReviewRecord.reviewer_id == reviewer_id)
    
    action_results = db.execute(action_query).all()
    for action, count in action_results:
        if action in by_action:
            by_action[action] = count
    
    # 计算平均审核时间（简化版）
    avg_review_time_seconds = 0.0
    # TODO: 实现平均审核时间计算
    
    return ReviewStats(
        total_pending=total_pending,
        total_completed_today=total_completed_today,
        timeout_warnings=timeout_warnings,
        avg_review_time_seconds=avg_review_time_seconds,
        by_action=by_action
    )


@router.get("/{review_id}", response_model=ReviewDetail)
async def get_review_detail(
    review_id: str,
    db: Session = Depends(get_db)
):
    """获取审核详情"""
    review = db.execute(
        select(ReviewRecord)
        .options(
            joinedload(ReviewRecord.workflow_instance).joinedload(WorkflowInstance.template),
            joinedload(ReviewRecord.step_execution)
        )
        .where(ReviewRecord.id == review_id)
    ).scalar_one_or_none()
    
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    
    workflow = review.workflow_instance
    step = review.step_execution
    
    # 获取步骤输出
    outputs = None
    if step:
        outputs = get_step_outputs(step)
    
    # TODO: 获取审核历史（如果有多次审核）
    history = None
    
    return ReviewDetail(
        id=review.id,
        workflow_instance_id=review.workflow_instance_id,
        workflow_name=workflow.template.name if workflow and workflow.template else (workflow.template_id if workflow else ""),
        step_execution_id=review.step_execution_id,
        step_name=step.name if step else "",
        reviewer_id=review.reviewer_id,
        reviewer_name=review.reviewer_name or "",
        created_at=review.created_at,
        timeout_at=review.timeout_at or "",
        remaining_time=calculate_remaining_time(review.timeout_at),
        review_round=review.review_round,
        outputs=outputs,
        action=review.action,
        comment=review.comment,
        updated_at=review.updated_at,
        timeout_action=review.timeout_action,
        history=history
    )


@router.post("/{review_id}/approve")
async def approve_review(
    review_id: str,
    request: ReviewRequest,
    db: Session = Depends(get_db)
):
    """通过审核"""
    review = db.execute(
        select(ReviewRecord).where(ReviewRecord.id == review_id)
    ).scalar_one_or_none()
    
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    
    if review.action:
        raise HTTPException(status_code=400, detail="Review already processed")
    
    # 更新审核记录
    review.action = "approve"
    review.comment = request.comment
    review.updated_at = datetime.utcnow().isoformat()
    
    # 更新步骤状态为 approved
    if review.step_execution:
        review.step_execution.status = "approved"
        review.step_execution.updated_at = datetime.utcnow().isoformat()
    
    # 更新工作流状态
    if review.workflow_instance:
        # TODO: 检查是否所有步骤都已完成，更新工作流状态
        pass
    
    db.commit()
    
    return {
        "success": True,
        "review": {
            "id": review.id,
            "action": review.action,
            "comment": review.comment,
            "updated_at": review.updated_at
        },
        "workflow": {
            "id": review.workflow_instance_id,
            "status": review.workflow_instance.status if review.workflow_instance else "unknown",
            "progress": review.workflow_instance.progress if review.workflow_instance else 0
        }
    }


@router.post("/{review_id}/reject")
async def reject_review(
    review_id: str,
    request: ReviewRequest,
    db: Session = Depends(get_db)
):
    """拒绝审核"""
    review = db.execute(
        select(ReviewRecord).where(ReviewRecord.id == review_id)
    ).scalar_one_or_none()
    
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    
    if review.action:
        raise HTTPException(status_code=400, detail="Review already processed")
    
    # 更新审核记录
    review.action = "reject"
    review.comment = request.comment
    review.updated_at = datetime.utcnow().isoformat()
    
    # 更新步骤状态为 rejected
    if review.step_execution:
        review.step_execution.status = "rejected"
        review.step_execution.updated_at = datetime.utcnow().isoformat()
    
    # 更新工作流状态
    if review.workflow_instance:
        review.workflow_instance.status = "failed"
        review.workflow_instance.error_message = f"Rejected: {request.comment}"
        review.workflow_instance.updated_at = datetime.utcnow().isoformat()
    
    db.commit()
    
    return {
        "success": True,
        "review": {
            "id": review.id,
            "action": review.action,
            "comment": review.comment,
            "updated_at": review.updated_at
        },
        "workflow": {
            "id": review.workflow_instance_id,
            "status": review.workflow_instance.status if review.workflow_instance else "unknown",
            "progress": review.workflow_instance.progress if review.workflow_instance else 0
        }
    }


@router.post("/{review_id}/request-changes")
async def request_changes_review(
    review_id: str,
    request: ReviewRequest,
    db: Session = Depends(get_db)
):
    """要求修改"""
    review = db.execute(
        select(ReviewRecord).where(ReviewRecord.id == review_id)
    ).scalar_one_or_none()
    
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    
    if review.action:
        raise HTTPException(status_code=400, detail="Review already processed")
    
    # 更新审核记录
    review.action = "request_changes"
    review.comment = request.comment
    review.updated_at = datetime.utcnow().isoformat()
    
    # 更新步骤状态为 retrying（重新执行）
    if review.step_execution:
        review.step_execution.status = "retrying"
        review.step_execution.retry_count += 1
        review.step_execution.updated_at = datetime.utcnow().isoformat()
    
    # 创建新的审核记录（下一轮）
    new_review = ReviewRecord(
        id=f"review-{datetime.utcnow().timestamp()}",
        workflow_instance_id=review.workflow_instance_id,
        step_execution_id=review.step_execution_id,
        reviewer_id=review.reviewer_id,
        reviewer_name=review.reviewer_name,
        review_round=review.review_round + 1,
        created_at=datetime.utcnow().isoformat(),
        updated_at=datetime.utcnow().isoformat()
    )
    db.add(new_review)
    
    db.commit()
    
    return {
        "success": True,
        "review": {
            "id": new_review.id,
            "action": None,
            "comment": None,
            "review_round": new_review.review_round,
            "updated_at": new_review.updated_at
        },
        "workflow": {
            "id": review.workflow_instance_id,
            "status": review.workflow_instance.status if review.workflow_instance else "unknown",
            "progress": review.workflow_instance.progress if review.workflow_instance else 0
        }
    }
