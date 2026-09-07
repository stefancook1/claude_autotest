# Server-Side Request Forgery (SSRF)
**Category:** App Security
**Date:** 2026-09-07
**Difficulty:** Intermediate

---

## What It Is
Server-Side Request Forgery (SSRF) is a vulnerability where an attacker tricks a server into making HTTP requests to an unintended destination — often internal network resources the attacker cannot reach directly. The server acts as a proxy on behalf of the attacker, using its own network privileges. Because the request originates from a trusted server rather than an external client, firewalls and access controls that would normally block the attacker are bypassed.

## Why It Matters
SSRF was the root cause of the 2019 Capital One breach, where an attacker exploited a misconfigured WAF to make the server query the AWS EC2 metadata endpoint (`http://169.254.169.254/latest/meta-data/`), extracting IAM credentials that granted access to over 100 million customer records. SSRF consistently appears in the OWASP Top 10 (A10:2021) precisely because cloud environments make internal metadata endpoints trivially reachable from any compromised service.

## Practical Example
Consider a web app that fetches a preview for user-supplied URLs:

```python
# Vulnerable endpoint
import requests
from flask import Flask, request

app = Flask(__name__)

@app.route('/fetch-preview')
def fetch_preview():
    url = request.args.get('url')
    response = requests.get(url)  # No validation — attacker controls this
    return response.text
```

An attacker supplies:
```
GET /fetch-preview?url=http://169.254.169.254/latest/meta-data/iam/security-credentials/
```

The server dutifully fetches AWS IAM credentials and returns them to the attacker. From there, the attacker escalates to S3 buckets, RDS instances, and anything else the role allows.

Beyond cloud metadata, SSRF enables:
- **Internal port scanning:** `http://192.168.1.1:22` — response time/errors reveal open ports
- **Internal service access:** `http://internal-admin.corp:8080/users`
- **Protocol smuggling:** `gopher://`, `file://`, `dict://` schemes for non-HTTP targets
- **Bypassing IP allowlists:** using DNS rebinding or redirects to resolve to blocked IPs

### Common bypass tricks when basic SSRF protections exist:
```
http://127.0.0.1          → http://2130706433 (decimal IP)
http://127.0.0.1          → http://0x7f000001 (hex IP)
http://localhost           → http://127.0.0.1.nip.io (DNS resolves to 127.0.0.1)
http://169.254.169.254    → http://169.254.169.254/latest/../latest/meta-data/
```

## How to Defend
- **Allowlist outbound destinations:** Define an explicit allowlist of hostnames and IP ranges the server is permitted to fetch. Reject everything else — never use a blocklist alone, as attackers will find bypasses.
- **Resolve and re-validate after DNS:** Resolve the hostname to an IP *before* making the request, then check the resolved IP against your allowlist. This defeats DNS rebinding attacks.
- **Block private/link-local ranges:** Explicitly reject requests that resolve to RFC 1918 ranges (10.x, 172.16-31.x, 192.168.x), loopback (127.x), and link-local (169.254.x) addresses.
- **Disable unused URL schemes:** Only permit `https://` (and `http://` where necessary). Never allow `file://`, `gopher://`, `dict://`, or `ftp://` from user-supplied input.
- **Use a dedicated egress proxy:** Route all server-initiated outbound requests through a hardened proxy that enforces destination policy centrally, rather than relying on per-service validation.

## Today's Challenge
Spin up [SSRFire](https://github.com/epsylon/ssrfire) or use Burp Suite's Collaborator client on a test app. Alternatively:

1. Stand up a simple Flask/Express endpoint that accepts a `url` parameter and fetches it.
2. Point it at `http://169.254.169.254/latest/meta-data/` (in a real AWS/GCP environment) or at your local machine's port 22 (`http://127.0.0.1:22`).
3. Now implement IP allowlisting — reject any URL resolving to a private range.
4. Try bypassing your own fix using a decimal IP (`http://2130706433/`) and patch that too.

Bonus: check whether your fix handles redirects (the server follows a redirect to `http://127.0.0.1`).

## Key Takeaway
SSRF turns your own server into an attacker's proxy — the only reliable defense is validating the *resolved destination*, not just the URL string, against a strict allowlist before every request.
