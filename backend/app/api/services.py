"""Phase 5: Services management API — Gateway status, health, config, backups."""

import json, shutil, os, subprocess, time
from datetime import datetime, timezone
from pathlib import Path
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, Query

router = APIRouter(prefix="/api/services")

OPENCLAW_HOME = Path.home() / ".openclaw"
CONFIG_PATH = OPENCLAW_HOME / "openclaw.json"
BACKUP_DIR = OPENCLAW_HOME / "backups"


def _find_gateway_pid() -> int | None:
    try:
        r = subprocess.run(["pgrep", "-f", "openclaw"], capture_output=True, text=True, timeout=5)
        # Filter out ourselves
        for pid_str in r.stdout.strip().splitlines():
            pid = int(pid_str)
            if pid != os.getpid():
                return pid
    except Exception:
        pass
    return None


def _read_proc_stat(pid: int) -> dict:
    """Read /proc/<pid>/stat and /proc/<pid>/status for CPU/memory info."""
    result = {"pid": pid, "memory_mb": 0.0, "cpu_percent": 0.0, "uptime_seconds": 0, "status": "unknown"}
    try:
        # Memory from /proc/<pid>/status
        with open(f"/proc/{pid}/status") as f:
            for line in f:
                if line.startswith("VmRSS:"):
                    result["memory_mb"] = int(line.split()[1]) / 1024
                elif line.startswith("State:"):
                    state_code = line.split()[1]
                    states = {"R": "running", "S": "sleeping", "T": "stopped", "Z": "zombie", "D": "disk_sleep"}
                    result["status"] = states.get(state_code, state_code)
                elif line.startswith("Threads:"):
                    result["threads"] = int(line.split()[1])

        # CPU from /proc/<pid>/stat (utime+stime)
        with open(f"/proc/{pid}/stat") as f:
            parts = f.read().split(")")
            if len(parts) > 1:
                fields = parts[1].strip().split()
                utime = int(fields[11])
                stime = int(fields[12])
                starttime = int(fields[21])
                hz = os.sysconf(os.sysconf_names["SC_CLK_TCK"])
                btime_path = "/proc/stat"
                with open(btime_path) as bf:
                    for bl in bf:
                        if bl.startswith("btime"):
                            btime = int(bl.split()[1])
                            break
                result["cpu_percent"] = round((utime + stime) / hz, 1)
                result["uptime_seconds"] = int((time.time() - btime - starttime / hz))
    except Exception:
        pass
    return result


def _get_version() -> str:
    try:
        r = subprocess.run(["openclaw", "--version"], capture_output=True, text=True, timeout=5)
        if r.returncode == 0 and r.stdout.strip():
            return r.stdout.strip().split()[-1]
    except Exception:
        pass
    try:
        pkg = OPENCLAW_HOME / "package.json"
        if pkg.exists():
            data = json.loads(pkg.read_text())
            return data.get("version", "unknown")
    except Exception:
        pass
    return "unknown"


def _get_latest_version() -> str:
    try:
        r = subprocess.run(["npm", "view", "openclaw", "version"], capture_output=True, text=True, timeout=10)
        if r.returncode == 0 and r.stdout.strip():
            return r.stdout.strip()
    except Exception:
        pass
    return "unknown"


# ── Schemas ──

class ConfigUpdate(BaseModel):
    config: dict


# ── Endpoints ──

@router.get("/status")
def get_status():
    pid = _find_gateway_pid()
    proc = _read_proc_stat(pid) if pid else {"pid": None, "memory_mb": 0, "cpu_percent": 0, "uptime_seconds": 0, "status": "stopped"}
    return {
        "running": pid is not None,
        "pid": pid,
        "version": _get_version(),
        "status": proc["status"],
        "memory_mb": round(proc["memory_mb"], 1),
        "cpu_seconds": proc["cpu_percent"],
        "uptime_seconds": proc["uptime_seconds"],
        "threads": proc.get("threads", 0),
    }


@router.get("/health")
def get_health():
    pid = _find_gateway_pid()
    proc = _read_proc_stat(pid) if pid else None
    if not proc:
        return {"healthy": False, "details": {"error": "Gateway process not found"}}

    # Check if gateway HTTP responds
    start = time.time()
    gw_ok = False
    try:
        import urllib.request
        urllib.request.urlopen("http://localhost:3155/api/health", timeout=3)
        gw_ok = True
    except Exception:
        pass
    response_ms = round((time.time() - start) * 1000)

    return {
        "healthy": gw_ok,
        "details": {
            "gateway_response_ms": response_ms,
            "memory_mb": round(proc["memory_mb"], 1),
            "cpu_seconds": proc["cpu_percent"],
            "uptime_seconds": proc["uptime_seconds"],
            "threads": proc.get("threads", 0),
        },
    }


@router.get("/info")
def get_info():
    return {
        "current_version": _get_version(),
        "latest_version": _get_latest_version(),
        "up_to_date": _get_version() == _get_latest_version(),
        "checked_at": datetime.now(timezone.utc).isoformat(),
    }


@router.post("/restart")
def restart_gateway():
    """Restart the gateway via openclaw CLI."""
    try:
        subprocess.Popen(["openclaw", "gateway", "restart"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return {"ok": True, "message": "Gateway restart initiated"}
    except Exception as e:
        raise HTTPException(500, f"Restart failed: {e}")


@router.get("/config")
def get_config():
    if not CONFIG_PATH.exists():
        return {"config": {}}
    try:
        return {"config": json.loads(CONFIG_PATH.read_text())}
    except Exception as e:
        raise HTTPException(500, f"Failed to read config: {e}")


@router.post("/config")
def update_config(body: ConfigUpdate):
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    try:
        CONFIG_PATH.write_text(json.dumps(body.config, indent=2, ensure_ascii=False) + "\n")
        return {"ok": True, "message": "Config updated"}
    except Exception as e:
        raise HTTPException(500, f"Failed to write config: {e}")


@router.post("/config/backup")
def backup_config():
    if not CONFIG_PATH.exists():
        raise HTTPException(400, "No config file to backup")
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d-%H%M%S")
    dest = BACKUP_DIR / f"config-{ts}.json"
    shutil.copy2(CONFIG_PATH, dest)
    return {"ok": True, "backup_id": f"config-{ts}", "path": str(dest)}


@router.get("/config/backups")
def list_backups():
    if not BACKUP_DIR.exists():
        return {"backups": []}
    backups = []
    for f in sorted(BACKUP_DIR.glob("config-*.json"), reverse=True):
        stat = f.stat()
        backups.append({
            "id": f.stem,
            "filename": f.name,
            "size_bytes": stat.st_size,
            "created_at": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
        })
    return {"backups": backups}


@router.post("/config/restore/{backup_id}")
def restore_config(backup_id: str):
    src = BACKUP_DIR / f"{backup_id}.json"
    if not src.exists():
        raise HTTPException(404, f"Backup {backup_id} not found")
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d-%H%M%S")
    # Backup current config before restoring
    if CONFIG_PATH.exists():
        shutil.copy2(CONFIG_PATH, BACKUP_DIR / f"config-pre-restore-{ts}.json")
    shutil.copy2(src, CONFIG_PATH)
    return {"ok": True, "message": f"Restored from {backup_id}"}
