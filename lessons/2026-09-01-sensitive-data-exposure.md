# Sensitive Data Exposure

**Category:** App Security
**Date:** 2026-09-01
**Difficulty:** Intermediate

---

## What It Is

Sensitive data exposure occurs when an application fails to adequately protect confidential information — such as passwords, credit card numbers, health records, or API keys — either in transit or at rest. Unlike active exploits, this vulnerability is often a passive failure: data is simply stored or transmitted in a way that makes it readable to anyone who can access the storage medium or intercept the connection. The OWASP Top 10 treats this as a symptom of cryptographic failures rather than a single bug.

## Why It Matters

A single exposed database backup or misconfigured S3 bucket can leak millions of user credentials. The 2019 Capital One breach exposed over 100 million customer records due to an SSRF vulnerability combined with over-privileged IAM roles — but the damage was amplified because sensitive fields were stored in plaintext. CVE-2021-44228 (Log4Shell) demonstrated how attackers chain vulnerabilities; sensitive data sitting unencrypted becomes the jackpot at the end of that chain.

## Practical Example

**Scenario: Plaintext password storage + HTTP transmission**

A login endpoint that stores passwords as MD5 (or worse, plaintext):

```python
# Vulnerable
import hashlib
def store_password(password):
    return hashlib.md5(password.encode()).hexdigest()  # MD5 is broken

def check_login(username, password):
    stored = db.query("SELECT pw_hash FROM users WHERE username = ?", username)
    return stored == hashlib.md5(password.encode()).hexdigest()
```

An attacker who dumps the database can crack MD5 hashes in seconds with rainbow tables. The fix:

```python
# Secure
import bcrypt
def store_password(password):
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=12))

def check_login(username, password):
    stored = db.query("SELECT pw_hash FROM users WHERE username = ?", username)
    return bcrypt.checkpw(password.encode(), stored)
```

**Second scenario: Sensitive data in logs**

```python
# Vulnerable - logs full request including Authorization header
logger.info(f"Incoming request: {request.headers} {request.body}")

# Secure - scrub sensitive fields before logging
SENSITIVE_HEADERS = {"authorization", "cookie", "x-api-key"}
safe_headers = {k: v for k, v in request.headers.items()
                if k.lower() not in SENSITIVE_HEADERS}
logger.info(f"Incoming request headers: {safe_headers}")
```

**Third scenario: Unencrypted sensitive columns in a database**

```sql
-- Vulnerable: SSN stored as plaintext
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name TEXT,
    ssn TEXT  -- exposed to any DB admin, backup reader, or SQL injection
);

-- Better: application-level encryption for PII
-- Store AES-GCM encrypted blobs; decrypt only when needed in application code
```

## How to Defend

- **Use strong, adaptive hashing for passwords**: bcrypt, Argon2id, or scrypt — never MD5, SHA-1, or unsalted SHA-256.
- **Enforce TLS everywhere**: HSTS headers, TLS 1.2+ only, no mixed content. Use `certbot` or managed certificates and set `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`.
- **Classify data and encrypt at rest**: Apply AES-256 (or AES-GCM for authenticated encryption) to columns containing PII, financial data, or credentials. Rotate keys on a schedule.
- **Scrub sensitive data from logs, error messages, and analytics**: API keys, tokens, SSNs, and card numbers must never appear in application logs or client-facing error responses.
- **Minimize data retention**: Don't store what you don't need. Tokenize card numbers (PCI-DSS), truncate SSNs in UI, and purge stale records on schedule.

## Today's Challenge

1. Search your codebase for any call to `hashlib.md5`, `hashlib.sha1`, or `md5(` — if you find one used for password hashing, replace it with bcrypt or Argon2id.
2. Run `grep -rn "password\|secret\|api_key\|token" --include="*.log" logs/` (or your log directory) to check whether secrets are leaking into log files.
3. If you have a database, list the columns in your user table and identify which ones contain PII. Ask yourself: which of these could be encrypted at the application layer without breaking search requirements?

## Key Takeaway

Sensitive data exposure is a **storage and transport problem**, not just an access-control one — encrypt data before it reaches disk, scrub it before it reaches logs, and assume every backup will eventually be stolen.
