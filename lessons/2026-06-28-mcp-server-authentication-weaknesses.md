# MCP Server Authentication Weaknesses
**Category:** MCP Security
**Date:** 2026-06-28
**Difficulty:** Intermediate

---

## What It Is
Model Context Protocol (MCP) servers expose tools and resources to AI agents over a transport layer (stdio, HTTP/SSE, or WebSocket). Authentication weaknesses arise when MCP servers either implement no auth at all, rely on shared secrets passed as plain environment variables, or fail to validate that the calling client is the legitimate AI host — allowing any process with network access to invoke privileged tools as if it were the trusted agent.

## Why It Matters
An unauthenticated or weakly authenticated MCP server is a ready-made backdoor: any attacker who reaches the endpoint can read files, execute commands, query databases, or exfiltrate secrets through the exact same tool surface the AI uses. Because MCP servers often run with elevated privileges (to do useful things for the agent), a single auth bypass can escalate straight to high-impact access — no additional exploit required.

## Practical Example

### Scenario: HTTP MCP server with a static shared secret

A common pattern teams reach for looks like this:

```python
# server.py — a minimal FastAPI MCP server
from fastapi import FastAPI, Header, HTTPException
import os

app = FastAPI()
SECRET = os.environ["MCP_SECRET"]   # e.g. "hunter2"

@app.post("/tools/read_file")
async def read_file(path: str, x_mcp_token: str = Header(None)):
    if x_mcp_token != SECRET:
        raise HTTPException(status_code=401)
    with open(path) as f:
        return {"content": f.read()}
```

**Problems with this pattern:**

1. **No secret rotation** — The secret lives in an env var that never changes. If it leaks (CI logs, `ps aux`, Docker inspect), all requests are forgeable forever.
2. **No per-client identity** — Every client that knows the secret is indistinguishable. A compromised AI host grants full access with no way to revoke just that client.
3. **No replay protection** — Captured requests can be replayed indefinitely; there is no nonce, timestamp, or request binding.
4. **Path traversal is one layer up** — Because auth passes, the `path` parameter is now the only remaining control, and it isn't validated here at all.

**What an attacker does:**

```bash
# Sniff the token from a compromised agent's environment
MCP_SECRET=$(cat /proc/<agent_pid>/environ | tr '\0' '\n' | grep MCP_SECRET | cut -d= -f2)

# Now call the MCP server directly — no AI involved
curl -X POST http://mcp-server:8000/tools/read_file \
  -H "x-mcp-token: $MCP_SECRET" \
  -d '{"path": "/etc/shadow"}'
```

### A stronger pattern

```python
import time, hmac, hashlib, secrets

# Client: sign each request with HMAC-SHA256 + timestamp
def sign_request(payload: str, secret: str) -> dict:
    ts = str(int(time.time()))
    nonce = secrets.token_hex(16)
    sig = hmac.new(
        secret.encode(),
        f"{ts}.{nonce}.{payload}".encode(),
        hashlib.sha256
    ).hexdigest()
    return {"x-mcp-ts": ts, "x-mcp-nonce": nonce, "x-mcp-sig": sig}

# Server: verify signature AND reject replays
SEEN_NONCES = set()   # use a TTL cache in production

def verify_request(payload: str, headers: dict, secret: str):
    ts = int(headers["x-mcp-ts"])
    if abs(time.time() - ts) > 30:           # 30-second window
        raise ValueError("Timestamp out of window")
    nonce = headers["x-mcp-nonce"]
    if nonce in SEEN_NONCES:
        raise ValueError("Replay detected")
    SEEN_NONCES.add(nonce)
    expected = hmac.new(
        secret.encode(),
        f"{ts}.{nonce}.{payload}".encode(),
        hashlib.sha256
    ).hexdigest()
    if not hmac.compare_digest(expected, headers["x-mcp-sig"]):
        raise ValueError("Invalid signature")
```

## How to Defend
- **Require mutual TLS (mTLS) for remote MCP servers** — each client presents a certificate; the server validates it against a trusted CA. Revocation is then just CRL/OCSP, not a secret rotation scramble.
- **Use short-lived bearer tokens (OAuth 2.0 / OIDC)** instead of static shared secrets; tokens expire, carry scopes, and can be revoked without redeploying.
- **Bind authentication to the request, not just the session** — include a timestamp + nonce in every signed request to defeat replay attacks.
- **Enforce network isolation** — MCP servers should only be reachable from the AI host process, not from arbitrary hosts on the same network (use localhost binding or private VPC subnets, not `0.0.0.0`).
- **Log and alert on auth failures** — a sudden spike in 401s from unexpected source IPs is your earliest signal of probing.

## Today's Challenge
Audit a local or demo MCP server (or review the official [MCP Inspector](https://github.com/modelcontextprotocol/inspector) setup):
1. Find where authentication tokens/secrets are configured. Are they static? Where are they stored?
2. Check whether the transport binds to `0.0.0.0` or only `127.0.0.1`.
3. Try replaying a captured request 60 seconds later — does the server reject it?

If you don't have an MCP server handy, review the [MCP spec's security section](https://spec.modelcontextprotocol.io/specification/2025-03-26/basic/security/) and identify which auth mechanisms it recommends vs. which it leaves optional.

## Key Takeaway
An MCP server with weak authentication hands an attacker all the power of your AI agent — without the AI.
