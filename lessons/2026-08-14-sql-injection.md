# SQL Injection
**Category:** App Security
**Date:** 2026-08-14
**Difficulty:** Beginner

---

## What It Is
SQL Injection (SQLi) occurs when untrusted user input is concatenated directly into a SQL query, allowing an attacker to alter the query's logic. The database interprets the attacker's input as SQL commands rather than data. Because the database cannot distinguish between legitimate query structure and injected content, it executes whatever it receives.

## Why It Matters
SQLi remains one of the most exploited vulnerabilities year after year, capable of leading to full database dumps, authentication bypass, and in some configurations, remote code execution. The 2017 Equifax breach (CVE-2017-5638 via Apache Struts) and countless others trace a direct line to improperly sanitized input hitting a SQL backend.

## Practical Example

**Vulnerable Python (Flask + raw SQL):**

```python
@app.route('/login', methods=['POST'])
def login():
    username = request.form['username']
    password = request.form['password']
    query = f"SELECT * FROM users WHERE username='{username}' AND password='{password}'"
    user = db.execute(query).fetchone()
    if user:
        return "Logged in!"
    return "Invalid credentials"
```

**Attack payload — authentication bypass:**

```
username: admin'--
password: anything
```

The resulting query becomes:
```sql
SELECT * FROM users WHERE username='admin'--' AND password='anything'
```

Everything after `--` is a SQL comment. The password check is silently dropped, and the attacker logs in as `admin` with no valid credentials.

**Data exfiltration via UNION:**
```
username: ' UNION SELECT username, password, null FROM users--
password: x
```

This appends a second result set containing every username and password hash in the database.

**Blind SQLi (boolean-based):**
```
id=1 AND 1=1   -- returns normal page
id=1 AND 1=2   -- returns empty/error page
```

An attacker can infer database contents one bit at a time by observing which conditions produce different responses, even when no data is directly returned.

## How to Defend

- **Use parameterized queries / prepared statements** — never concatenate user input into SQL strings. The driver handles escaping at the protocol level:
  ```python
  cursor.execute("SELECT * FROM users WHERE username=? AND password=?", (username, password))
  ```
- **Use an ORM** (SQLAlchemy, Django ORM, Hibernate) that parameterizes by default — but still audit raw `execute()` calls and `text()` clauses.
- **Apply the principle of least privilege** — the database account used by your app should only have the permissions it needs (SELECT/INSERT on specific tables), not DBA or full schema access.
- **Validate and allowlist input where possible** — if a field only accepts integers, reject anything that isn't an integer before it ever reaches the query.
- **Enable WAF rules as a defense-in-depth layer** — not a replacement for parameterized queries, but a useful signal and speed bump.

## Today's Challenge

1. Spin up a local SQLite database with a `users` table (username, password columns).
2. Write a vulnerable login function using string concatenation.
3. Confirm you can bypass authentication with `' OR '1'='1`.
4. Rewrite the function using parameterized queries and confirm the same payload no longer works.

Bonus: Use `sqlmap` against a local test target (`sqlmap -u "http://localhost:5000/login" --data="username=test&password=test" --batch`) and observe what it finds on the vulnerable version vs. the fixed one.

## Key Takeaway
Parameterized queries make SQL Injection structurally impossible — the attacker's input can never be interpreted as SQL syntax, no matter what it contains.
