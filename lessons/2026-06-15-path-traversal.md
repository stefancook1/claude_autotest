# Path Traversal
**Category:** Application Security
**Date:** 2026-06-15
**Difficulty:** Beginner

---

## What It Is
Path traversal (also called directory traversal) happens when an application builds a filesystem path using user-supplied input without properly validating it, allowing an attacker to "escape" the intended directory using sequences like `../`. By manipulating the path, an attacker can read, write, or execute files outside the directory the application meant to expose — config files, source code, SSH keys, or credentials.

## Why It Matters
A single unvalidated file path can expose an entire server's filesystem, often leading to credential theft or remote code execution when combined with log/file write primitives. CVE-2021-41773/CVE-2021-42013 in Apache HTTP Server let attackers map URLs to files outside the document root and, in many configurations, achieve remote code execution via CGI — one of the most widely exploited bugs of that year.

## Practical Example
Vulnerable Node.js file server:

```javascript
app.get('/download', (req, res) => {
  const filename = req.query.file;
  res.sendFile(path.join(__dirname, 'uploads', filename));
});
```

An attacker requests:

```
GET /download?file=../../../../etc/passwd
```

`path.join` happily resolves `uploads/../../../../etc/passwd` to `/etc/passwd`, and the server sends back the system password file. URL-encoded variants (`%2e%2e%2f`, double encoding `%252e%252e%252f`, or null-byte tricks `file.txt%00.png` on older stacks) are common ways attackers bypass naive string filters like `filename.replace('../', '')`.

A vulnerable Python (Flask) equivalent:

```python
@app.route('/file')
def get_file():
    name = request.args.get('name')
    return open(f"/var/data/{name}").read()  # vulnerable
```

Payload: `/file?name=../../../../etc/shadow`

## How to Defend
- **Resolve and verify** — after joining the path, call `path.resolve()` (or `os.path.realpath`) and confirm the result still starts with the intended base directory before opening the file.
- **Use an allowlist of filenames or IDs** — instead of accepting raw filenames, map user input to a known-safe identifier (e.g., a database key) and look up the real path server-side.
- **Strip and reject, don't just replace** — reject any input containing `..`, null bytes, or absolute path prefixes (`/`, `C:\`) rather than trying to sanitize it in place (filters like `.replace('../', '')` are bypassable with `....//`).
- **Run with least privilege and chroot/sandbox** — even if a path check is bypassed, a process that can only see its own directory (via chroot, containers, or OS-level sandboxing) limits the damage.
- **Use framework-provided static file serving** (e.g., `express.static`, Django's `static` handling) which already normalizes and bounds paths, instead of hand-rolled file I/O.

## Today's Challenge
Find a piece of code in your project that builds a file path from user input (`req.query`, `req.params`, form fields, etc.) — common spots are file download/upload endpoints, template renderers, or image resizers. Try feeding it `../../../etc/passwd` or its URL-encoded form `..%2f..%2f..%2fetc%2fpasswd` and see what happens. Then add a check that resolves the final path and confirms it's still inside the expected base directory.

## Key Takeaway
Never trust a file path that contains user input — normalize it, then verify it's still inside the directory you expect, every single time.
