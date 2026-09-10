# Command Injection

**Category:** App Security
**Date:** 2026-09-10
**Difficulty:** Intermediate

---

## What It Is

Command injection occurs when an application passes unsanitized user-controlled data to a system shell, allowing attackers to execute arbitrary OS commands. The application itself becomes the attacker's conduit — running whatever the OS will accept, with the privileges of the web server process. Unlike SQL injection (which targets a database), command injection targets the underlying operating system.

## Why It Matters

A successful command injection gives an attacker a foothold on the server: they can read sensitive files, exfiltrate data, install backdoors, or pivot deeper into the network. CVE-2021-41773 (Apache HTTP Server path traversal + RCE) and the 2014 Shellshock vulnerability (CVE-2014-6271) are high-profile examples that allowed unauthenticated remote code execution on millions of servers worldwide.

## Practical Example

Imagine a web application that pings a host to check connectivity:

```python
# VULNERABLE — never do this
import subprocess, flask

@app.route("/ping")
def ping():
    host = flask.request.args.get("host")
    output = subprocess.check_output(f"ping -c 1 {host}", shell=True)
    return output
```

An attacker sends:

```
GET /ping?host=8.8.8.8;cat+/etc/passwd
```

The shell interprets this as two commands:
```bash
ping -c 1 8.8.8.8 ; cat /etc/passwd
```

The `cat /etc/passwd` runs with the server's privileges and its output is returned to the attacker. Common shell metacharacters used in attacks:

| Metacharacter | Effect |
|---|---|
| `;` | Run second command unconditionally |
| `&&` | Run second command if first succeeds |
| `\|\|` | Run second command if first fails |
| `` ` ` `` or `$()` | Command substitution |
| `\|` | Pipe output to next command |
| `\n` / `%0a` | Newline as command separator |

Blind command injection (no output returned) can still be exploited via time-based techniques:
```
host=8.8.8.8;sleep+10
```
If the response is delayed ~10 seconds, the injection worked.

## How to Defend

- **Avoid shell invocation entirely.** Use language APIs that accept argument lists instead of shell strings. In Python: `subprocess.run(["ping", "-c", "1", host])` — no shell interpretation occurs because there is no shell.
- **Validate and allowlist inputs.** If you must accept a hostname or IP, validate it against a strict regex (`^[a-zA-Z0-9.\-]+$`) and reject anything that doesn't match before it ever reaches a command.
- **Never interpolate user input into shell strings.** Even with quoting, edge cases in shell parsing (backslashes, locale-specific behavior) can bypass naive escaping.
- **Run processes with least privilege.** The web server process should not run as root. If an injection succeeds, the blast radius is limited by the process's OS-level permissions.
- **Use a Web Application Firewall (WAF) as a secondary layer** — not as your primary defense, but to catch obvious metacharacter sequences in transit.

## Today's Challenge

1. Set up a local Flask app (or any web framework you know) with the vulnerable `/ping` endpoint shown above.
2. Confirm you can exfiltrate `/etc/hostname` via the `;` metacharacter.
3. Refactor the endpoint to use `subprocess.run` with a list argument, add hostname/IP validation with a regex, and verify that the same payload now produces an error rather than a result.
4. **Bonus:** Try a blind injection using `sleep` and measure the response time to confirm the fix works both with and without output.

## Key Takeaway

The safest way to call OS commands is to never build them as shell strings — pass structured argument lists directly to the OS and keep user input away from any shell interpreter.
