# Insecure Direct Object References (IDOR)
**Category:** App Security
**Date:** 2026-08-26
**Difficulty:** Intermediate

---

## What It Is
Insecure Direct Object References (IDOR) occur when an application exposes internal implementation objects — such as database record IDs, file paths, or account numbers — directly in URLs or request parameters, and fails to verify that the requesting user is authorized to access that specific object. The server trusts the client-supplied identifier without checking ownership. This means any user who can manipulate the reference can access or modify data belonging to someone else.

## Why It Matters
IDOR is consistently one of the most commonly exploited vulnerabilities in bug bounty programs and real-world breaches. In 2021, a researcher discovered an IDOR in Parler that exposed every user's private post and personal data by simply incrementing an integer ID — enabling bulk harvesting of 32TB of data before the platform was taken down. IDOR flaws are trivial to exploit but often invisible to automated scanners, making them a favorite target for attackers.

## Practical Example

### Vulnerable scenario

A banking app shows a user their account statement at:

```
GET /api/accounts/10482/statement
Authorization: Bearer <user_A_token>
```

The server code:

```python
# VULNERABLE - no ownership check
@app.route("/api/accounts/<int:account_id>/statement")
@require_auth
def get_statement(account_id):
    statement = db.query("SELECT * FROM statements WHERE account_id = ?", account_id)
    return jsonify(statement)
```

Attacker simply changes the ID:

```
GET /api/accounts/10483/statement   ← another user's account
```

The server returns it without complaint because authentication (is the user logged in?) was checked but authorization (does this user own account 10483?) was not.

### Real attack pattern

1. Log in as a normal user, capture a request with your account ID.
2. Increment/decrement the ID in Burp Suite or with `curl`.
3. Check if the response contains another user's data.
4. Automate with a script to scrape at scale:

```bash
for id in $(seq 10000 10100); do
  curl -s -H "Authorization: Bearer $TOKEN" \
    "https://target.com/api/accounts/$id/statement" | jq '.owner_name'
done
```

### Less obvious IDOR variants

- **UUID-based IDOR**: UUIDs are hard to guess but if enumerable via another endpoint, still exploitable.
- **Indirect IDOR**: The exposed value is a filename (`/files/invoice_march.pdf`) rather than a numeric ID.
- **Mass Assignment IDOR**: Sending `{"user_id": 999}` in a request body to reassign ownership.

## How to Defend

- **Always check authorization server-side**: After authenticating the user, verify they own or have rights to the specific object before returning data. Never rely on the client to supply the correct owner ID.
- **Use indirect references**: Map user-specific tokens to real IDs server-side (e.g., store `{"tok_xyz": account_id}` in the session), so external IDs cannot be guessed or manipulated.
- **Enforce object-level authorization in a centralized middleware**: Don't scatter ownership checks across handlers — a single policy layer (like an ORM hook or middleware) catches the cases individual handlers miss.
- **Avoid exposing sequential integers**: Use UUIDs or random tokens for public-facing IDs to raise the cost of enumeration (not a substitute for authorization checks, but reduces opportunistic scraping).
- **Log and alert on unusual access patterns**: A user requesting 500 different account IDs in a minute is a signal worth alerting on even if each individual request looks valid.

## Today's Challenge

**Audit your own code for IDOR:**

1. Pick any endpoint in a project you work on that takes an ID parameter (from a URL, query string, or request body).
2. Trace the code path: is there an explicit check that the authenticated user owns that record, or does the code just fetch by ID and return it?
3. If you find a missing check, add it and write a test that:
   - Creates two users (user A and user B) and one resource owned by user A.
   - Authenticates as user B.
   - Requests user A's resource using its real ID.
   - Asserts the response is 403 Forbidden, not 200 OK.

Bonus: Run [Autorize](https://github.com/PortSwigger/autorize) (a Burp Suite extension) against a test environment of your app to automatically detect authorization bypasses across all endpoints.

## Key Takeaway
Authentication proves who you are; authorization proves what you're allowed to touch — IDOR happens when developers implement the first but forget the second, trusting users to only request their own data.
