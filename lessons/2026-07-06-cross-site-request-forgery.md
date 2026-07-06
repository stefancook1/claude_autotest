# Cross-Site Request Forgery (CSRF)
**Category:** App Security
**Date:** 2026-07-06
**Difficulty:** Intermediate

---

## What It Is
Cross-Site Request Forgery (CSRF) tricks an authenticated user's browser into sending unauthorized requests to a trusted web application. Because the browser automatically attaches cookies to every request, the target server has no inherent way to distinguish a legitimate user action from one forged by a malicious third-party page. The attack exploits the browser's trust model, not a flaw in the user's credentials.

## Why It Matters
A successful CSRF attack can change account settings, transfer funds, post content, or take any action the victim user is authorized to perform—without them ever knowing. The 2012 attack against Netflix allowed external sites to add DVDs to any user's queue, and CSRF has appeared in banking portals (CVE-2020-5248 in GitHub Enterprise), demonstrating that even well-resourced teams miss it.

## Practical Example

**Scenario:** A banking app processes transfers via a simple POST:

```html
<!-- Legitimate form on bank.com -->
<form method="POST" action="https://bank.com/transfer">
  <input name="to"     value="alice">
  <input name="amount" value="100">
</form>
```

An attacker hosts `evil.com` with this auto-submitting page:

```html
<!-- evil.com/steal.html — auto-fires on page load -->
<form id="f" method="POST" action="https://bank.com/transfer">
  <input name="to"     value="attacker">
  <input name="amount" value="5000">
</form>
<script>document.getElementById('f').submit();</script>
```

If the victim is logged in to `bank.com` and visits `evil.com`, the browser sends the POST with the bank's session cookie attached. The server sees a valid authenticated request and processes the transfer.

**For GET-based state changes** it's even simpler:

```html
<img src="https://bank.com/transfer?to=attacker&amount=5000" hidden>
```

Just rendering the page triggers the request.

## How to Defend

- **Use CSRF tokens:** Generate a cryptographically random, per-session (or per-form) token, embed it in every state-changing form as a hidden field, and validate it server-side on every POST/PUT/DELETE/PATCH request.
  ```python
  # Flask-WTF example — token checked automatically
  from flask_wtf import FlaskForm
  class TransferForm(FlaskForm):
      to = StringField()
      amount = DecimalField()
  ```
- **`SameSite` cookie attribute:** Set session cookies to `SameSite=Lax` (safe default) or `SameSite=Strict`. This stops browsers from sending the cookie on cross-site requests in most cases. `SameSite=Strict` blocks even top-level navigations; `Lax` allows GET navigations but blocks cross-site POST.
  ```
  Set-Cookie: session=abc123; SameSite=Lax; Secure; HttpOnly
  ```
- **Verify the `Origin` / `Referer` header:** Reject state-changing requests whose `Origin` header doesn't match your expected domain. Not a standalone fix (can be spoofed in some edge cases), but a solid layer.
- **Require re-authentication for sensitive actions:** Prompting for a password before a wire transfer or account deletion stops CSRF even if other mitigations fail.
- **Use `fetch` + custom headers for APIs:** APIs consumed via `fetch` or `XMLHttpRequest` can require a custom header (e.g., `X-Requested-With: XMLHttpRequest`). Cross-origin requests can't set arbitrary headers without a CORS preflight, which the server can reject.

## Today's Challenge

1. Open a project you have access to and search for all state-changing endpoints (POST, PUT, DELETE routes).
2. Check whether each one validates a CSRF token. Note any that rely solely on session cookies with no additional check.
3. Pick one unprotected endpoint and sketch what a minimal CSRF token implementation would look like—generate the token on form render, store it in the session, validate on submit.
4. Bonus: set up a local browser profile, log in to a test app, then craft a simple HTML file that auto-submits a form to it. Confirm whether the cookie is sent and whether the server accepts the request. Then add `SameSite=Lax` and observe the difference.

## Key Takeaway
CSRF succeeds because browsers are too helpful—always attach CSRF tokens to state-changing requests and set `SameSite` on your session cookies so the browser's own rules become your first line of defense.
