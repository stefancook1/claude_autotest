# Server-Side Request Forgery (SSRF)
**Category:** App Security
**Date:** 2026-06-09
**Difficulty:** Intermediate

---

## What It Is
Server-Side Request Forgery (SSRF) is a vulnerability where an attacker tricks a server into making HTTP requests to an unintended destination — typically internal infrastructure that the attacker cannot reach directly. The server acts as a proxy, forwarding requests on the attacker's behalf using its own network identity and trust. Because the request originates from the server itself, internal firewalls and access controls that block external traffic often let it through.

## Why It Matters
SSRF can expose cloud metadata endpoints (e.g., `http://169.254.169.254/`), internal admin panels, databases, and other services that assume no external attacker can reach them. It was the primary attack vector in the 2019 Capital One breach (CVE-2019-0232 adjacent), where an attacker used SSRF to access AWS EC2 instance metadata and retrieve IAM credentials — ultimately exposing over 100 million customer records.

## Practical Example

### Vulnerable Code (Python/Flask)
```python
import requests
from flask import Flask, request

app = Flask(__name__)

@app.route('/fetch')
def fetch_url():
    # BUG: user-controlled URL passed directly to requests
    url = request.args.get('url')
    response = requests.get(url)
    return response.text
```

**Attack — steal AWS credentials via metadata API:**
```
GET /fetch?url=http://169.254.169.254/latest/meta-data/iam/security-credentials/my-role
```

**Response the attacker receives:**
```json
{
  "AccessKeyId": "ASIA...",
  "SecretAccessKey": "wJalrXUtnFEMI...",
  "Token": "AQoXnyc4lcK4...",
  "Expiration": "2026-06-09T12:00:00Z"
}
```

**Attack — probe internal network:**
```
GET /fetch?url=http://192.168.1.1/admin
GET /fetch?url=http://localhost:6379/   (Redis)
GET /fetch?url=file:///etc/passwd       (file:// scheme)
```

### Bypass Tricks Attackers Use
```
# DNS rebinding / alternate encodings
http://[::1]/admin          # IPv6 loopback
http://0x7f000001/          # hex IP for 127.0.0.1
http://127.0.0.1.nip.io/   # DNS resolves to 127.0.0.1
http://attacker.com/redirect -> 169.254.169.254  # open redirect chain
```

## How to Defend

- **Allowlist outbound destinations.** Define the exact hosts and ports your application is allowed to fetch. Reject everything else — deny by default.
- **Validate and resolve URLs server-side before fetching.** Resolve the DNS name to an IP, then reject if it falls in private ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `127.0.0.0/8`, `169.254.0.0/16`).
- **Disable unused URL schemes.** Only allow `https://` (and `http://` if necessary). Block `file://`, `gopher://`, `dict://`, `ftp://`, etc.
- **Enforce network segmentation.** Use instance metadata service v2 (IMDSv2) on AWS, which requires a session token header that a simple SSRF cannot supply. Apply similar defenses on other cloud providers.
- **Don't return raw responses to the client.** If you must fetch external content, strip or proxy the response so the attacker cannot read arbitrary internal data verbatim.

## Today's Challenge

1. **Audit your codebase** for any place where a URL is accepted from user input and passed to an HTTP client (`requests.get`, `fetch`, `curl`, `axios`, `HttpClient`, etc.).
2. **Test a local app** (or a deliberately vulnerable one like [DVWA](https://github.com/digininja/DVWA)) by pointing a URL parameter at `http://127.0.0.1/` and see what you get back.
3. **Check your cloud setup:** if you're on AWS, run `curl http://169.254.169.254/latest/meta-data/` from inside an EC2 instance. If it responds without a token, you're using IMDSv1 — upgrade to IMDSv2 and restrict `hop-limit` to 1.

## Key Takeaway
SSRF turns your own server into an attacker's scout — block it by never trusting user-supplied URLs and strictly allowlisting where your server is permitted to connect.
