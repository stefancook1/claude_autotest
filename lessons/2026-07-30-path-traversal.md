# Path Traversal

**Category:** App Security
**Date:** 2026-07-30
**Difficulty:** Intermediate

---

## What It Is

Path traversal (also called directory traversal) is a vulnerability where an attacker manipulates file path inputs to access files and directories outside the intended scope. By injecting sequences like `../` (dot-dot-slash), an attacker can climb the directory tree and read sensitive files—configuration, credentials, source code, or OS files—that the application never intended to expose. The root cause is trusting user-supplied input to construct filesystem paths without sanitising or canonicalising it first.

## Why It Matters

A successful path traversal against a web server can expose `/etc/passwd`, private keys, database credentials, or application source code in seconds, often without authentication. CVE-2021-41773 (Apache HTTP Server 2.4.49) is a stark reminder: a single unpatched path traversal led to unauthenticated remote code execution at scale, compromising thousands of servers within days of disclosure.

## Practical Example

### Vulnerable Python/Flask endpoint

```python
from flask import Flask, request, send_file

app = Flask(__name__)
BASE_DIR = "/var/www/files"

@app.route("/download")
def download():
    filename = request.args.get("file")          # user-controlled
    path = BASE_DIR + "/" + filename             # no sanitisation
    return send_file(path)                       # arbitrary read
```

**Attack:**
```
GET /download?file=../../../../etc/passwd
```
The server resolves `/var/www/files/../../../../etc/passwd` → `/etc/passwd` and serves it.

### Common bypass encodings to watch for

| Payload | Decoded meaning |
|---|---|
| `../` | One level up (Unix) |
| `..\` | One level up (Windows) |
| `%2e%2e%2f` | URL-encoded `../` |
| `%2e%2e/` | Mixed encoding |
| `....//` | Doubled dot to survive naive `../` stripping |
| `%252e%252e%252f` | Double URL-encoded `../` |

### Safe version

```python
import os
from flask import Flask, request, send_file, abort

app = Flask(__name__)
BASE_DIR = "/var/www/files"

@app.route("/download")
def download():
    filename = request.args.get("file", "")
    # Resolve to absolute path, then verify it stays inside BASE_DIR
    safe_path = os.path.realpath(os.path.join(BASE_DIR, filename))
    if not safe_path.startswith(os.path.realpath(BASE_DIR) + os.sep):
        abort(403)
    return send_file(safe_path)
```

`os.path.realpath` resolves symlinks and `..` sequences before the prefix check, closing all bypass routes.

## How to Defend

- **Canonicalise before checking:** Always call `realpath()` (or equivalent) to resolve the absolute path, then assert it starts with the intended base directory—never rely on string stripping of `../`.
- **Use an allowlist of filenames or IDs:** Instead of accepting a filename directly, accept a user-supplied ID and look up the real filename from a server-side map. The filesystem path never touches user input.
- **Restrict filesystem permissions:** Run the application process with a dedicated low-privilege user that only has read access to the intended file directories—limit blast radius when traversal occurs.
- **Serve files through abstraction layers:** Use framework helpers (`send_from_directory` in Flask, `res.sendFile` with root option in Express) that include built-in path containment checks.
- **WAF rules as a secondary layer:** Deploy WAF rules that block requests containing `../`, `%2e%2e`, and similar patterns—useful defence-in-depth, but not a substitute for fixing the application.

## Today's Challenge

1. Spin up the vulnerable Flask snippet above locally (or in a container).
2. Confirm you can read `/etc/passwd` via `curl "http://localhost:5000/download?file=../../../../etc/passwd"`.
3. Apply the `os.path.realpath` fix and verify the same request now returns a 403.
4. Try the double-encoded bypass (`%252e%252e%252f`) against both versions—does the fix hold?

Bonus: use `grep -r "os.path.join" .` in a real project you work on and audit each call site for a missing `realpath`/prefix check.

## Key Takeaway

Canonicalise first, check prefix second—any sanitisation that happens before resolving `..` and symlinks can be bypassed.
