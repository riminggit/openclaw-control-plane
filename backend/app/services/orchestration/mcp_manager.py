"""
MCPManager — Dynamic MCP tool discovery and lifecycle management.

Manages MCP (Model Context Protocol) server connections, discovers available
tools, and provides a unified tool registry for the orchestration engine.

Reference: Claude Code src/services/mcp/
"""

from __future__ import annotations

import asyncio
import json
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Callable, Optional
from uuid import uuid4

from sqlalchemy.orm import Session

from app.models.orchestration import MCPServerConfig, MCPToolSnapshot

logger = logging.getLogger(__name__)


# ============================================================
# Constants
# ============================================================

TRANSPORT_STDIO = "stdio"
TRANSPORT_SSE = "sse"
TRANSPORT_STREAMABLE_HTTP = "streamable_http"

SERVER_STATUS_DISCONNECTED = "disconnected"
SERVER_STATUS_CONNECTING = "connecting"
SERVER_STATUS_CONNECTED = "connected"
SERVER_STATUS_ERROR = "error"

DEFAULT_DISCOVERY_INTERVAL = 300  # seconds
DEFAULT_TOOL_TIMEOUT = 30  # seconds


# ============================================================
# Data Types
# ============================================================

@dataclass
class MCPServerInfo:
    """Information about an MCP server."""
    id: str
    name: str
    transport_type: str
    connection_config: dict[str, Any]
    status: str = SERVER_STATUS_DISCONNECTED
    tool_count: int = 0
    enabled: bool = True
    last_discovered_at: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "transport_type": self.transport_type,
            "connection_config": self.connection_config,
            "status": self.status,
            "tool_count": self.tool_count,
            "enabled": self.enabled,
            "last_discovered_at": self.last_discovered_at,
        }


@dataclass
class MCPToolInfo:
    """Information about a discovered MCP tool."""
    id: str
    server_id: str
    tool_name: str
    server_name: str = ""
    description: str = ""
    input_schema: dict[str, Any] = field(default_factory=dict)
    output_schema: dict[str, Any] = field(default_factory=dict)
    version: str = "1.0.0"

    @property
    def full_name(self) -> str:
        """Fully qualified tool name: server_name__tool_name."""
        if self.server_name:
            return f"{self.server_name}__{self.tool_name}"
        return self.tool_name

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "server_id": self.server_id,
            "server_name": self.server_name,
            "tool_name": self.tool_name,
            "full_name": self.full_name,
            "description": self.description,
            "input_schema": self.input_schema,
            "output_schema": self.output_schema,
            "version": self.version,
        }


@dataclass
class ToolCallResult:
    """Result of calling an MCP tool."""
    tool_name: str
    success: bool
    output: Any = None
    error: Optional[str] = None
    duration_ms: int = 0


@dataclass
class DiscoveryResult:
    """Result of a tool discovery operation."""
    server_id: str
    tools_discovered: int
    tools_added: int
    tools_removed: int
    tools_updated: int
    total_tools: int
    duration_ms: int = 0


# ============================================================
# MCP Transport Abstraction
# ============================================================

class MCPTransport:
    """
    Abstract transport for MCP server communication.

    In production, this would use the actual MCP SDK client.
    For now, provides a pluggable interface for different transports.
    """

    def __init__(self, config: dict[str, Any]):
        self._config = config
        self._connected = False

    async def connect(self) -> bool:
        """Establish connection to MCP server."""
        # Placeholder: in production, use mcp.ClientSession
        self._connected = True
        return True

    async def disconnect(self) -> None:
        """Disconnect from MCP server."""
        self._connected = False

    async def list_tools(self) -> list[dict[str, Any]]:
        """
        Discover available tools from the MCP server.

        Returns list of tool definitions in MCP format:
        [{"name": "...", "description": "...", "inputSchema": {...}}]
        """
        if not self._connected:
            return []
        # Placeholder: in production, call server.list_tools()
        return []

    async def call_tool(self, tool_name: str, arguments: dict[str, Any]) -> Any:
        """Call a tool on the MCP server."""
        if not self._connected:
            raise RuntimeError("Not connected to MCP server")
        # Placeholder: in production, call server.call_tool(name, args)
        return None

    @property
    def is_connected(self) -> bool:
        return self._connected


