# Broken Authentication

**Category:** App Security
**Date:** 2026-08-23
**Difficulty:** Intermediate

---

## What It Is

Broken authentication encompasses a class of vulnerabilities where an application fails to correctly implement identity verification, session management, or credential handling. Attackers exploit these weaknesses to impersonate other users, hijack sessions, or gain unauthorized access without ever knowing the victim's password. It consistently ranks in the OWASP Top 10 because authentication is hard to get right and the consequences of failure are severe.

## Why It Matters

Broken authentication is the front door to account takeover: once an attacker owns a session or credential, every downstream authorization check becomes irrelevant. The 2012 LinkedIn breach exposed 6.5 million unsalted SHA-1 password hashes, which were cracked within hours — a textbook case of weak credential storage enabling mass account compromise.

## Practical Example

### Scenario 1: Predictable Session Tokens

```python
# Vulnerable: session ID derived from username + timestamp — trivially guessable
import time, hashlib

def create_session(username):
    token = hashlib.md5(f"{username}{int(time.time())}".encode()).hexdigest()
    return token

# Attacker observes their own token, brute-forces the timestamp offset,
# then iterates over known usernames to forge any session they like.
```

### Scenario 2: Missing Rate Limiting on Login

```http
POST /api/login HTTP/1.1
Content-Type: application/json

{"username": "admin", "password": "Password1"}
{"username": "admin", "password": "Password2"}
... (10,000 requests, no lockout)
```

A simple Hydra or Burp Intruder attack against a login endpoint with no rate limiting or lockout will eventually land on the correct password.

### Scenario 3: Insecure "Remember Me" Cookie

```
Set-Cookie: remember_me=dXNlcm5hbWU9YWRtaW4=; Max-Age=2592000
```

Decoding the Base64 value reveals `username=admin`. An attacker can forge the cookie for any account, bypassing password authentication entirely.

## How to Defend

- **Use a proven session library**: never roll your own session ID generation. Use cryptographically random IDs (≥128 bits of entropy) via `secrets.token_urlsafe()` (Python), `crypto.randomBytes()` (Node), or your framework's built-in session manager.
- **Enforce MFA on sensitive accounts**: even a compromised password cannot be used if TOTP/FIDO2 is required.
- **Rate-limit and lock out**: block or CAPTCHA-challenge IPs after 5–10 failed login attempts; use exponential backoff. Log all failures to a SIEM.
- **Invalidate sessions on logout and privilege change**: rotate the session ID after login (prevents session fixation) and destroy it fully on logout — not just delete the client-side cookie.
- **Hash passwords with a memory-hard algorithm**: use bcrypt, Argon2id, or scrypt with an appropriate work factor. Never MD5, SHA-1, or unsalted hashes.

## Today's Challenge

1. Open your current application's login flow in Burp Suite or OWASP ZAP.
2. Attempt to log in with a wrong password 20 times in rapid succession. Does the app lock you out, slow down, or serve a CAPTCHA? If not, you have a brute-force vector.
3. Inspect the session cookie set after login: is it opaque and unguessable, or does it encode user data? Decode it (Base64, JWT, etc.) and verify no sensitive information leaks out.
4. Log out, then paste the old session cookie back into the browser and reload a protected page. Does it still work? It shouldn't.

## Key Takeaway

Authentication is only as strong as its weakest link — a guessable token, a missing rate limit, or a reusable session cookie can make a correct password completely irrelevant.
