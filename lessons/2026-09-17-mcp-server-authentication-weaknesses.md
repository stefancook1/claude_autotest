# MCP Server Authentication Weaknesses
**Category:** MCP Security
**Date:** 2026-09-17
**Difficulty:** Intermediate

---

## What It Is
Model Context Protocol (MCP) servers expose tools and resources that AI agents call at runtime. Unlike traditional APIs, MCP servers are often spun up locally or trusted implicitly by the host client, creating gaps where authentication is absent, trivially bypassed, or misconfigured. When an MCP server lacks proper authentication, any process on the same machine — or any network peer — can invoke its tools with the same privileges as the legitimate AI agent.

## Why It Matters
A compromised or unauthenticated MCP server is a direct path to everything the AI agent can touch: file systems, external APIs, code execution, and secrets. In 2024, researchers demonstrated that locally-bound MCP servers accessible over TCP with no authentication token allowed lateral movement from a low-privilege web process to a developer's full shell environment — all by simply calling the exposed `run_command` tool with no credentials required.

## Practical Example

### Scenario: The open localhost MCP server

A developer runs an MCP filesystem server during their IDE session:

```bash
# Launched by the IDE plugin — no auth configured
npx @modelcontextprotocol/server-filesystem /home/dev/projects
```

The server listens on `localhost:3000`. Any other process on the machine can now call it:

```python
import httpx, json

# Attacker script running as a low-privilege web worker process
payload = {
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
        "name": "read_file",
        "arguments": {"path": "/home/dev/projects/.env"}
    }
}

r = httpx.post("http://localhost:3000/mcp", json=payload)
print(r.json())  # Returns DATABASE_URL, API_KEY, etc.
```

No token. No session check. Full read access to the developer's project tree.

### Scenario: Weak shared-secret comparison

Some MCP servers implement a token check but do it incorrectly:

```python
# Vulnerable: timing-safe comparison not used
def authenticate(request):
    token = request.headers.get("X-MCP-Token", "")
    if token == SECRET_TOKEN:          # string equality — timing attack possible
        return True
    return False
```

An attacker can use a timing oracle to recover the token character by character.

### What a properly authenticated call looks like

```python
import hmac

def authenticate(request):
    token = request.headers.get("X-MCP-Token", "")
    # Constant-time comparison prevents timing attacks
    return hmac.compare_digest(token.encode(), SECRET_TOKEN.encode())
```

## How to Defend

- **Require a strong shared secret on every MCP server**, even localhost-bound ones — pass it as an environment variable and validate it on every request with `hmac.compare_digest` (Python) or `crypto.timingSafeEqual` (Node.js).
- **Bind to 127.0.0.1 explicitly, not 0.0.0.0** — a server intended for local use should never be reachable from the network; verify with `ss -tlnp | grep <port>`.
- **Scope tool permissions to least privilege** — an MCP server that only needs to read files should not expose a `run_command` tool; remove or disable any tool beyond the minimum required.
- **Rotate MCP tokens on each session** — generate a fresh secret when the IDE or agent session starts and invalidate it on exit; long-lived static tokens become credentials that outlive their context.
- **Audit the MCP server's tool list at startup** — log which tools are registered and alert if unexpected tools appear; a malicious server installed alongside a legitimate one may silently register extra capabilities.

## Today's Challenge

1. Start a local MCP server of your choice (or mock one with a simple HTTP server).
2. Use `curl` or a short Python script to call a tool endpoint **without** any authentication header. Does it respond? If yes, you've found a real gap.
3. Add `hmac.compare_digest`-based token validation to the server.
4. Re-run your script without the token — confirm a `401` is returned.
5. Bonus: use `ss -tlnp` or `netstat -tlnp` to verify the server is bound only to `127.0.0.1` and not `0.0.0.0`.

## Key Takeaway
An unauthenticated MCP server is an open door — not just for the AI agent, but for every process and network peer that can reach the port.
