# Input Validation Failures

**Category:** App Security
**Date:** 2026-06-24
**Difficulty:** Intermediate

---

## What It Is

Input validation failures occur when an application trusts data supplied by users or external systems without verifying it conforms to expected types, lengths, formats, and ranges. Validation must happen server-side; client-side checks are a UX convenience, not a security boundary. When untrusted input is consumed by business logic, databases, file systems, or external APIs without vetting, virtually every injection class becomes exploitable.

## Why It Matters

Missing or insufficient validation is the common root cause behind SQL injection, XSS, command injection, path traversal, and dozens of other high-impact vulnerabilities. The 2017 Equifax breach (CVE-2017-5638) exploited an Apache Struts deserialization flaw rooted in unvalidated Content-Type headers, exposing 147 million records. OWASP consistently lists validation failures among the top application risks.

## Practical Example

### Scenario: Unrestricted File Upload + Path Manipulation

A profile-photo upload endpoint accepts a filename from the client without validation:

```python
# VULNERABLE Flask endpoint
@app.route("/upload", methods=["POST"])
def upload():
    f = request.files["photo"]
    filename = f.filename                        # attacker controls this
    save_path = os.path.join("/var/uploads", filename)
    f.save(save_path)                            # arbitrary write to filesystem
    return "Saved to " + save_path
```

**Attack 1 — Path Traversal:** Attacker sends `filename=../../etc/cron.d/backdoor`. The join resolves to `/etc/cron.d/backdoor`, writing an attacker-controlled cron job.

**Attack 2 — Malicious extension:** Attacker uploads `shell.php`. If the web server is configured to execute PHP in the upload directory, they now have remote code execution.

**Attack 3 — Oversized input:** No size check means an attacker can upload a 4 GB file, filling disk and causing DoS.

```python
# SAFER version
import os, uuid
from werkzeug.utils import secure_filename

ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "gif"}
MAX_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB

@app.route("/upload", methods=["POST"])
def upload():
    f = request.files["photo"]

    # 1. Validate extension (allowlist, not blocklist)
    ext = f.filename.rsplit(".", 1)[-1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        abort(400, "File type not permitted")

    # 2. Validate size before reading fully
    f.seek(0, 2)
    if f.tell() > MAX_SIZE_BYTES:
        abort(413, "File too large")
    f.seek(0)

    # 3. Sanitize filename — never trust client-supplied names
    safe_name = f"{uuid.uuid4().hex}.{ext}"
    save_path = os.path.join("/var/uploads", safe_name)
    f.save(save_path)
    return "Saved"
```

### Numeric Range Bypass

```javascript
// VULNERABLE: discount applied without bounds check
app.post("/checkout", (req, res) => {
  const qty = req.body.quantity;          // attacker sends -10
  const price = 29.99;
  const total = qty * price;              // total = -299.90 → credit on account
  chargeUser(total);
});

// SAFE
const qty = parseInt(req.body.quantity, 10);
if (isNaN(qty) || qty < 1 || qty > 1000) return res.status(400).send("Invalid quantity");
```

## How to Defend

- **Validate on the server, always.** Treat every client-supplied value — headers, query params, JSON fields, cookies — as untrusted. Client-side validation is for UX only.
- **Use allowlists over blocklists.** Define what is permitted (alphanumeric, ISO date, specific enum values) rather than trying to enumerate everything bad.
- **Enforce type, length, range, and format.** A user ID should be a positive integer ≤ 2^31; a username should be 3–32 ASCII characters; a date should parse as a valid calendar date.
- **Use a validation library.** Libraries like `joi` (Node), `Pydantic` (Python), or `Hibernate Validator` (Java) let you declare schemas once and reuse them; hand-rolled checks drift and develop holes.
- **Fail closed.** Reject invalid input immediately with a 400-level error. Do not attempt to "clean" or guess at intent — sanitization is a supplement to validation, not a replacement.

## Today's Challenge

1. Pick any form or API endpoint in a project you own (or a public demo app).
2. Enumerate every input field: query params, JSON body fields, headers, file uploads.
3. For each field, write down: expected type, min/max length or value, allowed characters/format.
4. Check whether the server actually enforces each constraint — or whether it only checks client-side.
5. Bonus: send a negative number, a 10 MB string, a path like `../../etc/passwd`, and an emoji to each field and observe what happens.

## Key Takeaway

Every security boundary in your application is only as strong as the validation you perform on data crossing it — trust nothing that arrives from outside your process.
