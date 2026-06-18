# JWT Vulnerabilities
**Category:** Application Security
**Date:** 2026-06-18
**Difficulty:** Intermediate

---

## What It Is
JSON Web Tokens (JWTs) are a compact, self-contained format for transmitting claims between parties, commonly used for authentication and authorization. They consist of three Base64URL-encoded parts — header, payload, and signature — joined by dots. Because the server trusts the token's claims without a database lookup, any flaw in how the token is generated or verified opens the door to full authentication bypass.

## Why It Matters
JWT implementation bugs are widespread and often critical: a compromised token lets an attacker impersonate any user, including admins. CVE-2015-9235 (the `alg: none` bypass) affected dozens of libraries and allowed signature verification to be skipped entirely with a trivially crafted token. Auth0, Okta, and numerous custom implementations have shipped vulnerable JWT code.

## Practical Example

### Attack 1: Algorithm Confusion (`alg: none`)
A server accepts the `alg` field from the token header at face value:

```
# Original token header (decoded):
{ "alg": "HS256", "typ": "JWT" }

# Attacker crafts a new token:
header  = base64url({ "alg": "none", "typ": "JWT" })
payload = base64url({ "sub": "admin", "role": "superuser" })
token   = header + "." + payload + "."   # empty signature

# Vulnerable server code (Python pseudocode):
alg = jwt.get_unverified_header(token)['alg']
jwt.decode(token, key, algorithms=[alg])  # trusts attacker-supplied alg!
```

### Attack 2: RS256 → HS256 Key Confusion
When a server uses RS256 (asymmetric), its *public key* is often discoverable. An attacker switches the algorithm to HS256 and signs the forged token **with the public key as the HMAC secret**:

```python
import jwt, requests

public_key = fetch_public_key()  # from /.well-known/jwks.json or /auth/certs

forged_payload = {"sub": "admin", "role": "superuser"}
forged_token = jwt.encode(
    forged_payload,
    public_key,           # attacker uses the public key as HMAC secret
    algorithm="HS256"     # server expected RS256, now verifies with public key
)
```
If the server does `jwt.decode(token, public_key, algorithms=["HS256", "RS256"])`, it verifies the HMAC correctly — using the public key the attacker knew.

### Attack 3: Weak Secret Brute-Force
HS256 JWTs signed with a short or guessable secret can be cracked offline:

```bash
# Using hashcat:
hashcat -a 0 -m 16500 <token> /usr/share/wordlists/rockyou.txt

# Using jwt_tool:
python3 jwt_tool.py <token> -C -d wordlist.txt
```

Once the secret is known, the attacker can forge tokens for any identity.

## How to Defend

- **Pin the algorithm server-side** — never read `alg` from the token header. Explicitly pass the expected algorithm: `jwt.decode(token, key, algorithms=["RS256"])`.
- **Use asymmetric keys (RS256/ES256) for cross-service tokens** — they separate signing from verification so a leaked verification key can't forge tokens.
- **Use strong secrets** — HS256 secrets should be at least 256 bits of random entropy, generated with a CSPRNG, never a human-readable string.
- **Validate all standard claims** — always check `exp` (expiry), `iss` (issuer), and `aud` (audience); many libraries won't do this automatically.
- **Rotate and revoke** — implement a token revocation list or use short expiry + refresh tokens so compromised tokens have a limited blast radius.

## Today's Challenge

1. Grab any JWT from a project you work on (or generate one at jwt.io).
2. Install [`jwt_tool`](https://github.com/ticarpi/jwt_tool): `pip install jwt_tool`
3. Run `python3 jwt_tool.py <your_token> -T` to tamper with it and observe what a server that doesn't pin its algorithm would accept.
4. Check your server's JWT decode call — does it explicitly list allowed algorithms, or does it accept whatever the token header says?

## Key Takeaway
JWTs are only as secure as the validation logic that checks them — trusting the token to tell you how to verify itself is like asking a suspect to grade their own alibi.
