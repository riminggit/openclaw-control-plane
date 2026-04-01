"""Phase 5: Security settings API — password, audit log, security info."""

import hashlib, json, os, uuid
from datetime import datetime, timezone
from pathlib import Path
from pydantic import BaseModel
from fastapi import APIRouter, Request, Query, Depends, HTTPException
from sqlalchemy import String, Text
from sqlalchemy.orm import Session, Mapped, mapped_column

from app.db import SessionLocal, Base, engine

router = APIRouter(prefix="/api/security")

AUTH_FILE = Path.home() / ".openclaw" / "workspace" / ".control-plane-auth.json"

WEAK_PASSWORDS = {
    "password", "123456", "12345678", "qwerty", "abc123", "monkey", "master",
    "dragon", "111111", "baseball", "iloveyou", "trustno1", "sunshine",
    "princess", "football", "shadow", "superman", "michael", "letmein",
    "password1", "1234567890", "admin", "welcome", "hello", "000000",
    "qwerty123", "admin123", "root", "toor", "pass", "passw0rd",
}


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    action: Mapped[str] = mapped_column(String, nullable=False)
    ip_address: Mapped[str | None] = mapped_column(String, nullable=True)
    result: Mapped[str] = mapped_column(String, nullable=False, default="success")
    detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[str] = mapped_column(String, nullable=False)

AuditLog.__table__.create(bind=engine, checkfirst=True)


def _get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _hash_password(pw: str) -> str:
    salt = uuid.uuid4().hex
    return f"{salt}${hashlib.sha256(f'{salt}{pw}'.encode()).hexdigest()}"


def _check_password(pw: str, stored: str) -> bool:
    salt, _ = stored.split("$", 1)
    return f"{salt}${hashlib.sha256(f'{salt}{pw}'.encode()).hexdigest()}" == stored


def _read_auth() -> dict:
    if AUTH_FILE.exists():
        try:
            return json.loads(AUTH_FILE.read_text())
        except Exception:
            pass
    return {}


def _write_auth(data: dict):
    AUTH_FILE.parent.mkdir(parents=True, exist_ok=True)
    AUTH_FILE.write_text(json.dumps(data, indent=2))


def _audit(db: Session, action: str, ip: str | None, result: str = "success", detail: str | None = None):
    log = AuditLog(
        id=uuid.uuid4().hex[:12],
        action=action, ip_address=ip, result=result, detail=detail,
        created_at=datetime.now(timezone.utc).isoformat(),
    )
    db.add(log)
    db.commit()


def _score_password(pw: str) -> dict:
    score = 0
    checks = {
        "length_8": len(pw) >= 8,
        "length_12": len(pw) >= 12,
        "has_upper": any(c.isupper() for c in pw),
        "has_lower": any(c.islower() for c in pw),
        "has_digit": any(c.isdigit() for c in pw),
        "has_special": any(c in "!@#$%^&*()_+-=[]{}|;:,.<>?/" for c in pw),
        "not_weak": pw.lower() not in WEAK_PASSWORDS,
    }
    for v in checks.values():
        score += 1
    if checks["length_12"]:
        score += 1
    level = "weak" if score <= 3 else "fair" if score <= 5 else "good" if score <= 7 else "strong"
    return {"score": score, "max_score": 8, "level": level, "checks": checks}


# ── Schemas ──

class PasswordSet(BaseModel):
    old_password: str | None = None
    new_password: str

class PasswordSetFrontend(BaseModel):
    current: str | None = None
    new: str

class WhitelistAdd(BaseModel):
    ip: str

class WhitelistRemove(BaseModel):
    ip: str

class PasswordVerify(BaseModel):
    password: str


# ── Endpoints ──

@router.get("/status")
def get_status():
    auth = _read_auth()
    has_password = bool(auth.get("password_hash"))
    risks = []
    if not has_password:
        risks.append("no_password_set")
    if not auth.get("ip_whitelist"):
        risks.append("no_ip_whitelist")
    return {"has_password": has_password, "has_ip_whitelist": bool(auth.get("ip_whitelist")),
            "ip_whitelist": auth.get("ip_whitelist", []), "risks": risks}


@router.post("/password")
async def set_password(request: Request, db: Session = Depends(_get_db)):
    """Set or change password. Accepts {old_password, new_password} or {current, new}."""
    body = await request.json()
    old_pw = body.get("old_password") or body.get("current")
    new_pw = body.get("new_password") or body.get("new")
    if not new_pw:
        raise HTTPException(400, "new_password required")

    auth = _read_auth()
    ip = request.client.host if request.client else None
    if auth.get("password_hash"):
        if not old_pw:
            _audit(db, "set_password", ip, "failed", "old_password_required")
            raise HTTPException(400, "Current password required")
        if not _check_password(old_pw, auth["password_hash"]):
            _audit(db, "set_password", ip, "failed", "wrong_old_password")
            raise HTTPException(403, "Current password is incorrect")

    strength = _score_password(new_pw)
    if strength["level"] in ("weak", "fair"):
        _audit(db, "set_password", ip, "failed", f"weak_password:{strength['level']}")
        raise HTTPException(400, f"Password too {strength['level']}. Use 8+ chars with mixed case, numbers, and symbols.")

    auth["password_hash"] = _hash_password(new_pw)
    auth["updated_at"] = datetime.now(timezone.utc).isoformat()
    _write_auth(auth)
    _audit(db, "set_password", ip, "success", "password_changed")
    return {"ok": True, "message": "Password set successfully"}


