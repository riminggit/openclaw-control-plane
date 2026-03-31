"""WebSocket proxy: frontend ↔ backend ↔ OpenClaw Gateway.

Implements full device identity + challenge-response authentication:
1. Generate Ed25519 keypair (or load existing from device.json)
2. Connect to Gateway, receive connect.challenge with nonce
3. Sign challenge payload with private key, send connect with device proof
4. Handle pairing_required by auto-approving via CLI or returning status
5. Store device token for reconnection
6. Bidirectional message forwarding after auth
"""

import asyncio
import hashlib
import json
import logging
import os
import time
from base64 import b64decode, b64encode
from pathlib import Path

import websockets
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ed25519

logger = logging.getLogger(__name__)

router = APIRouter()

# Paths
DEVICE_IDENTITY_PATH = Path(__file__).parent.parent.parent / "device.json"
DEVICE_AUTH_PATH = Path(__file__).parent.parent.parent / "device-auth.json"
OPENCLAW_CONFIG = Path.home() / ".openclaw" / "openclaw.json"
OPENCLAW_STATE_DIR = Path.home() / ".openclaw"


def _base64url_encode(data: bytes) -> str:
    return b64encode(data).decode().replace("+", "-").replace("/", "_").rstrip("=")


def _base64url_decode(s: str) -> bytes:
    s = s.replace("-", "+").replace("_", "/")
    pad = "=" * ((4 - len(s) % 4) % 4)
    return b64decode(s + pad)


# ── Ed25519 identity management ──────────────────────────────────────

