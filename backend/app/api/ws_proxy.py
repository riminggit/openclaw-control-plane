"""WebSocket proxy: frontend ↔ backend ↔ OpenClaw Gateway."""

import asyncio
import json
import logging
from pathlib import Path

import websockets
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)

router = APIRouter()

GATEWAY_WS_URL = "ws://127.0.0.1:18789/"
OPENCLAW_CONFIG = Path.home() / ".openclaw" / "openclaw.json"


def _get_gateway_token() -> str:
    """Read gateway auth token from openclaw.json."""
    try:
        data = json.loads(OPENCLAW_CONFIG.read_text())
        return data.get("gateway", {}).get("auth", {}).get("token", "")
    except Exception:
        logger.warning("Failed to read gateway token from %s", OPENCLAW_CONFIG)
        return ""


@router.websocket("/ws/gateway")
async def ws_gateway_proxy(client_ws: WebSocket):
    await client_ws.accept()

    token = _get_gateway_token()
    if not token:
        logger.error("No gateway token found, cannot proxy")
        await client_ws.close(code=1011, reason="No gateway token configured on server")
        return

    # Connect to upstream Gateway
    try:
        gw_ws = await websockets.connect(GATEWAY_WS_URL)
    except Exception as e:
        logger.error("Cannot connect to Gateway at %s: %s", GATEWAY_WS_URL, e)
        await client_ws.close(code=1011, reason="Gateway unreachable")
        return

    logger.info("WebSocket proxy connected: client ↔ Gateway")

    # Send connect frame with token on behalf of the client
    connect_frame = json.dumps({
        "type": "req",
        "id": 0,
        "method": "connect",
        "params": {"auth": {"token": token}, "role": "client"},
    })
    await gw_ws.send(connect_frame)

    # Bidirectional forwarding
    async def client_to_gateway():
        try:
            async for raw in client_ws.iter_text():
                if raw:
                    await gw_ws.send(raw)
        except Exception:
            pass
        finally:
            await gw_ws.close()

    async def gateway_to_client():
        try:
            async for raw in gw_ws:
                await client_ws.send_text(raw)
        except Exception:
            pass
        finally:
            await client_ws.close()

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
