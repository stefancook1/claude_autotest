# Path Traversal

**Category:** App Security
**Date:** 2026-09-13
**Difficulty:** Intermediate

---

## What It Is

Path traversal (also called directory traversal) is an attack where an attacker manipulates file path inputs to access files and directories outside the intended scope. By injecting sequences like `../` (dot-dot-slash), attackers can "climb up" the directory tree and read, write, or execute files anywhere on the filesystem the server process can reach. The attack exploits the gap between what the application intends to expose and what the underlying OS will actually resolve.

## Why It Matters

A single exploitable path traversal can expose `/etc/passwd`, private keys, database credentials, source code, or any file the web server process can read. The 2022 Atlassian Confluence vulnerability (CVE-2022-26134) involved path-based exploitation that led to widespread remote code execution across thousands of unpatched instances.

## Practical Example

Consider a Node.js endpoint that serves files from a `public/` directory based on a query parameter:

```javascript
// VULNERABLE
app.get('/file', (req, res) => {
  const filename = req.query.name;
  const filePath = path.join('/var/www/app/public', filename);
  res.sendFile(filePath);
});
```

An attacker sends:
```
GET /file?name=../../../../etc/passwd
```

`path.join` resolves this to `/etc/passwd`, and the server returns the system password file. Variations include:

```
# URL-encoded
GET /file?name=..%2F..%2F..%2Fetc%2Fpasswd

# Double-encoded (bypass naive filters)
GET /file?name=..%252F..%252Fetc%252Fpasswd

# Mixed separators (Windows)
GET /file?name=..\..\..\windows\system32\drivers\etc\hosts

# Null byte injection (older PHP/C runtimes)
GET /file?name=../../etc/passwd%00.jpg
```

A fixed version:

```javascript
// SAFE
const ALLOWED_BASE = path.resolve('/var/www/app/public');

app.get('/file', (req, res) => {
  const filename = req.query.name;
  const resolved = path.resolve(ALLOWED_BASE, filename);

  // Ensure resolved path starts with the allowed base
  if (!resolved.startsWith(ALLOWED_BASE + path.sep)) {
    return res.status(403).send('Forbidden');
  }

  res.sendFile(resolved);
});
```

## How to Defend

- **Use `path.resolve` + prefix check**: Always resolve the final path and verify it starts with the intended base directory before accessing the file.
- **Never concatenate user input into file paths directly**: Use a lookup map or allowlist of permitted filenames instead of trusting the input as a literal path component.
- **Strip or reject `..` sequences early**: Before any path resolution, reject or sanitize inputs containing `..`, encoded variants (`%2e%2e`, `%252e`), null bytes, and non-standard separators.
- **Run with least privilege**: The web server process should only have read access to directories it legitimately needs. A traversal into `/etc/passwd` is far less useful if the process can't read it.
- **Use a purpose-built file-serving library or CDN**: Frameworks like Express's `express.static` handle containment correctly; prefer them over hand-rolled file serving.

## Today's Challenge

Audit a file-serving route in a project you own or a sample app:

1. Find any place where a user-controlled value touches a file path (look for `readFile`, `sendFile`, `open`, `fopen`, or similar).
2. Test it manually: can you reach `../../etc/passwd` (Linux) or `..\windows\win.ini` (Windows) through that parameter?
3. Apply the `path.resolve` + prefix check fix and confirm the traversal attempt now returns 403.

Bonus: run `find . -name "*.js" | xargs grep -n "path.join.*req\."` in a Node project to surface every location that might be vulnerable.

## Key Takeaway

Never trust user input as a safe file path component—always resolve and verify the final absolute path is inside your intended directory before touching the filesystem.