def _get_or_create_device_identity() -> dict:
    """Load or generate Ed25519 device identity. Returns {deviceId, publicKeyPem, privateKeyPem}."""
    if DEVICE_IDENTITY_PATH.exists():
        try:
            data = json.loads(DEVICE_IDENTITY_PATH.read_text())
            if data.get("version") == 1 and data.get("deviceId") and data.get("publicKeyPem") and data.get("privateKeyPem"):
                return data
        except Exception:
            pass

    # Generate new Ed25519 keypair
    private_key = ed25519.Ed25519PrivateKey.generate()
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode()

    public_key = private_key.public_key()
    public_pem = public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    ).decode()

    # Derive deviceId from raw public key (same as OpenClaw: sha256 of raw ed25519 key)
    # The raw key is the last 32 bytes of the SPKI DER export
    spki_der = public_key.public_bytes(
        encoding=serialization.Encoding.DER,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    # ED25519 SPKI prefix: 302a300506032b6570032100
    raw_public_key = spki_der[12:]  # skip the prefix
    device_id = hashlib.sha256(raw_public_key).hexdigest()

    identity = {
        "version": 1,
        "deviceId": device_id,
        "publicKeyPem": public_pem,
        "privateKeyPem": private_pem,
        "createdAtMs": int(time.time() * 1000),
    }
    DEVICE_IDENTITY_PATH.write_text(json.dumps(identity, indent=2) + "\n")
    os.chmod(DEVICE_IDENTITY_PATH, 0o600)
    logger.info("Generated new device identity: %s", device_id)
    return identity


def _get_public_key_raw_base64url(public_key_pem: str) -> str:
    """Extract raw Ed25519 public key bytes and return base64url."""
    from cryptography.hazmat.primitives.serialization import load_pem_public_key
    pub = load_pem_public_key(public_key_pem.encode())
    spki_der = pub.public_bytes(
        encoding=serialization.Encoding.DER,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    raw = spki_der[12:]  # ED25519 prefix is 12 bytes
    return _base64url_encode(raw)


def _sign_payload(private_key_pem: str, payload: str) -> str:
    """Sign a UTF-8 payload with Ed25519 private key, return base64url signature."""
    from cryptography.hazmat.primitives.serialization import load_pem_private_key
    key = load_pem_private_key(private_key_pem.encode(), password=None)
    sig = key.sign(payload.encode("utf-8"))
    return _base64url_encode(sig)


def _build_device_auth_payload_v3(params: dict) -> str:
    """Build the challenge-response payload string (v3 format)."""
    scopes = ",".join(params.get("scopes", []))
    token = params.get("token") or ""
    platform = params.get("platform", "linux")
    device_family = params.get("deviceFamily", "server")
    return "|".join([
        "v3",
        params["deviceId"],
        params["clientId"],
        params["clientMode"],
        params["role"],
        scopes,
        str(params["signedAtMs"]),
        token,
        params["nonce"],
        platform,
        device_family,
    ])


# ── Device token storage ─────────────────────────────────────────────

def _load_device_auth_token(device_id: str, role: str) -> str | None:
    """Load stored device token for reconnection."""
    try:
        # Try local store first
        if DEVICE_AUTH_PATH.exists():
            data = json.loads(DEVICE_AUTH_PATH.read_text())
            if data.get("deviceId") == device_id:
                entry = data.get("tokens", {}).get(role)
                if entry and entry.get("token"):
                    return entry["token"]
    except Exception:
        pass
    return None


def _save_device_auth_token(device_id: str, role: str, token: str, scopes: list):
    """Save device token for future reconnections."""
    try:
        existing = {}
        if DEVICE_AUTH_PATH.exists():
            existing = json.loads(DEVICE_AUTH_PATH.read_text())
        existing.update({
            "version": 1,
            "deviceId": device_id,
            "tokens": {
                **existing.get("tokens", {}),
                role: {"token": token, "role": role, "scopes": scopes, "updatedAtMs": int(time.time() * 1000)},
            },
        })
        DEVICE_AUTH_PATH.write_text(json.dumps(existing, indent=2) + "\n")
        os.chmod(DEVICE_AUTH_PATH, 0o600)
    except Exception as e:
        logger.warning("Failed to save device auth token: %s", e)


# ── Gateway URL resolution ───────────────────────────────────────────

def _get_gateway_ws_url() -> str:
    """Resolve Gateway WebSocket URL from config or defaults."""
    try:
        if OPENCLAW_CONFIG.exists():
            data = json.loads(OPENCLAW_CONFIG.read_text())
            gw = data.get("gateway", {})
            bind = gw.get("bind", "loopback")
            port = gw.get("port", 18789)
            if bind == "loopback":
                return f"ws://127.0.0.1:{port}/"
            elif bind == "all":
                return f"ws://0.0.0.0:{port}/"
    except Exception:
        pass
    return "ws://127.0.0.1:18789/"


def _get_gateway_token() -> str:
    """Read static gateway auth token from openclaw.json (fallback)."""
    try:
        data = json.loads(OPENCLAW_CONFIG.read_text())
        return data.get("gateway", {}).get("auth", {}).get("token", "")
    except Exception:
        return ""


# ── Pairing approval via CLI ─────────────────────────────────────────

def _auto_approve_pairing(request_id: str) -> bool:
    """Try to auto-approve a device pairing request via openclaw CLI."""
    try:
        import subprocess
        result = subprocess.run(
            ["openclaw", "devices", "approve", request_id],
            capture_output=True, text=True, timeout=10,
            env={**os.environ, "OPENCLAW_ALLOW_INSECURE_PRIVATE_WS": "1"},
        )
        if result.returncode == 0:
            logger.info("Auto-approved device pairing: %s", request_id)
            return True
        logger.warning("Auto-approve failed: %s", result.stderr)
    except Exception as e:
        logger.warning("Auto-approve error: %s", e)
    return False


# ── WebSocket proxy with device auth ─────────────────────────────────

@router.websocket("/ws/gateway")
async def ws_gateway_proxy(client_ws: WebSocket):
    await client_ws.accept()

    gateway_url = _get_gateway_ws_url()
    identity = _get_or_create_device_identity()
    device_id = identity["deviceId"]
    role = "operator"
    scopes = ["operator.admin"]

    # Connect to upstream Gateway
    try:
        gw_ws = await websockets.connect(gateway_url)
    except Exception as e:
        logger.error("Cannot connect to Gateway at %s: %s", gateway_url, e)
        await client_ws.close(code=1011, reason=f"Gateway unreachable: {e}")
        return

    logger.info("Connected to Gateway at %s (device: %s)", gateway_url, device_id[:12])

    # Step 1: Wait for connect.challenge
    try:
        challenge_raw = await asyncio.wait_for(gw_ws.recv(), timeout=10)
        challenge = json.loads(challenge_raw)
        if challenge.get("event") != "connect.challenge":
            logger.error("Expected connect.challenge, got: %s", challenge.get("event"))
            await client_ws.close(code=1011, reason="Protocol error: expected challenge")
            return
        nonce = challenge.get("payload", {}).get("nonce", "")
        if not nonce:
            await client_ws.close(code=1011, reason="No nonce in challenge")
            return
    except asyncio.TimeoutError:
        await client_ws.close(code=1011, reason="Gateway did not send challenge")
        return

    # Step 2: Build signed connect frame
    signed_at_ms = int(time.time() * 1000)
    device_auth_payload = _build_device_auth_payload_v3({
        "deviceId": device_id,
        "clientId": "control-plane",
        "clientMode": "backend",
        "role": role,
        "scopes": scopes,
        "signedAtMs": signed_at_ms,
        "token": "",  # no stored token on first connect
        "nonce": nonce,
        "platform": "linux",
        "deviceFamily": "server",
    })
    signature = _sign_payload(identity["privateKeyPem"], device_auth_payload)
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

    # Include gateway token for auth
    static_token = _get_gateway_token()
    if static_token:
        connect_frame["params"]["auth"] = {"token": static_token}

    await gw_ws.send(json.dumps(connect_frame))

    # Step 3: Wait for connect response
    try:
        response_raw = await asyncio.wait_for(gw_ws.recv(), timeout=10)
        response = json.loads(response_raw)
    except asyncio.TimeoutError:
        await client_ws.close(code=1011, reason="Gateway did not respond to connect")
        return

    resp_id = response.get("id")
    if resp_id != "connect-1" or response.get("type") != "res":
        # Could be an event or error - forward to client
        await client_ws.send_text(response_raw)
        # Check for pairing required
        if response.get("type") == "res" and response.get("error"):
            err = response["error"]
            if "pairing" in json.dumps(err).lower() or "pair" in json.dumps(err).lower():
                # Try auto-approve
                pairing_info = err.get("detail", {})
                request_id = pairing_info.get("requestId") or pairing_info.get("pairingRequestId")
                if request_id:
                    if _auto_approve_pairing(request_id):
                        await client_ws.send_text(json.dumps({
                            "type": "event",
                            "event": "pairing.auto_approved",
                            "payload": {"requestId": request_id},
                        }))
                        # Retry connection after approval
                        try:
                            retry_raw = await asyncio.wait_for(gw_ws.recv(), timeout=5)
                            # New challenge after reconnection
                            retry_challenge = json.loads(retry_raw)
                            if retry_challenge.get("event") == "connect.challenge":
                                new_nonce = retry_challenge.get("payload", {}).get("nonce", "")
                                new_signed_at = int(time.time() * 1000)
                                new_payload = _build_device_auth_payload_v3({
                                    "deviceId": device_id,
                                    "clientId": "control-plane",
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
                                response_raw = await asyncio.wait_for(gw_ws.recv(), timeout=10)
                                response = json.loads(response_raw)
                        except Exception as retry_err:
                            await client_ws.close(code=1011, reason=f"Pairing retry failed: {retry_err}")
                            return

        # Check final result
        if response.get("error"):
            await client_ws.send_text(response_raw)
            logger.error("Gateway connect error: %s", response.get("error"))
            await client_ws.close(code=1008, reason="Auth failed")
            return
    else:
        # Successful connect - store device token if provided
        result = response.get("result", {})
        auth_info = result.get("auth", {})
        device_token = auth_info.get("deviceToken")
        if device_token:
            _save_device_auth_token(device_id, role, device_token, auth_info.get("scopes", scopes))
            logger.info("Stored device token for %s", device_id[:12])

    # Send connect success to client
    await client_ws.send_text(json.dumps({
        "type": "event",
        "event": "gateway.connected",
        "payload": {
            "deviceId": device_id,
            "gatewayUrl": gateway_url,
            "role": role,
        },
    }))

    logger.info("Gateway auth successful, starting bidirectional proxy")

    # Step 4: Bidirectional forwarding
    async def client_to_gateway():
        try:
            async for raw in client_ws.iter_text():
                if raw:
                    await gw_ws.send(raw)
        except Exception:
            pass
        finally:
            try:
                await gw_ws.close()
            except Exception:
                pass

    async def gateway_to_client():
        try:
            async for raw in gw_ws:
                await client_ws.send_text(raw)
        except Exception:
            pass
        finally:
            try:
                await client_ws.close()
            except Exception:
                pass

    try:
        t1 = asyncio.create_task(client_to_gateway())
        t2 = asyncio.create_task(gateway_to_client())
        done, pending = await asyncio.wait([t1, t2], return_when=asyncio.FIRST_COMPLETED)
        for t in pending:
            t.cancel()
    except Exception:
        pass
    finally:
        logger.info("WebSocket proxy disconnected")
