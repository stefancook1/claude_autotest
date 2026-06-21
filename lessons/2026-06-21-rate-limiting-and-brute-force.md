# Rate Limiting & Brute Force

**Category:** App Security
**Date:** 2026-06-21
**Difficulty:** Intermediate

---

## What It Is

Brute force attacks systematically try large numbers of credentials, tokens, or inputs until one works. Without rate limiting, a server happily processes every single attempt at full speed. Rate limiting is a control that restricts how many requests a client can make in a given time window — it's the lock that makes brute force economically infeasible.

## Why It Matters

Credential stuffing (using leaked username/password pairs against your app) is one of the most common attack vectors today. The 2022 Okta breach began with threat actors hammering a support tool; the 2024 Snowflake customer account compromises were credential stuffing at scale. Without rate limiting, a 10-million-record credential list can be tested in hours on a modern connection.

## Practical Example

### The Vulnerable Login Endpoint

```python
# Flask — NO rate limiting
@app.route("/login", methods=["POST"])
def login():
    username = request.json["username"]
    password = request.json["password"]
    user = db.query("SELECT * FROM users WHERE username = ?", username)
    if user and check_password(password, user.password_hash):
        return jsonify({"token": generate_token(user)})
    return jsonify({"error": "Invalid credentials"}), 401
```

An attacker runs this against your endpoint:

```bash
# Using hydra — tries 500 passwords/second against a single account
hydra -l victim@example.com -P rockyou.txt \
      -s 443 -S example.com https-post-form \
      "/login:username=^USER^&password=^PASS^:Invalid credentials"
```

At 500 req/s, a 10,000-password list is exhausted in 20 seconds. No lockout, no alarm.

### What an Attacker Targets

- `/login`, `/api/auth/token` — password brute force
- `/forgot-password` — OTP/reset-link enumeration
- `/api/verify-otp` — 6-digit OTPs have only 1,000,000 combinations
- `/api/v1/search` — resource enumeration (IDOR + brute force combined)

### The Fixed Version

```python
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

limiter = Limiter(
    app,
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"]
)

@app.route("/login", methods=["POST"])
@limiter.limit("5 per minute")          # tight limit on auth endpoints
@limiter.limit("20 per hour")           # and a longer-window backstop
def login():
    username = request.json["username"]
    password = request.json["password"]
    user = db.query("SELECT * FROM users WHERE username = ?", username)
    if user and check_password(password, user.password_hash):
        return jsonify({"token": generate_token(user)})
    # Constant-time response regardless of outcome — avoids timing oracle
    return jsonify({"error": "Invalid credentials"}), 401
```

Key additions: per-IP rate limit, consistent error responses, and a sliding window (not just a fixed counter that resets on the hour).

## How to Defend

- **Rate-limit by IP AND by account**: IP limits stop carpet-bombing; per-account limits stop low-and-slow attacks from distributed botnets (one attempt per IP, many IPs).
- **Add exponential backoff or CAPTCHA after failures**: After 3 failed attempts on an account, introduce a 2-second delay; after 5, serve a CAPTCHA.
- **Alert on anomalies, not just thresholds**: A single IP hitting 5 accounts with 4 failures each looks fine per-account but is obviously malicious at the aggregate level. Ship login failure events to your SIEM.
- **Use constant-time comparisons and uniform responses**: Don't leak whether a username exists via different error messages or response times.
- **Protect password reset and OTP flows equally**: Developers often lock down `/login` and forget `/verify-otp`, which has a much smaller search space.

## Today's Challenge

Pick any web app you have access to (your own project, a local dev environment, or a deliberately vulnerable app like DVWA or Juice Shop). Find a form-based login or OTP verification endpoint and answer:

1. Does it return a different error for "wrong username" vs "wrong password"? (username enumeration)
2. Can you send 100 requests in 60 seconds without getting blocked?
3. Is the `/forgot-password` flow rate-limited separately from `/login`?

Use `curl` in a loop or a tool like `Burp Suite`'s Intruder (community edition works) to probe it. Document what you find.

## Key Takeaway

Rate limiting turns an automated attack that takes minutes into one that takes years — it's not a perfect defense, but it forces attackers to operate at human speed.