class StdioTransport(MCPTransport):
    """Stdio-based MCP transport (subprocess communication)."""

    def __init__(self, config: dict[str, Any]):
        super().__init__(config)
        self._command = config.get("command", "")
        self._args = config.get("args", [])
        self._env = config.get("env", {})
        self._process: Optional[asyncio.subprocess.Process] = None

    async def connect(self) -> bool:
        try:
            self._process = await asyncio.create_subprocess_exec(
                self._command,
                *self._args,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env={**self._env},
            )
            self._connected = True
            return True
        except Exception as e:
            logger.error(f"Failed to start MCP server process: {e}")
            return False

    async def disconnect(self) -> None:
        if self._process:
            self._process.terminate()
            await self._process.wait()
        self._connected = False


class SSETransport(MCPTransport):
    """Server-Sent Events MCP transport."""

    def __init__(self, config: dict[str, Any]):
        super().__init__(config)
        self._url = config.get("url", "")
        self._headers = config.get("headers", {})


class StreamableHTTPTransport(MCPTransport):
    """Streamable HTTP MCP transport."""

    def __init__(self, config: dict[str, Any]):
        super().__init__(config)
        self._url = config.get("url", "")
        self._headers = config.get("headers", {})


# ============================================================
# MCP Tool Registry (in-memory)
# ============================================================

class MCPToolRegistry:
    """
    In-memory registry of all discovered MCP tools.

    Provides fast lookup for tool resolution during orchestration.
    """

    def __init__(self):
        self._tools: dict[str, MCPToolInfo] = {}  # full_name -> tool info
        self._server_tools: dict[str, list[str]] = {}  # server_id -> [full_names]

    def register(self, tool: MCPToolInfo) -> None:
        """Register a tool."""
        self._tools[tool.full_name] = tool
        if tool.server_id not in self._server_tools:
            self._server_tools[tool.server_id] = []
        if tool.full_name not in self._server_tools[tool.server_id]:
            self._server_tools[tool.server_id].append(tool.full_name)

    def unregister(self, full_name: str) -> None:
        """Unregister a tool."""
        tool = self._tools.pop(full_name, None)
        if tool and tool.server_id in self._server_tools:
            self._server_tools[tool.server_id] = [
                n for n in self._server_tools[tool.server_id] if n != full_name
            ]

    def unregister_server(self, server_id: str) -> None:
        """Unregister all tools from a server."""
        names = self._server_tools.pop(server_id, [])
        for name in names:
            self._tools.pop(name, None)

    def get(self, full_name: str) -> Optional[MCPToolInfo]:
        """Get a tool by full name."""
        return self._tools.get(full_name)

    def get_by_short_name(self, tool_name: str) -> list[MCPToolInfo]:
        """Get tools by short name (may return multiple from different servers)."""
        return [t for t in self._tools.values() if t.tool_name == tool_name]

    def get_server_tools(self, server_id: str) -> list[MCPToolInfo]:
        """Get all tools for a server."""
        names = self._server_tools.get(server_id, [])
        return [self._tools[n] for n in names if n in self._tools]

    def search(self, query: str) -> list[MCPToolInfo]:
        """Search tools by name or description."""
        query_lower = query.lower()
        results = []
        for tool in self._tools.values():
            if (query_lower in tool.tool_name.lower() or
                    query_lower in tool.description.lower() or
                    query_lower in tool.full_name.lower()):
                results.append(tool)
        return results

    def get_all(self) -> list[MCPToolInfo]:
        """Get all registered tools."""
        return list(self._tools.values())

    def get_all_grouped(self) -> dict[str, list[MCPToolInfo]]:
        """Get all tools grouped by server."""
        result = {}
        for server_id, names in self._server_tools.items():
            result[server_id] = [self._tools[n] for n in names if n in self._tools]
        return result

    @property
    def tool_count(self) -> int:
        return len(self._tools)

    def clear(self) -> None:
        self._tools.clear()
        self._server_tools.clear()


# ============================================================
# MCPManager
# ============================================================

