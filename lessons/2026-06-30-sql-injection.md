# SQL Injection
**Category:** App Security
**Date:** 2026-06-30
**Difficulty:** Beginner

---

## What It Is
SQL Injection (SQLi) happens when untrusted input is concatenated directly into a SQL query string instead of being passed as a parameter. The database can't tell the difference between "data" and "code," so attacker-controlled input that contains SQL syntax gets executed as part of the query. This lets an attacker read, modify, or delete data they were never authorized to touch.

## Why It Matters
SQLi has been on the OWASP Top 10 for over two decades and remains one of the most damaging bug classes because a single flaw can expose an entire database. The 2017 Equifax breach (143M records) and countless smaller incidents trace back to injection-class flaws — it's cheap to find, easy to automate, and catastrophic when it lands on a production database.

## Practical Example
Vulnerable code (Python + raw string formatting):

```python
username = request.args.get("username")
query = f"SELECT * FROM users WHERE username = '{username}'"
cursor.execute(query)
```

An attacker submits:

```
username = ' OR '1'='1' --
```

The resulting query becomes:

```sql
SELECT * FROM users WHERE username = '' OR '1'='1' --'
```

The `OR '1'='1'` makes the WHERE clause always true, returning every row (often the first one is used to log the attacker in as the first user — frequently an admin). The `--` comments out the rest of the original query, neutralizing the trailing quote.

A more aggressive payload could chain a second statement (if the driver allows stacked queries):

```
username = '; DROP TABLE users; --
```

## How to Defend
- Use parameterized queries / prepared statements for every query — never string-concatenate or f-string user input into SQL.
- Use an ORM (SQLAlchemy, Prisma, ActiveRecord, etc.) and avoid its raw-query escape hatches unless absolutely necessary, and even then parameterize.
- Apply least-privilege DB accounts — the app's DB user shouldn't have DROP/ALTER rights it doesn't need.
- Validate and allow-list input types where possible (e.g., numeric IDs should be cast to int, not passed as strings).
- Run static analysis / linters (e.g., Bandit, Semgrep) in CI to catch string-built queries before they ship.

## Today's Challenge
Grep your own codebase for `f"SELECT`, `"+ "` near `execute(`, or any `.execute(f"...")` / string-formatted SQL. If you find one, rewrite it using parameterized placeholders (`?` or `%s` depending on your driver) and confirm the query still works with a value containing a single quote (`O'Brien`) as a test case.

## Key Takeaway
If user input can change the *meaning* of your SQL query rather than just its *values*, you have a SQL injection vulnerability — parameterized queries are the fix, not input sanitization alone.
