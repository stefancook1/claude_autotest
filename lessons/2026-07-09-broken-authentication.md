# Broken Authentication

**Category:** App Security
**Date:** 2026-07-09
**Difficulty:** Intermediate

---

## What It Is

Broken Authentication refers to a class of flaws that allow attackers to compromise passwords, session tokens, or authentication flows — ultimately impersonating other users. It occurs when an application fails to correctly implement credential management, session handling, or multi-factor enforcement. Rather than a single vulnerability, it's a family of weaknesses that all lead to the same outcome: someone else logging in as you.

## Why It Matters

Authentication is the front door to every application. When it breaks, everything behind it becomes accessible — user data, admin panels, financial records, and more. A famous example is the 2012 LinkedIn breach (CVE-2012-1932 era): poorly hashed passwords (unsalted MD5/SHA-1) led to 117 million credentials being cracked and sold. The 2021 Twitch breach similarly exposed session tokens and source code due to inadequate access controls layered on top of weak authentication.

## Practical Example

### Scenario 1: Predictable Session Tokens

A common mistake is generating session IDs from weak entropy:

```python
# VULNERABLE: Session ID based on timestamp + username
import hashlib, time

def create_session(username):
    token = hashlib.md5(f"{username}{time.time()}".encode()).hexdigest()
    return token
```

An attacker who knows approximately when a user logged in can brute-force the token space — `time.time()` has limited precision, and MD5 is fast to compute at billions/second on a GPU.

### Scenario 2: No Account Lockout (Brute Force Invitation)

```python
# VULNERABLE: Unlimited login attempts, no rate limiting
@app.route("/login", methods=["POST"])
def login():
    username = request.form["username"]
    password = request.form["password"]
    user = db.query("SELECT * FROM users WHERE username = ?", username)
    if user and user.password == password:  # also: plaintext comparison!
        session["user_id"] = user.id
        return redirect("/dashboard")
    return "Invalid credentials", 401
```

Problems here: no lockout after N failures, plaintext password comparison, and the 401 response leaks that the *username* exists if you get a different error for unknown users.

### Scenario 3: Session Fixation

```python
# VULNERABLE: Session ID is never regenerated after login
@app.route("/login", methods=["POST"])
def login():
    user = authenticate(request.form["username"], request.form["password"])
    if user:
        session["user_id"] = user.id  # same session ID as before login!
        return redirect("/dashboard")
```

An attacker who can set the victim's session cookie (via XSS or network position) pre-login will inherit an authenticated session post-login.

### Realistic Attack Flow

```
1. Attacker sends victim to https://example.com/login?PHPSESSID=abc123
2. Victim logs in — server binds user_id to session abc123
3. Attacker uses Cookie: PHPSESSID=abc123 → authenticated as victim
```

## How to Defend

- **Use a proven library for session management.** Never roll your own. Use framework-native sessions (`express-session`, Django sessions, Flask-Login) backed by a cryptographically secure random ID (≥128 bits).
- **Regenerate session IDs on privilege changes.** Always issue a new session token immediately after login, sudo elevation, or role change — this kills session fixation.
- **Hash passwords properly.** Use `bcrypt`, `argon2id`, or `scrypt` with an appropriate work factor. Never MD5, SHA-1, or unsalted SHA-256 for passwords.
- **Enforce account lockout or progressive delays.** After 5–10 failed attempts, lock the account temporarily or add exponential backoff. Alert users on suspicious activity.
- **Require MFA for sensitive accounts.** Even a compromised password becomes useless without the second factor. TOTP (RFC 6238) is a practical starting point; passkeys are even better.

## Today's Challenge

Audit an authentication flow you own or have access to (a side project, a test app, or a deliberately vulnerable app like [DVWA](https://github.com/digininja/DVWA) or [WebGoat](https://owasp.org/www-project-webgoat/)):

1. Check: does login regenerate the session ID?  
   ```python
   # Flask: session.clear() + new session isn't enough; use login_user() from Flask-Login
   # Express: req.session.regenerate(callback)
   ```
2. Check: what happens after 20 rapid failed logins — are you ever throttled?
3. Run `hashcat --example-hashes` and find how long it would take to crack an MD5-hashed 8-character password on commodity hardware. (Spoiler: seconds.)

## Key Takeaway

Authentication is only as strong as its weakest link — a bad session ID, a missing lockout, or a weak hash can bypass even the most carefully designed authorization layer downstream.
