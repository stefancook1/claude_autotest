# Insecure Direct Object References (IDOR)
**Category:** App Security
**Date:** 2026-07-12
**Difficulty:** Intermediate

---

## What It Is
Insecure Direct Object References (IDOR) occur when an application exposes a reference to an internal implementation object — such as a database record ID, filename, or account number — and fails to verify that the requesting user is actually authorized to access that object. The attacker simply manipulates the reference (e.g., changing `?account_id=1001` to `?account_id=1002`) to access someone else's data. Unlike many vulnerabilities, IDOR requires no special tools: just a browser and curiosity.

## Why It Matters
IDOR is consistently one of the most-reported vulnerability classes in bug bounty programs, responsible for mass data leaks affecting millions of users. A notable example: the 2019 Facebook IDOR bug allowed attackers to view private photos of any user by manipulating a photo album ID in an API call — even photos the user had never posted publicly.

## Practical Example

### Vulnerable code (Node.js/Express):
```javascript
// ❌ VULNERABLE: trusts the client-supplied ID with no authorization check
app.get('/api/invoices/:id', async (req, res) => {
  const invoice = await db.query(
    'SELECT * FROM invoices WHERE id = $1',
    [req.params.id]
  );
  res.json(invoice.rows[0]);
});
```

**Attack walkthrough:**
1. Attacker logs in as user A, downloads their own invoice at `GET /api/invoices/10042`
2. They notice the integer ID in the URL
3. They try `GET /api/invoices/10041`, `10043`, `10044`...
4. The server returns other users' invoices with no error

### The attacker's one-liner (curl):
```bash
# Iterate through invoice IDs to harvest all records
for id in $(seq 10000 10100); do
  curl -s -H "Cookie: session=attacker_session" \
    https://example.com/api/invoices/$id >> leaked_invoices.json
done
```

### Fixed code:
```javascript
// ✅ SAFE: verify ownership before returning data
app.get('/api/invoices/:id', authenticate, async (req, res) => {
  const invoice = await db.query(
    'SELECT * FROM invoices WHERE id = $1 AND user_id = $2',
    [req.params.id, req.user.id]   // <-- enforce ownership in the query
  );
  if (!invoice.rows[0]) return res.status(403).json({ error: 'Forbidden' });
  res.json(invoice.rows[0]);
});
```

## How to Defend
- **Enforce authorization server-side**: Every request for an object must check that the authenticated user owns or has permission to access it — never trust client-supplied IDs alone.
- **Bind queries to the session user**: Add `AND user_id = :current_user_id` (or equivalent) to all object-retrieval queries so the database itself enforces ownership.
- **Use indirect references**: Map internal IDs to per-user random tokens (e.g., UUIDs scoped to the session). Even if leaked, the token only works for that user.
- **Audit all endpoints that accept IDs**: Search your codebase for `req.params`, `req.query`, and `req.body` fields that end up in `WHERE id =` clauses — each one is a potential IDOR.
- **Test with two accounts**: The fastest IDOR check is logging in as user B and trying to access user A's resource IDs. Automate this in your test suite.

## Today's Challenge
Pick any web application (your own, or a bug bounty target). Find one endpoint that accepts an ID parameter. Log in as two different test users, and attempt to access user A's resources while authenticated as user B. If it succeeds without an error, you've found an IDOR. Document what authorization check is missing and write the fix.

**Bonus**: Use Burp Suite's "Intruder" module or a simple shell loop to enumerate a range of IDs and see what leaks. Compare the HTTP response sizes — a larger-than-expected body often signals a hit.

## Key Takeaway
IDOR is pure broken access control: the application authenticates who you are but never checks whether you're allowed to see what you're asking for — fixing it means binding every data lookup to the session owner on the server side.
