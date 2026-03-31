"""Phase 4: Enhanced Chat Hub API."""

import uuid
from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.db import get_db, ChatBookmark

router = APIRouter(prefix="/api/chat")

# In-memory message store (populated from Gateway events)
_messages_store: list[dict] = []


# ── Sync endpoint (frontend pushes messages here) ──

class SyncMessagesRequest(BaseModel):
    messages: list[dict] = Field(default_factory=list)

@router.post("/sync")
def sync_messages(body: SyncMessagesRequest):
    """Accept messages from the frontend (from Gateway events)."""
    global _messages_store
    for m in (body.messages or []):
        # Deduplicate by session_key + message_id combo
        key = f"{m.get('session_key','')}:{m.get('id','')}"
        if not any(f"{x.get('session_key','')}:{x.get('id','')}" == key for x in _messages_store):
            _messages_store.append(m)
    # Keep last 2000 messages
    if len(_messages_store) > 2000:
        _messages_store = _messages_store[-2000:]
    return {"ok": True, "count": len(_messages_store)}


# ── Schemas ──

class BroadcastRequest(BaseModel):
    session_keys: list[str]
    message: str = Field(..., min_length=1)

class BookmarkRequest(BaseModel):
    session_key: str
    message_id: str
    role: str
    content: str
    agent_id: Optional[str] = None


# ── Global message stream ──

@router.get("/all-messages")
def all_messages(limit: int = Query(100, ge=1, le=500), offset: int = Query(0, ge=0)):
    msgs = _messages_store[-(offset + limit):]
    if offset > 0:
        msgs = msgs[:-offset] if len(msgs) > offset else []
    return list(reversed(msgs))


# ── Search ──

@router.get("/search")
def search_messages(q: str = Query(..., min_length=1), session_keys: str = Query("", description="comma-separated session keys"), limit: int = Query(50, ge=1, le=200)):
    if not q:
        return []
    allowed_keys = [k.strip() for k in session_keys.split(",") if k.strip()] if session_keys else None
    results = []
    for m in _messages_store:
        if allowed_keys and m.get("session_key") not in allowed_keys:
            continue
        content = m.get("content", "")
        if q.lower() in content.lower():
            results.append(m)
        if len(results) >= limit:
            break
    return results


# ── Broadcast ──

@router.post("/broadcast")
def broadcast(body: BroadcastRequest):
    """Queue a message to be sent to multiple sessions."""
    # In production, this would call gatewayClient.call('chat.send', ...) for each session
    results = []
    for key in body.session_keys:
        results.append({"session_key": key, "status": "queued", "message": body.message})
    return {"broadcast_id": str(uuid.uuid4()), "targets": results, "count": len(results)}


# ── Bookmarks ──

@router.post("/bookmark", status_code=201)
def create_bookmark(body: BookmarkRequest, db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc).isoformat()
    bm = ChatBookmark(
        id=str(uuid.uuid4()), session_key=body.session_key, message_id=body.message_id,
        role=body.role, content=body.content, agent_id=body.agent_id, bookmarked_at=now,
    )
    db.add(bm)
    db.commit()
    db.refresh(bm)
    return {"id": bm.id, "session_key": bm.session_key, "message_id": bm.message_id,
            "role": bm.role, "content": bm.content, "bookmarked_at": bm.bookmarked_at}


@router.get("/bookmarks")
def list_bookmarks(session_key: Optional[str] = Query(None), db: Session = Depends(get_db)):
    q = db.query(ChatBookmark)
    if session_key:
        q = q.filter(ChatBookmark.session_key == session_key)
    rows = q.order_by(ChatBookmark.bookmarked_at.desc()).limit(100).all()
    return [{"id": r.id, "session_key": r.session_key, "message_id": r.message_id,
             "role": r.role, "content": r.content, "agent_id": r.agent_id, "bookmarked_at": r.bookmarked_at}
            for r in rows]


@router.delete("/bookmark/{bookmark_id}", status_code=204)
def delete_bookmark(bookmark_id: str, db: Session = Depends(get_db)):
    bm = db.query(ChatBookmark).filter(ChatBookmark.id == bookmark_id).first()
    if not bm:
        raise HTTPException(404, "Bookmark not found")
    db.delete(bm)
    db.commit()
