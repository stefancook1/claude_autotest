# Cross-Site Request Forgery (CSRF)
**Category:** App Security
**Date:** 2026-08-20
**Difficulty:** Beginner

---

## What It Is
CSRF is an attack that tricks an authenticated user's browser into making an unwanted state-changing request to a site they are logged into. The vulnerable site trusts anything that arrives with the user's session cookie, so a request forged from a third-party page executes with the victim's full privileges. The victim never sees the action happen; only the browser needs to cooperate.

## Why It Matters
Any authenticated action that changes state, such as transferring funds, changing an email address, or modifying permissions, can be executed silently on behalf of the victim, and the resulting audit log will point at the victim, not the attacker. CSRF underpinned the 2008 ING Direct disclosure that allowed attackers to open certificates of deposit and transfer money in a victim's account, and it remains a recurring finding on admin panels and internal tools that assume "same-origin cookies are enough."

## Practical Example
Suppose `bank.example` exposes a transfer endpoint that trusts the session cookie:

```http
POST /api/transfer HTTP/1.1
Host: bank.example
Cookie: session=abc123
Content-Type: application/x-www-form-urlencoded

to=attacker&amount=5000
```

The attacker hosts `evil.example/lol-cats.html`:

```html
<h1>Cute cats</h1>
<form id="f" action="https://bank.example/api/transfer" method="POST">
  <input name="to" value="attacker">
  <input name="amount" value="5000">
</form>
<script>document.getElementById('f').submit();</script>
```

If the victim visits the page while logged into the bank, the browser auto-attaches the session cookie, the POST goes through, and $5,000 moves. No XSS, no stolen password, no interaction beyond loading a normal-looking page.

## How to Defend
- Set session cookies with `SameSite=Lax` (default in modern browsers) or `SameSite=Strict` for high-value sessions; this alone blocks most cross-site POSTs.
- Require a synchronizer token (CSRF token) on every state-changing request, bound to the user's session and validated server-side; reject requests without it.
- For SPAs and APIs, use the double-submit cookie pattern or a custom header (e.g. `X-Requested-With`) that cross-origin forms cannot set without CORS approval.
- Never accept state-changing operations over `GET`; restrict them to `POST`, `PUT`, `PATCH`, or `DELETE` and validate the `Origin` or `Referer` header.
- Re-authenticate (password, WebAuthn, or step-up MFA) for the most sensitive actions such as password change, funds transfer, or permission grants.

## Today's Challenge
Pick a small web app you own or a local dev instance. Open DevTools, log in, then inspect the session cookie: does it have `SameSite=Lax` or `Strict`? Find one state-changing endpoint and try to trigger it from a plain HTML file served on `http://localhost:8000` (`python3 -m http.server`) using a simple auto-submitting form like the one above. If it succeeds, you have a CSRF bug; add a token or a `SameSite` attribute and confirm the attack now fails.

## Key Takeaway
If your server treats "the cookie is present" as proof the user intended the action, an attacker's webpage can act as the user — bind every state change to a token or origin the attacker cannot forge.
