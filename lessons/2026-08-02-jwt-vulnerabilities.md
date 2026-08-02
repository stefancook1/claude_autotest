# JWT Vulnerabilities

**Category:** App Security
**Date:** 2026-08-02
**Difficulty:** Intermediate

---

## What It Is

JSON Web Tokens (JWTs) are a widely-used standard for encoding claims between parties, commonly used for authentication and session management. A JWT has three Base64URL-encoded parts: a header (algorithm and type), a payload (claims), and a signature. Vulnerabilities arise when servers trust attacker-supplied headers, skip signature verification, or accept weak algorithms.

## Why It Matters

JWT flaws can let attackers forge tokens, impersonate any user—including admins—without knowing any secret. CVE-2022-21449 ("Psychic Signatures") let attackers bypass ECDSA signature verification in Java entirely with a blank signature. The "algorithm confusion" (none-algorithm) class of bugs has affected Auth0, Firebase, and dozens of home-rolled implementations.

## Practical Example

### 1. The `alg: none` Attack

A server generates a token signed with HS256:

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9   <- header: {"alg":"HS256","typ":"JWT"}
.eyJ1c2VyIjoiYWxpY2UiLCJyb2xlIjoidXNlciJ9  <- payload: {"user":"alice","role":"user"}
.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c  <- signature
```

The attacker:
1. Decodes the header and changes `"alg":"HS256"` to `"alg":"none"`
2. Decodes the payload and changes `"role":"user"` to `"role":"admin"`
3. Re-encodes both parts with Base64URL
4. Drops the signature (or keeps an empty string after the final `.`)

If the server's JWT library accepts `alg: none`, the forged token passes validation with no secret required.

### 2. RS256 → HS256 Confusion Attack

When a server normally uses RS256 (asymmetric), it verifies with the **public key**. An attacker:
1. Grabs the server's public key (often available at a JWKS endpoint)
2. Crafts a token with `"alg":"HS256"` and signs it **with the public key as the HMAC secret**
3. Sends the token to a server that doesn't pin the expected algorithm

A naive library sees HS256, uses the configured key (which happens to be the public key), and the signature checks out.

### Vulnerable code (Python/PyJWT old behavior):

```python
# DANGEROUS: trusts the algorithm from the token header
import jwt
payload = jwt.decode(token, public_key, algorithms=jwt.algorithms.get_default_algorithms())
```

### Secure code:

```python
# SAFE: explicitly pin the expected algorithm(s)
payload = jwt.decode(token, public_key, algorithms=["RS256"])
```

## How to Defend

- **Pin algorithms explicitly** — never pass `algorithms=get_default_algorithms()` or allow the token header to dictate the algorithm. Specify exactly `["HS256"]` or `["RS256"]` as appropriate.
- **Reject `alg: none`** — ensure your library's configuration or your own check explicitly refuses tokens with no algorithm.
- **Validate all claims** — always check `exp` (expiry), `iss` (issuer), and `aud` (audience). A structurally valid token with an expired timestamp or wrong issuer should be rejected.
- **Keep secrets strong and secret** — HS256 secrets should be at least 256 bits of entropy. Never hardcode them; rotate them on suspected compromise.
- **Use a battle-tested library** — avoid rolling your own JWT parsing. Prefer libraries with a strong security track record and check their CVE history before adopting.

## Today's Challenge

1. Grab [jwt.io](https://jwt.io) and decode any JWT you have lying around (from a local dev app, a CTF, or the example tokens on the site).
2. Look at the `alg` field in the header. Try changing it to `"none"` and removing the signature—does your application accept it?
3. Use [jwt_tool](https://github.com/ticarpi/jwt_tool) (`python3 jwt_tool.py <token> -X a`) to run the `alg: none` tamper test against a local test app.
4. Bonus: stand up a minimal Flask or Express app with HS256 tokens, then write a test that confirms a tampered token (changed payload, original signature) is rejected.

## Key Takeaway

Never let the token tell you how to verify itself—always pin the expected algorithm server-side and treat the JWT header as untrusted attacker input.
