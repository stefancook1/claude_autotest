# Rate Limiting & Brute Force

**Category:** App Security
**Date:** 2026-08-05
**Difficulty:** Intermediate

---

## What It Is

Brute force attacks systematically try every possible input — passwords, PINs, tokens, or API keys — until a correct one is found. Rate limiting is the primary countermeasure: restricting how many requests a client can make in a given time window. Without it, an attacker can automate millions of guesses per second against login endpoints, password reset flows, OTP fields, or any input that accepts secrets.

## Why It Matters

Credential-stuffing campaigns (a brute-force variant using leaked username/password pairs) are responsible for billions of compromised accounts annually. The 2022 Okta breach stemmed partly from attackers abusing poorly rate-limited authentication endpoints. A service with no rate limiting on `/login` can be fully enumerated in minutes on commodity hardware.

## Practical Example

A typical unprotected login endpoint:

```python
# VULNERABLE: no rate limiting
@app.route("/login", methods=["POST"])
def login():
    username = request.json["username"]
    password = request.json["password"]
    user = db.query(User).filter_by(username=username).first()
    if user and check_password(password, user.password_hash):
        return jsonify({"token": generate_token(user)})
    return jsonify({"error": "Invalid credentials"}), 401
```

An attacker runs this in under a second:

```bash
# Credential stuffing with a 10M leaked password list
hydra -L users.txt -P rockyou.txt \
      -t 64 -s 443 target.com https-post-form \
      "/login:username=^USER^&password=^PASS^:Invalid credentials"
```

At 64 threads, this chews through ~10,000 attempts per second. A 6-digit SMS OTP (1,000,000 combinations) falls in under 2 minutes with no throttling.

The subtle bypass: even when per-IP rate limiting is in place, attackers distribute requests across thousands of IPs (residential proxies) to stay under per-IP thresholds while maintaining high aggregate throughput. This is called a **distributed brute force** or **low-and-slow** attack.

## How to Defend

- **Rate limit by multiple dimensions**: limit per IP *and* per username/account. Neither alone is sufficient — IP rotation defeats IP-only limits; username locking is useless if attackers target many accounts simultaneously.
- **Implement exponential backoff with jailout**: after N failed attempts, insert increasing delays (1s, 2s, 4s…) and lock the account after a threshold. Notify the account owner on lockout.
- **Use CAPTCHA on suspicious traffic**: trigger a CAPTCHA challenge after 3–5 failures, or on high-velocity clients, rather than blocking outright (which causes DoS on legitimate forgetful users).
- **Monitor for credential stuffing patterns**: alert on high failure rates across many distinct usernames from the same IP range, ASN, or user-agent. Low per-account failure rates that look normal can still be an attack at the account-population level.
- **Enforce MFA**: even a cracked password is useless when TOTP or a hardware key is required. Rate limit OTP inputs separately — 3 attempts max before requiring re-authentication.

## Today's Challenge

1. Pick any login form you own or a local test app. Use [ffuf](https://github.com/ffuf/ffuf) or [hydra](https://github.com/vanhauser-thc/thc-hydra) against it with a small wordlist (e.g. `rockyou.txt` first 100 entries) and measure how fast guesses land.
2. Implement a simple in-memory rate limiter (e.g. using Redis `INCR` + `EXPIRE`) that caps each IP to 5 login attempts per 60 seconds. Re-run the test and observe the lockout.
3. Bonus: add per-username tracking so that even requests from different IPs for the same account are throttled.

## Key Takeaway

Rate limiting alone is not enough — effective brute force defense requires layered controls across IP, account, and behavioral dimensions, combined with MFA to make stolen credentials worthless.
