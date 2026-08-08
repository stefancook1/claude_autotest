# Input Validation Failures

**Category:** App Security
**Date:** 2026-08-08
**Difficulty:** Intermediate

---

## What It Is

Input validation failure occurs when an application accepts untrusted data without verifying that it meets expected constraints — type, length, format, range, or character set. Absent or weak validation allows attacker-controlled values to flow into logic, storage, or downstream systems in unexpected ways. It is the root cause underlying many distinct vulnerability classes including SQL injection, XSS, command injection, and path traversal.

## Why It Matters

A single missing validation check can cascade into full system compromise. The 2017 Equifax breach (CVE-2017-5638) exploited missing input validation in Apache Struts, exposing the personal records of 147 million people — one of the most costly data breaches in history.

## Practical Example

Consider a REST endpoint that accepts a user-supplied `age` parameter and writes it directly to a database query string:

```python
# VULNERABLE: no type or range check
@app.route("/profile")
def update_profile():
    age = request.args.get("age")          # attacker supplies "0 OR 1=1"
    db.execute(f"UPDATE users SET age = {age} WHERE id = {session['uid']}")
```

An attacker sends:

```
GET /profile?age=0;DROP TABLE users--
```

Because `age` was never validated to be a positive integer, the raw string reaches the query engine. The same pattern plays out differently depending on sink:

| Input sink       | Missing validation  | Result                         |
|------------------|---------------------|--------------------------------|
| SQL query        | Type check          | SQL injection                  |
| HTML template    | Encoding check      | XSS                            |
| Shell command    | Allowlist check     | Command injection              |
| File open()      | Path check          | Path traversal                 |
| `age` business field | Range check    | Negative age, integer overflow |

A minimal fix — validate early, validate strictly:

```python
from pydantic import BaseModel, conint

class ProfileUpdate(BaseModel):
    age: conint(ge=0, le=150)   # type + range enforced at boundary

@app.route("/profile")
def update_profile():
    data = ProfileUpdate(**request.args)  # raises 422 on bad input
    db.execute(
        "UPDATE users SET age = ? WHERE id = ?",
        (data.age, session["uid"])        # parameterized — belt AND suspenders
    )
```

## How to Defend

- **Validate at the trust boundary**: check all external input (HTTP params, headers, JSON bodies, file uploads, environment variables) immediately on entry — never after it has traversed internal code.
- **Use allowlists, not denylists**: define what is permitted (digits 0–9, length ≤ 3) rather than trying to enumerate what is forbidden. Attackers find the gaps denylists miss.
- **Enforce type, length, format, and range**: a field called `age` should never be a string, should never exceed three characters, and should never be negative — encode all four constraints explicitly.
- **Reject and return an error, don't sanitize**: stripping bad characters silently often creates new bypass opportunities. Fail fast with a clear error so the caller knows the input was invalid.
- **Use schema validation libraries**: Pydantic (Python), Zod (TypeScript/JS), Joi (Node.js), and Bean Validation (Java) enforce constraints declaratively and reduce human error versus hand-rolled checks.

## Today's Challenge

Pick any HTTP endpoint in a project you work on. Enumerate every parameter it accepts. For each one, ask:

1. Is there a type check? (string vs. int vs. UUID)
2. Is there a length check?
3. Is there a range or format check?
4. Is validation happening *before* the value touches any downstream sink?

If any answer is "no", write a failing test that sends a boundary-violating value and confirm the endpoint returns a 4xx rather than silently accepting it.

Bonus: run `bandit -r .` (Python) or `semgrep --config=auto` against your codebase and look for findings tagged `injection` — nearly all of them trace back to missing input validation.

## Key Takeaway

Input validation is not a feature to add later — it is the first line of defence that determines whether every other security control even gets a chance to work.
