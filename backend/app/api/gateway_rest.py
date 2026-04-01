"""REST fallback endpoints for Gateway data.

When WebSocket connection fails (auth/CORS issues), these endpoints
provide a HTTP alternative to fetch sessions, cron jobs, status, etc.
They connect to Gateway temporarily using the same device auth as ws_proxy.
"""

import asyncio
import json
import logging
import time
from typing import Optional

import websockets
from fastapi import APIRouter, HTTPException, Query

from app.api.ws_proxy import (
    _get_gateway_ws_url,
    _get_or_create_device_identity,
    _get_gateway_token,
    _build_device_auth_payload_v3,
    _sign_payload,
    _get_public_key_raw_base64url,
    _save_device_auth_token,
    _load_device_auth_token,
    _auto_approve_pairing,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/gateway")


async def _gateway_rpc(method: str, params: dict = None, timeout: float = 10.0) -> dict:
    """Connect to Gateway, authenticate, send one RPC call, return result."""
    gateway_url = _get_gateway_ws_url()
    identity = _get_or_create_device_identity()
    device_id = identity["deviceId"]
    role = "operator"
    scopes = ["operator.read", "operator.write", "operator.admin", "operator.approvals", "operator.pairing"]

    gw_ws = None
    try:
        gw_ws = await websockets.connect(gateway_url)

        # Wait for challenge
        challenge_raw = await asyncio.wait_for(gw_ws.recv(), timeout=5)
        challenge = json.loads(challenge_raw)
        nonce = challenge.get("payload", {}).get("nonce", "")

        # Build connect frame
        signed_at_ms = int(time.time() * 1000)
        payload_str = _build_device_auth_payload_v3({
            "deviceId": device_id,
            "clientId": "gateway-client",
            "clientMode": "backend",
            "role": role,
            "scopes": scopes,
            "signedAtMs": signed_at_ms,
            "token": _get_gateway_token(),
            "nonce": nonce,
            "platform": "linux",
            "deviceFamily": "server",
        })
        signature = _sign_payload(identity["privateKeyPem"], payload_str)
        public_key_b64url = _get_public_key_raw_base64url(identity["publicKeyPem"])

        connect_frame = {
            "type": "req",
            "id": "connect-1",
            "method": "connect",
            "params": {
                "minProtocol": 3,
                "maxProtocol": 3,
                "role": role,
                "scopes": scopes,
                "device": {
                    "id": device_id,
                    "publicKey": public_key_b64url,
                    "signature": signature,
                    "signedAt": signed_at_ms,
                    "nonce": nonce,
                },
                "client": {
                    "id": "gateway-client",
                    "displayName": "OpenClaw Control Plane",
                    "version": "0.2.0",
                    "mode": "backend",
                    "platform": "linux",
                    "deviceFamily": "server",
                },
            },
        }
        static_token = _get_gateway_token()
        if static_token:
            connect_frame["params"]["auth"] = {"token": static_token}

        await gw_ws.send(json.dumps(connect_frame))

        # Wait for connect response
        response_raw = await asyncio.wait_for(gw_ws.recv(), timeout=5)
        response = json.loads(response_raw)

        if response.get("error"):
            # Try auto-approve pairing
            err = response.get("error", {})
            detail = err.get("detail", {})
            request_id = detail.get("requestId") or detail.get("pairingRequestId")
            if request_id and _auto_approve_pairing(request_id):
                # Retry after approval
                retry_raw = await asyncio.wait_for(gw_ws.recv(), timeout=5)
                retry_challenge = json.loads(retry_raw)
                if retry_challenge.get("event") == "connect.challenge":
                    new_nonce = retry_challenge.get("payload", {}).get("nonce", "")
                    new_signed_at = int(time.time() * 1000)
                    new_payload = _build_device_auth_payload_v3({
                        "deviceId": device_id,
                        "clientId": "gateway-client",
                        "clientMode": "backend",
                        "role": role,
                        "scopes": scopes,
                        "signedAtMs": new_signed_at,
                        "token": "",
                        "nonce": new_nonce,
                        "platform": "linux",
                        "deviceFamily": "server",
                    })
                    new_sig = _sign_payload(identity["privateKeyPem"], new_payload)
                    connect_frame["id"] = "connect-2"
                    connect_frame["params"]["device"].update({
                        "signature": new_sig,
                        "signedAt": new_signed_at,
                        "nonce": new_nonce,
                    })
                    await gw_ws.send(json.dumps(connect_frame))
                    response_raw = await asyncio.wait_for(gw_ws.recv(), timeout=5)
                    response = json.loads(response_raw)
                    if response.get("error"):
                        return {"ok": False, "error": response.get("error")}
            else:
                return {"ok": False, "error": err}

        # Store device token
        resp_payload = response.get("payload", {})
        auth_info = resp_payload.get("auth", {})
        device_token = auth_info.get("device_token")
        if device_token:
            _save_device_auth_token(device_id, role, device_token, auth_info.get("scopes", scopes))

        # Now send the actual RPC
        rpc_id = "rest-1"
        await gw_ws.send(json.dumps({
            "type": "req",
            "id": rpc_id,
            "method": method,
            "params": params or {},
        }))

        # Collect responses until we get our rpc_id
        while True:
            msg_raw = await asyncio.wait_for(gw_ws.recv(), timeout=timeout)
            msg = json.loads(msg_raw)
            if msg.get("id") == rpc_id and msg.get("type") == "res":
                return msg
            # Skip events (health, tick, etc.)

    except asyncio.TimeoutError:
        return {"ok": False, "error": {"message": "Gateway timeout"}}
    except Exception as e:
        logger.error("Gateway RPC %s failed: %s", method, e)
        return {"ok": False, "error": {"message": str(e)}}
    finally:
        if gw_ws:
            try:
                await gw_ws.close()
            except Exception:
                pass


@router.get("/sessions")
async def get_sessions(limit: int = Query(50, ge=1, le=200), active_minutes: int = Query(1440)):
    """REST fallback for sessions.list via Gateway RPC."""
    result = await _gateway_rpc("sessions.list", {"limit": limit, "activeMinutes": active_minutes})
    if result.get("ok"):
        return result.get("payload", {})
    raise HTTPException(502, detail=f"Gateway error: {result.get('error', {})}")


@router.get("/cron-jobs")
async def get_cron_jobs(include_disabled: bool = True):
    """REST fallback for cron.list via Gateway RPC."""
    result = await _gateway_rpc("cron.list", {"includeDisabled": include_disabled})
    if result.get("ok"):
        return result.get("payload", {})
    raise HTTPException(502, detail=f"Gateway error: {result.get('error', {})}")


@router.get("/status")
async def get_status():
    """REST fallback for Gateway status."""
    result = await _gateway_rpc("status", {})
    if result.get("ok"):
        return result.get("payload", {})
    raise HTTPException(502, detail=f"Gateway error: {result.get('error', {})}")


@router.get("/health")
async def get_health():
    """REST fallback for Gateway health."""
    result = await _gateway_rpc("health", {})
    if result.get("ok"):
        return result.get("payload", {})
    raise HTTPException(502, detail=f"Gateway error: {result.get('error', {})}")


@router.get("/models")
async def get_models():
    """REST fallback for models.list via Gateway RPC."""
    result = await _gateway_rpc("models.list", {})
    if result.get("ok"):
        return result.get("payload", {})
    raise HTTPException(502, detail=f"Gateway error: {result.get('error', {})}")