@router.post("/verify")
def verify_password(body: PasswordVerify, request: Request, db: Session = Depends(_get_db)):
    auth = _read_auth()
    ip = request.client.host if request.client else None
    stored = auth.get("password_hash")
    if not stored:
        _audit(db, "verify_password", ip, "success", "no_password_set")
        return {"valid": True, "has_password": False}
    valid = _check_password(body.password, stored)
    _audit(db, "verify_password", ip, "success" if valid else "failed")
    return {"valid": valid, "has_password": True}


@router.get("/audit-log")
def get_audit_log(db: Session = Depends(_get_db), limit: int = Query(50, le=200), offset: int = 0):
    logs = db.query(AuditLog).order_by(AuditLog.created_at.desc()).offset(offset).limit(limit).all()
    total = db.query(AuditLog).count()
    return {"total": total, "logs": [
        {"id": l.id, "action": l.action, "ip_address": l.ip_address, "result": l.result, "detail": l.detail, "created_at": l.created_at}
        for l in logs
    ]}


@router.get("/info")
def get_security_info():
    auth = _read_auth()
    has_pw = bool(auth.get("password_hash"))
    risks = []
    score = 50
    if has_pw:
        score += 20
    else:
        risks.append("No password set — anyone with network access can use the panel")
    if auth.get("ip_whitelist"):
        score += 15
    else:
        risks.append("No IP whitelist configured")
    score = min(100, score)
    return {"has_password": has_pw, "password_set_at": auth.get("updated_at"),
            "ip_whitelist_enabled": bool(auth.get("ip_whitelist")), "ip_whitelist": auth.get("ip_whitelist", []),
            "security_score": score, "risk_items": risks}


@router.get("")
def security_root():
    """Root endpoint - returns overview info."""
    return get_security_info()


@router.get("/overview")
def security_overview():
    """Return security overview for dashboard widgets."""
    auth = _read_auth()
    has_pw = bool(auth.get("password_hash"))
    is_default = False
    strength = None
    if has_pw:
        # Check if password looks like default patterns
        strength = "unknown"  # Can't check plaintext, report set status
        risks = 1 if not auth.get("ip_whitelist") else 0
    else:
        is_default = True
        strength = "none"
        risks = 2  # no password + no whitelist
    return {
        "hasPassword": has_pw,
        "isDefaultPassword": is_default,
        "passwordStrength": strength,
        "riskCount": risks,
    }


# ── Whititelist endpoints (frontend calls these) ──

@router.get("/whitelist")
def get_whitelist():
    """Return IP whitelist as a plain list of strings."""
    auth = _read_auth()
    return auth.get("ip_whitelist", [])


@router.post("/whitelist")
def add_whitelist(body: WhitelistAdd, request: Request, db: Session = Depends(_get_db)):
    """Add an IP to the whitelist."""
    ip = body.ip.strip()
    if not ip:
        raise HTTPException(400, "IP address required")
    auth = _read_auth()
    wl = auth.get("ip_whitelist", [])
    if ip in wl:
        raise HTTPException(409, "IP already in whitelist")
    wl.append(ip)
    auth["ip_whitelist"] = wl
    _write_auth(auth)
    client_ip = request.client.host if request.client else None
    _audit(db, "whitelist_add", client_ip, "success", f"added {ip}")
    return {"ok": True, "whitelist": wl}


@router.delete("/whitelist")
def remove_whitelist(body: WhitelistRemove, request: Request, db: Session = Depends(_get_db)):
    """Remove an IP from the whitelist."""
    ip = body.ip.strip()
    auth = _read_auth()
    wl = auth.get("ip_whitelist", [])
    if ip not in wl:
        raise HTTPException(404, "IP not in whitelist")
    wl.remove(ip)
    auth["ip_whitelist"] = wl
    _write_auth(auth)
    client_ip = request.client.host if request.client else None
    _audit(db, "whitelist_remove", client_ip, "success", f"removed {ip}")
    return {"ok": True, "whitelist": wl}


# ── Audit logs alias for frontend ──

@router.get("/audit-logs")
def get_audit_logs_frontend(db: Session = Depends(_get_db), range: str = Query("24h")):
    """Audit logs endpoint matching frontend's expected path with range param."""
    # Convert range to minutes offset
    range_minutes = {"1h": 60, "24h": 1440, "7d": 10080}.get(range, 1440)
    from datetime import timedelta
    cutoff = (datetime.now(timezone.utc) - timedelta(minutes=range_minutes)).isoformat()
    logs = db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(100).all()
    # Filter by range client-side (SQLite comparison works with ISO strings)
    filtered = [l for l in logs if l.created_at >= cutoff]
    return [{"id": l.id, "action": l.action, "ip_address": l.ip_address, "result": l.result, "detail": l.detail, "created_at": l.created_at} for l in filtered]
