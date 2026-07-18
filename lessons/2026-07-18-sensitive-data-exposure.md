# Sensitive Data Exposure

**Category:** App Security
**Date:** 2026-07-18
**Difficulty:** Intermediate

---

## What It Is

Sensitive data exposure occurs when an application inadvertently reveals confidential information—passwords, credit card numbers, API keys, PII, health records—due to weak encryption, missing encryption, or storing secrets where they shouldn't be. Unlike active exploits, this class of vulnerability is often passive: attackers simply read data that was never properly protected in the first place. OWASP formerly listed it as a standalone category (A3:2017) and now frames it under "Cryptographic Failures" (A02:2021) and "Security Misconfiguration."

## Why It Matters

A single misconfigured S3 bucket or a plaintext column in a database can expose millions of records—the 2021 LinkedIn breach (700M records) and the 2019 Capital One breach (100M records, misconfigured WAF) both trace back to data that was accessible but shouldn't have been. Beyond regulatory fines (GDPR, HIPAA, PCI-DSS), credential exposure leads directly to account takeover and lateral movement across systems.

## Practical Example

### Scenario 1: Passwords Stored with Weak Hashing

```python
# VULNERABLE: MD5 is broken for passwords — reversible with rainbow tables
import hashlib

def store_password(password: str) -> str:
    return hashlib.md5(password.encode()).hexdigest()

# Attacker recovers "password123" from hash "482c811da5d5b4bc6d497ffa98491e38"
# in seconds using crackstation.net or hashcat
```

```python
# SECURE: bcrypt with a work factor
import bcrypt

def store_password(password: str) -> bytes:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=12))

def verify_password(password: str, hashed: bytes) -> bool:
    return bcrypt.checkpw(password.encode(), hashed)
```

---

### Scenario 2: API Key Leaked in Git History

```bash
# Developer accidentally commits secrets
git log --all -p | grep -E "(api_key|secret|password)\s*=" 
# Output:
# +API_KEY = "sk-live-abc123xyz789"
# +DB_PASSWORD = "SuperSecret2024!"

# Even after deletion in a later commit, the key lives forever in git history
# Attacker clones repo, runs: git log --all --oneline -p | grep sk-live-
```

**How attackers find this at scale:**

```bash
# truffleHog scans git history for high-entropy strings and known secret patterns
trufflehog git https://github.com/target/repo --only-verified
```

---

### Scenario 3: Sensitive Data in HTTP Response That Shouldn't Be There

```json
// API returns the full user object, including fields the frontend never needs
GET /api/v1/users/me
{
  "id": 42,
  "email": "user@example.com",
  "password_hash": "$2b$12$...",
  "ssn": "123-45-6789",
  "internal_credit_score": 720,
  "stripe_customer_id": "cus_Nffc4..."
}
```

A browser extension, a CDN log, or a JS error tracker captures this response—now that data is in a third-party system.

## How to Defend

- **Never store passwords with reversible or weak hashes.** Use bcrypt, scrypt, or Argon2 with appropriate work factors. Never MD5/SHA-1/SHA-256 alone for passwords.
- **Encrypt data at rest and in transit.** TLS 1.2+ for all connections; AES-256 or ChaCha20 for database columns containing PII, health data, or financial info. Manage keys separately from the data (AWS KMS, HashiCorp Vault).
- **Minimize what you store and what you return.** Apply the principle of least exposure: strip fields from API responses that the client doesn't need, purge PII after retention windows, and avoid logging sensitive values.
- **Scan for secrets before they leave your machine.** Use pre-commit hooks with `detect-secrets`, `gitleaks`, or `trufflehog` to block accidental commits of API keys, tokens, and credentials.
- **Audit your storage perimeter.** Regularly scan S3 buckets, GCS buckets, and database snapshots for public access and unencrypted contents. Tools like `cloudsploit` and AWS Trusted Advisor flag these automatically.

## Today's Challenge

1. Run `trufflehog filesystem .` (or `gitleaks detect`) on a personal or hobby project's git history and note what it finds.
2. Inspect one API endpoint in a project you work on: does the response include any fields that the UI doesn't actually render? If so, those are candidates for removal.
3. Check your database schema for any `password`, `ssn`, `credit_card`, or `token` columns—verify they're stored hashed or encrypted, not in plaintext.

## Key Takeaway

Sensitive data exposure is less about what attackers do *to* you and more about what you accidentally leave *for* them—encrypt aggressively, return only what's needed, and treat git history as a public record.
