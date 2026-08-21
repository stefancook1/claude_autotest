# MCP Server Authentication Weaknesses
**Category:** MCP Security
**Date:** 2026-08-21
**Difficulty:** Intermediate

---

## What It Is
MCP (Model Context Protocol) servers expose tools and resources that AI agents call at runtime. Unlike a traditional API protected by a single auth token, an MCP server can be discovered and connected to by *any* client that knows its endpoint — often with no mutual authentication at all. Most current MCP deployments rely on implicit trust: if a client can reach the socket or HTTP endpoint, the server assumes the caller is legitimate.

## Why It Matters
A weakly authenticated MCP server is a privilege-escalation door. An attacker who gains network access to the server (e.g., via a compromised container, SSRF vulnerability, or misconfigured firewall) can issue tool calls — read files, run shell commands, call external APIs — under the AI agent's identity with zero credentials. In enterprise deployments this can mean full access to internal databases, cloud APIs, and user data with no audit trail pointing to the real actor.

## Practical Example

**Scenario:** A company runs an internal MCP server over HTTP on `http://mcp-internal:3000`. It uses a simple pre-shared key passed as a header:

```http
POST /tools/call HTTP/1.1
Host: mcp-internal:3000
X-MCP-Key: supersecret123
Content-Type: application/json

{"tool": "shell_exec", "args": {"cmd": "cat /etc/passwd"}}
```

**Weakness 1 – No authentication at all (stdio servers):**
Many stdio-based MCP servers have zero auth because they assume they run as a child process of a trusted client. If that client is exploited, the MCP server inherits the attacker's session automatically.

**Weakness 2 – Static pre-shared key in config files:**
```json
// .claude/settings.json stored in a public repo
{
  "mcp_servers": {
    "my-server": {
      "url": "http://mcp-internal:3000",
      "api_key": "supersecret123"   // leaked to GitHub
    }
  }
}
```

**Weakness 3 – No token expiry or rotation:**
A stolen MCP API key works forever because there is no token expiry, revocation endpoint, or refresh mechanism.

**Weakness 4 – Missing mutual TLS on network servers:**
An attacker with network access can intercept MCP traffic (tool descriptions, responses) or inject tool definitions via a man-in-the-middle because the server only validates the client's key, not its identity, and the client doesn't verify the server's certificate.

## How to Defend
- **Use short-lived tokens, not static keys.** Integrate MCP server auth with your identity provider (OAuth 2.0, OIDC). Tokens should expire in minutes to hours, not never.
- **Enable mutual TLS for network-based MCP servers.** Both sides present certificates so neither endpoint can be spoofed.
- **Scope tool permissions to the calling identity.** Don't give every authenticated client access to every tool. Map client identities to allow-lists of tools they may call.
- **Never commit credentials to source control.** Load API keys from environment variables or a secrets manager (Vault, AWS Secrets Manager). Scan repos with `git-secrets` or `truffleHog`.
- **Implement request signing and replay protection.** Sign each tool call with a timestamp and nonce so captured requests can't be replayed even with a valid key.

## Today's Challenge
1. Audit any MCP server you run (or a public demo like the MCP filesystem server). Check: does it require authentication? Is the key static? Is it stored in a config file that could be committed?
2. Try connecting to it with `curl` or a simple Python script using only the endpoint URL (no key). If it responds, you've found an unauthenticated server.
3. Bonus: look up the [MCP Authorization spec (draft)](https://modelcontextprotocol.io/specification/2025-03-26/basic/authorization) and note what it requires vs. what most servers actually implement today.

## Key Takeaway
An MCP server without strong, rotating, scoped authentication is a root shell waiting to be handed to anyone who can reach its port — treat it with the same paranoia you'd give an SSH daemon exposed to the internet.