class MCPManager:
    """
    Dynamic MCP tool discovery and lifecycle management.

    Responsibilities:
    1. Manage MCP server connections (add/remove/configure)
    2. Discover available tools from connected servers
    3. Maintain a unified tool registry for orchestration
    4. Route tool calls to the appropriate server
    5. Handle server health monitoring and reconnection

    Design follows Claude Code's MCP integration:
    - Dynamic tool discovery on server connect
    - Tool snapshot persistence for offline access
    - Namespace-based tool resolution (server__tool)
    - Transport abstraction (stdio, SSE, streamable-http)

    Reference: Claude Code src/services/mcp/mcpManager.ts
    """

    def __init__(
        self,
        db: Optional[Session] = None,
        discovery_interval: int = DEFAULT_DISCOVERY_INTERVAL,
        tool_timeout: int = DEFAULT_TOOL_TIMEOUT,
    ):
        self._db = db
        self._discovery_interval = discovery_interval
        self._tool_timeout = tool_timeout

        # In-memory state
        self._registry = MCPToolRegistry()
        self._servers: dict[str, MCPServerInfo] = {}
        self._transports: dict[str, MCPTransport] = {}
        self._discovery_task: Optional[asyncio.Task] = None

        # Callbacks
        self._on_tools_changed: list[Callable] = []

    # ── Server Lifecycle ───────────────────────────────────

    def register_server(
        self,
        name: str,
        transport_type: str = TRANSPORT_STDIO,
        connection_config: dict[str, Any] | None = None,
        enabled: bool = True,
        tenant_id: Optional[str] = None,
    ) -> MCPServerInfo:
        """
        Register a new MCP server.

        Args:
            name: Unique server name
            transport_type: Transport protocol (stdio/sse/streamable_http)
            connection_config: Transport-specific configuration
            enabled: Whether server is active
            tenant_id: Optional tenant isolation

        Returns:
            MCPServerInfo for the registered server
        """
        server_id = f"mcp-{uuid4().hex[:12]}"
        now = datetime.now(timezone.utc).isoformat()

        info = MCPServerInfo(
            id=server_id,
            name=name,
            transport_type=transport_type,
            connection_config=connection_config or {},
            status=SERVER_STATUS_DISCONNECTED,
            enabled=enabled,
        )
        self._servers[server_id] = info

        # Create transport
        transport = self._create_transport(transport_type, connection_config or {})
        self._transports[server_id] = transport

        # Persist to database
        if self._db:
            self._persist_server(server_id, name, transport_type,
                                 connection_config or {}, enabled, tenant_id, now)

        logger.info(f"Registered MCP server: {name} ({transport_type})")
        return info

    def remove_server(self, server_id: str) -> bool:
        """
        Remove an MCP server and all its tools.

        Args:
            server_id: Server ID to remove

        Returns:
            True if server was found and removed
        """
        if server_id not in self._servers:
            return False

        info = self._servers.pop(server_id)
        self._transports.pop(server_id, None)
        self._registry.unregister_server(server_id)

        # Remove from database
        if self._db:
            self._db.query(MCPToolSnapshot).filter_by(server_id=server_id).delete()
            self._db.query(MCPServerConfig).filter_by(id=server_id).delete()
            self._db.commit()

        logger.info(f"Removed MCP server: {info.name}")
        return True

    def get_server(self, server_id: str) -> Optional[MCPServerInfo]:
        """Get server info by ID."""
        return self._servers.get(server_id)

    def get_server_by_name(self, name: str) -> Optional[MCPServerInfo]:
        """Get server info by name."""
        for server in self._servers.values():
            if server.name == name:
                return server
        return None

    def list_servers(self) -> list[MCPServerInfo]:
        """List all registered servers."""
        return list(self._servers.values())

    # ── Connection Management ──────────────────────────────

    async def connect_server(self, server_id: str) -> bool:
        """
        Connect to an MCP server and discover its tools.

        Args:
            server_id: Server ID to connect

        Returns:
            True if connection successful
        """
        info = self._servers.get(server_id)
        transport = self._transports.get(server_id)
        if not info or not transport:
            logger.error(f"Server {server_id} not found")
            return False

        if not info.enabled:
            logger.warning(f"Server {info.name} is disabled, skipping connect")
            return False

        info.status = SERVER_STATUS_CONNECTING
        self._update_server_status(server_id, SERVER_STATUS_CONNECTING)

        try:
            success = await transport.connect()
            if not success:
                info.status = SERVER_STATUS_ERROR
                self._update_server_status(server_id, SERVER_STATUS_ERROR)
                return False

            info.status = SERVER_STATUS_CONNECTED
            self._update_server_status(server_id, SERVER_STATUS_CONNECTED)

            # Discover tools
            await self.discover_tools(server_id)

            logger.info(f"Connected to MCP server: {info.name}")
            return True

        except Exception as e:
            logger.error(f"Failed to connect to MCP server {info.name}: {e}")
            info.status = SERVER_STATUS_ERROR
            self._update_server_status(server_id, SERVER_STATUS_ERROR)
            return False

    async def disconnect_server(self, server_id: str) -> None:
        """Disconnect from an MCP server."""
        info = self._servers.get(server_id)
        transport = self._transports.get(server_id)
        if not info or not transport:
            return

        await transport.disconnect()
        info.status = SERVER_STATUS_DISCONNECTED
        self._update_server_status(server_id, SERVER_STATUS_DISCONNECTED)

        # Clear tools from registry (keep snapshots in DB)
        self._registry.unregister_server(server_id)

        logger.info(f"Disconnected from MCP server: {info.name}")

    async def connect_all(self) -> dict[str, bool]:
        """Connect to all enabled servers."""
        results = {}
        for server_id, info in self._servers.items():
            if info.enabled:
                results[server_id] = await self.connect_server(server_id)
        return results

    async def disconnect_all(self) -> None:
        """Disconnect from all servers."""
        for server_id in list(self._servers.keys()):
            await self.disconnect_server(server_id)

    # ── Tool Discovery ─────────────────────────────────────

    async def discover_tools(self, server_id: str) -> DiscoveryResult:
        """
        Discover tools from a connected MCP server.

        Compares discovered tools with existing snapshots:
        - New tools are added
        - Changed tools are updated
        - Missing tools are removed

        Args:
            server_id: Server ID to discover tools from

        Returns:
            DiscoveryResult with discovery statistics
        """
        start_time = datetime.now(timezone.utc)
        info = self._servers.get(server_id)
        transport = self._transports.get(server_id)

        if not info or not transport or not transport.is_connected:
            return DiscoveryResult(
                server_id=server_id,
                tools_discovered=0,
                tools_added=0,
                tools_removed=0,
                tools_updated=0,
                total_tools=0,
            )

        # Get tools from server
        raw_tools = await transport.list_tools()

        # Get existing snapshots from DB
        existing_snapshots = self._get_existing_snapshots(server_id)
        existing_by_name = {s["tool_name"]: s for s in existing_snapshots}

        tools_added = 0
        tools_updated = 0
        tools_removed = 0
        discovered_names = set()

        for raw_tool in raw_tools:
            tool_name = raw_tool.get("name", "")
            if not tool_name:
                continue

            discovered_names.add(tool_name)
            description = raw_tool.get("description", "")
            input_schema = raw_tool.get("inputSchema", {})
            output_schema = raw_tool.get("outputSchema", {})

            # Create tool info
            tool_info = MCPToolInfo(
                id=f"tool-{uuid4().hex[:12]}",
                server_id=server_id,
                server_name=info.name,
                tool_name=tool_name,
                description=description,
                input_schema=input_schema,
                output_schema=output_schema,
            )

            if tool_name in existing_by_name:
                # Check if tool changed
                existing = existing_by_name[tool_name]
                existing_input = existing.get("input_schema", "")
                if isinstance(existing_input, str):
                    try:
                        existing_input = json.loads(existing_input)
                    except json.JSONDecodeError:
                        existing_input = {}

                if existing_input != input_schema or existing.get("description", "") != description:
                    tools_updated += 1
                    self._update_tool_snapshot(
                        server_id, tool_name, description,
                        input_schema, output_schema,
                    )
            else:
                # New tool
                tools_added += 1
                self._create_tool_snapshot(
                    tool_info.id, server_id, tool_name, description,
                    input_schema, output_schema,
                )

            # Register in memory
            self._registry.register(tool_info)

        # Remove tools that no longer exist
        for existing_name in existing_by_name:
            if existing_name not in discovered_names:
                tools_removed += 1
                self._registry.unregister(f"{info.name}__{existing_name}")
                self._remove_tool_snapshot(server_id, existing_name)

        # Update server stats
        info.tool_count = len(discovered_names)
        info.last_discovered_at = datetime.now(timezone.utc).isoformat()
        self._update_server_tool_count(server_id, info.tool_count, info.last_discovered_at)

        # Notify listeners
        self._notify_tools_changed()

        end_time = datetime.now(timezone.utc)
        duration_ms = int((end_time - start_time).total_seconds() * 1000)

        result = DiscoveryResult(
            server_id=server_id,
            tools_discovered=len(raw_tools),
            tools_added=tools_added,
            tools_removed=tools_removed,
            tools_updated=tools_updated,
            total_tools=info.tool_count,
            duration_ms=duration_ms,
        )

        logger.info(
            f"Tool discovery for {info.name}: "
            f"{result.tools_discovered} found, {tools_added} added, "
            f"{tools_updated} updated, {tools_removed} removed"
        )

        return result

    async def discover_all(self) -> list[DiscoveryResult]:
        """Discover tools from all connected servers."""
        results = []
        for server_id, info in self._servers.items():
            if info.status == SERVER_STATUS_CONNECTED:
                result = await self.discover_tools(server_id)
                results.append(result)
        return results

    # ── Tool Execution ─────────────────────────────────────

    async def call_tool(
        self,
        tool_name: str,
        arguments: dict[str, Any],
        server_name: Optional[str] = None,
        timeout: Optional[int] = None,
    ) -> ToolCallResult:
        """
        Call an MCP tool.

        Args:
            tool_name: Tool name (short or fully qualified)
            arguments: Tool arguments
            server_name: Optional server name for disambiguation
            timeout: Optional timeout in seconds

        Returns:
            ToolCallResult with execution output
        """
        start_time = datetime.now(timezone.utc)
        effective_timeout = timeout or self._tool_timeout

        # Resolve tool
        tool_info = self._resolve_tool(tool_name, server_name)
        if not tool_info:
            return ToolCallResult(
                tool_name=tool_name,
                success=False,
                error=f"Tool not found: {tool_name}",
            )

        transport = self._transports.get(tool_info.server_id)
        if not transport or not transport.is_connected:
            return ToolCallResult(
                tool_name=tool_name,
                success=False,
                error=f"Server not connected for tool: {tool_name}",
            )

        try:
            output = await asyncio.wait_for(
                transport.call_tool(tool_info.tool_name, arguments),
                timeout=effective_timeout,
            )

            end_time = datetime.now(timezone.utc)
            duration_ms = int((end_time - start_time).total_seconds() * 1000)

            return ToolCallResult(
                tool_name=tool_name,
                success=True,
                output=output,
                duration_ms=duration_ms,
            )

        except asyncio.TimeoutError:
            return ToolCallResult(
                tool_name=tool_name,
                success=False,
                error=f"Tool call timed out after {effective_timeout}s",
            )
        except Exception as e:
            return ToolCallResult(
                tool_name=tool_name,
                success=False,
                error=str(e),
            )

    # ── Tool Query ─────────────────────────────────────────

    def get_tool(self, full_name: str) -> Optional[MCPToolInfo]:
        """Get a tool by its full name."""
        return self._registry.get(full_name)

    def get_all_tools(self) -> list[MCPToolInfo]:
        """Get all discovered tools."""
        return self._registry.get_all()

    def get_tools_for_server(self, server_id: str) -> list[MCPToolInfo]:
        """Get all tools for a specific server."""
        return self._registry.get_server_tools(server_id)

    def search_tools(self, query: str) -> list[MCPToolInfo]:
        """Search tools by name or description."""
        return self._registry.search(query)

    def get_tools_summary(self) -> dict[str, Any]:
        """Get a summary of all tools and servers."""
        servers = []
        for server_id, info in self._servers.items():
            tools = self._registry.get_server_tools(server_id)
            servers.append({
                "id": info.id,
                "name": info.name,
                "status": info.status,
                "tool_count": len(tools),
                "enabled": info.enabled,
            })

        return {
            "total_servers": len(self._servers),
            "connected_servers": sum(
                1 for s in self._servers.values()
                if s.status == SERVER_STATUS_CONNECTED
            ),
            "total_tools": self._registry.tool_count,
            "servers": servers,
        }

    # ── Event Callbacks ────────────────────────────────────

    def on_tools_changed(self, callback: Callable) -> None:
        """Register a callback for tool changes."""
        self._on_tools_changed.append(callback)

    # ── Load from Database ─────────────────────────────────

    def load_from_db(self) -> int:
        """
        Load server configs and tool snapshots from database.

        Returns:
            Number of servers loaded
        """
        if not self._db:
            return 0

        servers = self._db.query(MCPServerConfig).all()
        loaded = 0

        for server in servers:
            info = MCPServerInfo(
                id=server.id,
                name=server.name,
                transport_type=server.transport_type,
                connection_config=json.loads(server.connection_config)
                    if isinstance(server.connection_config, str) else server.connection_config,
                status=SERVER_STATUS_DISCONNECTED,
                tool_count=server.tool_count,
                enabled=bool(server.enabled),
                last_discovered_at=server.last_discovered_at or "",
            )
            self._servers[server.id] = info

            # Create transport
            transport = self._create_transport(
                server.transport_type,
                info.connection_config,
            )
            self._transports[server.id] = transport

            # Load tool snapshots into registry
            for tool in server.tools:
                tool_info = MCPToolInfo(
                    id=tool.id,
                    server_id=server.id,
                    server_name=server.name,
                    tool_name=tool.tool_name,
                    description=tool.description or "",
                    input_schema=json.loads(tool.input_schema)
                        if tool.input_schema and isinstance(tool.input_schema, str)
                        else (tool.input_schema or {}),
                    output_schema=json.loads(tool.output_schema)
                        if tool.output_schema and isinstance(tool.output_schema, str)
                        else (tool.output_schema or {}),
                    version=tool.version,
                )
                self._registry.register(tool_info)

            loaded += 1

        logger.info(f"Loaded {loaded} MCP servers with {self._registry.tool_count} tools from DB")
        return loaded

    # ── Private Helpers ────────────────────────────────────

    def _create_transport(
        self,
        transport_type: str,
        config: dict[str, Any],
    ) -> MCPTransport:
        """Create a transport instance based on type."""
        if transport_type == TRANSPORT_STDIO:
            return StdioTransport(config)
        elif transport_type == TRANSPORT_SSE:
            return SSETransport(config)
        elif transport_type == TRANSPORT_STREAMABLE_HTTP:
            return StreamableHTTPTransport(config)
        else:
            logger.warning(f"Unknown transport type: {transport_type}, using stdio")
            return StdioTransport(config)

    def _resolve_tool(
        self,
        tool_name: str,
        server_name: Optional[str] = None,
    ) -> Optional[MCPToolInfo]:
        """Resolve a tool name to a tool info."""
        # Try full name first
        tool = self._registry.get(tool_name)
        if tool:
            return tool

        # Try with server prefix
        if server_name:
            tool = self._registry.get(f"{server_name}__{tool_name}")
            if tool:
                return tool

        # Try short name
        matches = self._registry.get_by_short_name(tool_name)
        if len(matches) == 1:
            return matches[0]
        elif len(matches) > 1:
            logger.warning(
                f"Ambiguous tool name '{tool_name}', matches: "
                f"{[m.full_name for m in matches]}. Using first."
            )
            return matches[0]

        return None

    def _notify_tools_changed(self) -> None:
        """Notify registered callbacks about tool changes."""
        for callback in self._on_tools_changed:
            try:
                callback(self._registry.get_all())
            except Exception as e:
                logger.error(f"Tool change callback error: {e}")

    def _update_server_status(self, server_id: str, status: str) -> None:
        """Update server status in database."""
        if not self._db:
            return
        server = self._db.query(MCPServerConfig).filter_by(id=server_id).first()
        if server:
            server.status = status
            self._db.commit()

    def _update_server_tool_count(
        self,
        server_id: str,
        tool_count: int,
        last_discovered_at: str,
    ) -> None:
        """Update server tool count in database."""
        if not self._db:
            return
        server = self._db.query(MCPServerConfig).filter_by(id=server_id).first()
        if server:
            server.tool_count = tool_count
            server.last_discovered_at = last_discovered_at
            self._db.commit()

    def _persist_server(
        self,
        server_id: str,
        name: str,
        transport_type: str,
        connection_config: dict[str, Any],
        enabled: bool,
        tenant_id: Optional[str],
        now: str,
    ) -> None:
        """Persist server config to database."""
        if not self._db:
            return
        try:
            record = MCPServerConfig(
                id=server_id,
                name=name,
                transport_type=transport_type,
                connection_config=json.dumps(connection_config),
                status=SERVER_STATUS_DISCONNECTED,
                tool_count=0,
                enabled=1 if enabled else 0,
                tenant_id=tenant_id,
                created_at=now,
                updated_at=now,
            )
            self._db.add(record)
            self._db.commit()
        except Exception as e:
            logger.error(f"Failed to persist MCP server config: {e}")
            self._db.rollback()

    def _get_existing_snapshots(self, server_id: str) -> list[dict[str, Any]]:
        """Get existing tool snapshots for a server from DB."""
        if not self._db:
            return []
        tools = self._db.query(MCPToolSnapshot).filter_by(server_id=server_id).all()
        return [
            {
                "id": t.id,
                "tool_name": t.tool_name,
                "description": t.description or "",
                "input_schema": t.input_schema or "",
                "output_schema": t.output_schema or "",
            }
            for t in tools
        ]

    def _create_tool_snapshot(
        self,
        tool_id: str,
        server_id: str,
        tool_name: str,
        description: str,
        input_schema: dict[str, Any],
        output_schema: dict[str, Any],
    ) -> None:
        """Create a tool snapshot in the database."""
        if not self._db:
            return
        try:
            now = datetime.now(timezone.utc).isoformat()
            snapshot = MCPToolSnapshot(
                id=tool_id,
                server_id=server_id,
                tool_name=tool_name,
                description=description,
                input_schema=json.dumps(input_schema) if isinstance(input_schema, dict) else str(input_schema),
                output_schema=json.dumps(output_schema) if isinstance(output_schema, dict) else str(output_schema),
                version="1.0.0",
                discovered_at=now,
            )
            self._db.add(snapshot)
            self._db.commit()
        except Exception as e:
            logger.error(f"Failed to create tool snapshot: {e}")
            self._db.rollback()

    def _update_tool_snapshot(
        self,
        server_id: str,
        tool_name: str,
        description: str,
        input_schema: dict[str, Any],
        output_schema: dict[str, Any],
    ) -> None:
        """Update an existing tool snapshot."""
        if not self._db:
            return
        try:
            snapshot = self._db.query(MCPToolSnapshot).filter_by(
                server_id=server_id,
                tool_name=tool_name,
            ).first()
            if snapshot:
                snapshot.description = description
                snapshot.input_schema = json.dumps(input_schema) if isinstance(input_schema, dict) else str(input_schema)
                snapshot.output_schema = json.dumps(output_schema) if isinstance(output_schema, dict) else str(output_schema)
                self._db.commit()
        except Exception as e:
            logger.error(f"Failed to update tool snapshot: {e}")
            self._db.rollback()

    def _remove_tool_snapshot(self, server_id: str, tool_name: str) -> None:
        """Remove a tool snapshot from the database."""
        if not self._db:
            return
        try:
            self._db.query(MCPToolSnapshot).filter_by(
                server_id=server_id,
                tool_name=tool_name,
            ).delete()
            self._db.commit()
        except Exception as e:
            logger.error(f"Failed to remove tool snapshot: {e}")
            self._db.rollback()
