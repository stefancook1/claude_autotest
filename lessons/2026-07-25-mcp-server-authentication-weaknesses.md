# MCP Server Authentication Weaknesses

**Category:** MCP Security
**Date:** 2026-07-25
**Difficulty:** Intermediate

---

## What It Is

Model Context Protocol (MCP) servers expose tools and resources to AI agents, but many implementations bolt on authentication as an afterthought — or skip it entirely. Authentication weaknesses in MCP servers range from missing token validation and hardcoded credentials to improper session management that lets any caller impersonate a trusted client. Because MCP servers act as a bridge between an AI model and sensitive systems (filesystems, databases, APIs), a broken auth layer can hand an attacker full access to everything the server can touch.

## Why It Matters

An unauthenticated or weakly authenticated MCP server is effectively an open API to every tool it exposes. Attackers who discover a local or network-accessible MCP server can invoke filesystem reads, execute shell commands, or exfiltrate data — all without ever compromising the AI model itself. Early community MCP server implementations (2024–2025) routinely shipped with no authentication at all, treating network access as the only security boundary.

## Practical Example

**Scenario: Unauthenticated stdio-over-HTTP transport**

Many MCP servers offer an HTTP+SSE transport for remote access. A naive implementation might look like this:

```python
# VULNERABLE: No authentication middleware
from flask import Flask, request, jsonify
from mcp.server import MCPServer

app = Flask(__name__)
mcp = MCPServer()

@app.route("/mcp", methods=["POST"])
def handle_mcp():
    payload = request.json
    result = mcp.dispatch(payload)   # Any caller can invoke any tool
    return jsonify(result)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080)
```

An attacker on the same network — or with SSRF access to the host — can call this directly:

```bash
# Invoke the "read_file" tool with no credentials
curl -s -X POST http://target:8080/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "read_file",
      "arguments": {"path": "/etc/passwd"}
    }
  }'
```

**Scenario: Hardcoded shared secret**

Some servers add a token check but embed the secret in source code:

```python
SECRET = "mcp-token-abc123"   # Hardcoded, shipped in Git

@app.route("/mcp", methods=["POST"])
def handle_mcp():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    if token != SECRET:
        return jsonify({"error": "Unauthorized"}), 401
    ...
```

The secret leaks through version control, container images, or process lists (`ps aux` shows env vars), giving any observer permanent access.

## How to Defend

- **Require strong, rotatable tokens on every transport.** Use OAuth 2.0 bearer tokens or mTLS for network-accessible servers; for stdio servers, validate the launching process via OS-level controls. Never hardcode secrets — load them from a secrets manager or environment variable injected at runtime.
- **Bind to localhost by default.** Unless remote access is explicitly required, listen only on `127.0.0.1`. Network exposure should be a deliberate, documented decision, not a default.
- **Implement per-tool authorization.** Even authenticated callers should only access the tools their role requires. A code-assistant agent shouldn't be allowed to call `execute_shell` or `send_email` unless explicitly granted.
- **Validate the Origin header and use CORS properly.** For HTTP transports, restrict which origins can connect. For SSE endpoints, verify that the connecting client matches the expected agent identity.
- **Log and alert on every tool invocation.** Authentication gaps are often discovered through anomalous access patterns. Structured logs (caller identity, tool name, arguments hash, timestamp) make forensics possible after a compromise.

## Today's Challenge

1. Pick any open-source MCP server from the community registry (e.g., `mcp-server-filesystem`, `mcp-server-github`).
2. Read its transport setup code. Answer: does it validate caller identity on every request, or does it trust the transport layer alone?
3. If running locally, use `curl` or `mcp-client` to call a tool without any credentials. Document what you can access.
4. Propose one concrete fix — either a code change or a deployment control (firewall rule, reverse proxy with auth) — and explain why it reduces the attack surface.

## Key Takeaway

An MCP server without proper authentication is not a local convenience — it is a remotely exploitable API that hands attackers the same capabilities your AI agent has.
