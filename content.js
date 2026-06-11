/* ============================================================
   PySOAR Prep — course content
   Block types used in `sections`:
     { h2: "..." }                     section heading
     { h3: "..." }                     sub-heading
     { p: "..." }                      paragraph (**bold**, `code` supported)
     { ul: ["...", ...] }              bullet list
     { code: "...", title: "..." }     python code block
     { callout: "tip"|"warn"|"star", title: "...", body: "..." }
   Quiz items: { q, code?, opts: [..], answer: idx, explain }
   ============================================================ */

const COURSE = {
  title: "PySOAR Prep",
  groups: [
    { name: "Python Core", modules: ["variables", "comprehensions", "decorators"] },
    { name: "Concurrency", modules: ["threading", "asyncio"] },
    { name: "SOAR Engineering", modules: ["json-correlation", "resilience", "slack", "pagerduty", "kubernetes"] },
    { name: "Interview Day", modules: ["mock-interview"] },
  ],
  modules: {

    /* ========================================================
       1. VARIABLES
       ======================================================== */
    "variables": {
      icon: "🧠",
      title: "Variables & Python's Memory Model",
      tagline: "Names, objects, mutability — the gotchas interviewers love.",
      desc: "How Python variables really work: names vs objects, mutability, scoping rules, and the classic traps.",
      sections: [
        { h2: "Names point to objects — they don't contain them" },
        { p: "In Python, a variable is a **name bound to an object**, not a box containing a value. Assignment never copies data; it makes a name point at an object. This single idea explains most 'surprising' Python behavior." },
        { code: `a = [1, 2, 3]
b = a            # b is a NEW NAME for the SAME list object
b.append(4)
print(a)         # [1, 2, 3, 4]  — a sees the change!
print(a is b)    # True — identical object (same id())

c = a[:]         # shallow copy: new list, same element objects
c.append(5)
print(a)         # [1, 2, 3, 4] — unaffected`, title: "names_vs_objects.py" },
        { callout: "star", title: "Interview gold", body: "Use the vocabulary: \"Assignment in Python binds a name to an object; `is` compares identity, `==` compares value.\" Saying this precisely signals senior-level understanding immediately." },

        { h2: "Mutable vs immutable types" },
        { ul: [
          "**Immutable:** `int`, `float`, `str`, `tuple`, `frozenset`, `bytes` — operations create new objects.",
          "**Mutable:** `list`, `dict`, `set`, `bytearray`, most custom classes — operations modify in place.",
          "A tuple is immutable, but it can *contain* mutable objects: `t = ([1], 2)` — `t[0].append(9)` works.",
        ]},
        { p: "Why it matters in SOAR work: alert payloads are usually nested dicts. If two parts of a playbook hold references to the same dict, an enrichment step in one branch silently mutates what the other branch sees." },
        { code: `import copy

alert = {"id": "A-1", "indicators": {"ips": ["10.0.0.5"]}}

view = alert                       # same object — dangerous
shallow = dict(alert)              # new outer dict, SHARED inner dicts
deep = copy.deepcopy(alert)        # fully independent

shallow["indicators"]["ips"].append("8.8.8.8")
print(alert["indicators"]["ips"])  # ['10.0.0.5', '8.8.8.8'] — leaked!
deep["indicators"]["ips"].append("1.1.1.1")
print(alert["indicators"]["ips"])  # unchanged — deepcopy isolated it`, title: "copy_semantics.py" },

        { h2: "The mutable default argument trap" },
        { p: "The most famous Python interview question. Default argument values are evaluated **once, at function definition time**, and shared across every call." },
        { code: `def add_indicator(ioc, bucket=[]):     # BUG: one shared list
    bucket.append(ioc)
    return bucket

print(add_indicator("evil.com"))       # ['evil.com']
print(add_indicator("10.6.6.6"))       # ['evil.com', '10.6.6.6']  !!

def add_indicator_fixed(ioc, bucket=None):
    if bucket is None:                 # idiomatic fix
        bucket = []
    bucket.append(ioc)
    return bucket`, title: "mutable_default.py" },

        { h2: "Scoping: the LEGB rule" },
        { p: "Python resolves names in this order: **L**ocal → **E**nclosing (closures) → **G**lobal (module) → **B**uilt-in. Assignment inside a function makes a name local for the *whole* function body — even before the assignment line." },
        { code: `counter = 0

def bad():
    counter += 1        # UnboundLocalError! assignment makes
                        # 'counter' local, read happens before bind

def with_global():
    global counter      # rebinds the module-level name
    counter += 1

def make_counter():
    n = 0
    def bump():
        nonlocal n      # rebinds the enclosing scope's name
        n += 1
        return n
    return bump

c = make_counter()
print(c(), c(), c())    # 1 2 3 — closure keeps state`, title: "legb.py" },
        { callout: "warn", title: "Common trap", body: "`UnboundLocalError` from `counter += 1` inside a function is a top-3 screen question. Explain *why*: the compiler sees the assignment and marks the name local for the entire scope." },

        { h2: "Interning & identity gotchas" },
        { code: `x = 256; y = 256
print(x is y)            # True  — small ints (-5..256) are cached
a = 257; b = 257
print(a is b)            # implementation-dependent! often False
s1 = "alert"; s2 = "alert"
print(s1 is s2)          # usually True (string interning), NOT guaranteed

# Rule: use == for values, is ONLY for None / sentinels
if s1 is not None: ...`, title: "interning.py" },
        { callout: "tip", title: "Rule of thumb", body: "Use `is` only with `None`, `True`, `False`, and sentinel objects. Everything else: `==`." },
      ],
      quiz: [
        { q: "What does this print?", code: `def f(x, acc=[]):\n    acc.append(x)\n    return acc\nf(1); f(2)\nprint(f(3))`, opts: ["[3]", "[1, 2, 3]", "[1]", "TypeError"], answer: 1,
          explain: "Default values are created once at **definition time**. All three calls share the same list, so it accumulates: [1, 2, 3]." },
        { q: "`b = a` where `a` is a list. What is `b`?", opts: ["A copy of the list", "A new name bound to the same list object", "A frozen snapshot", "A pointer that breaks if a is deleted"], answer: 1,
          explain: "Assignment binds a name to an object — no copying. Both names reference the **same** list; `del a` doesn't destroy the object while `b` still references it (refcounting)." },
        { q: "Which fixes `UnboundLocalError` when incrementing an enclosing function's variable inside a nested function?", opts: ["global n", "nonlocal n", "n = n + 1 first", "import n"], answer: 1,
          explain: "`nonlocal` rebinds a name in the nearest **enclosing function** scope. `global` would target module scope instead." },
        { q: "After `shallow = dict(alert)`, mutating a nested dict inside `shallow` affects `alert`. Why?", opts: ["dict() is lazy", "Shallow copies share references to nested objects", "Python caches dicts", "It doesn't — this is false"], answer: 1,
          explain: "A shallow copy creates a new outer container but the inner values are the **same objects**. Use `copy.deepcopy` for full isolation." },
        { q: "When is `is` the right comparison?", opts: ["Comparing strings", "Comparing against None or a sentinel", "Comparing ints under 257", "Whenever values are equal"], answer: 1,
          explain: "`is` checks identity (same object). Caching/interning makes it *appear* to work for small ints and some strings, but that's an implementation detail. Reserve `is` for `None` and sentinels." },
      ],
    },

    /* ========================================================
       2. COMPREHENSIONS
       ======================================================== */
    "comprehensions": {
      icon: "📜",
      title: "Comprehensions & Generators",
      tagline: "Transform alert data in one expressive line — and know when not to.",
      desc: "List/dict/set comprehensions, generator expressions, and memory-efficient pipelines for alert processing.",
      sections: [
        { h2: "The four comprehension forms" },
        { code: `events = [
    {"src": "10.0.0.5", "sev": 9, "type": "malware"},
    {"src": "10.0.0.7", "sev": 3, "type": "scan"},
    {"src": "10.0.0.5", "sev": 7, "type": "c2"},
]

# list comprehension — filter + transform
high = [e["src"] for e in events if e["sev"] >= 7]      # ['10.0.0.5', '10.0.0.5']

# set comprehension — automatic dedup (perfect for IOCs)
unique_ips = {e["src"] for e in events}                 # {'10.0.0.5', '10.0.0.7'}

# dict comprehension — build lookups
sev_by_ip = {e["src"]: e["sev"] for e in events}        # last write wins

# generator expression — lazy, constant memory
total = sum(e["sev"] for e in events)                   # no list built`, title: "four_forms.py" },
        { callout: "star", title: "SOAR flavor", body: "Set comprehensions are the idiomatic way to deduplicate indicators before hitting a rate-limited threat-intel API — mention that pairing in the interview." },

        { h2: "Anatomy & nesting" },
        { p: "The pattern is always `[EXPRESSION for ITEM in ITERABLE if CONDITION]`. Clauses nest left-to-right exactly like the equivalent for-loops:" },
        { code: `# flatten: one alert has many indicators
alerts = [{"id": 1, "iocs": ["a.com", "b.net"]},
          {"id": 2, "iocs": ["c.org"]}]

flat = [ioc for alert in alerts for ioc in alert["iocs"]]
# reads as:
#   for alert in alerts:
#       for ioc in alert["iocs"]:
#           yield ioc
# -> ['a.com', 'b.net', 'c.org']

# conditional EXPRESSION (ternary) goes before the for:
labels = ["HIGH" if e["sev"] >= 7 else "low" for e in events]`, title: "nesting.py" },
        { callout: "warn", title: "Readability bar", body: "Two `for` clauses is the practical maximum. A staff engineer is judged on judgment: say you'd refactor a triple-nested comprehension into a named helper or explicit loop." },

        { h2: "Generators: lazy pipelines" },
        { p: "A generator expression — or a function with `yield` — produces items **on demand**. Nothing is computed until you iterate, and only one item lives in memory at a time. This is how you process a 10 GB log file on a 512 MB pod." },
        { code: `def read_events(path):
    """Stream a huge JSONL alert export without loading it all."""
    with open(path) as f:
        for line in f:               # file objects are lazy iterators
            yield json.loads(line)

def critical(events):
    return (e for e in events if e["sev"] >= 9)   # genexp: still lazy

# pipeline: nothing runs until consumed; O(1) memory
for event in critical(read_events("export.jsonl")):
    page_oncall(event)

# CAUTION: generators are single-use
g = (x * x for x in range(3))
print(list(g))    # [0, 1, 4]
print(list(g))    # [] — exhausted!`, title: "lazy_pipeline.py" },
        { callout: "tip", title: "When to choose what", body: "Need the result multiple times, need `len()`, or need indexing → **list comprehension**. Streaming once through large data, or feeding `sum`/`any`/`max` → **generator expression**." },

        { h2: "Performance & pitfalls" },
        { ul: [
          "Comprehensions are faster than equivalent `for`+`append` loops (the loop runs in optimized bytecode).",
          "Since Python 3, comprehension variables don't leak into the enclosing scope.",
          "`any(check(e) for e in events)` short-circuits — pair `any`/`all` with genexps for early exit.",
          "Don't use a list comprehension only for side effects (`[print(x) for x in xs]`) — that's a loop.",
        ]},
        { code: `# walrus operator (3.8+): compute once, filter and keep
scores = [s for e in events if (s := risk_score(e)) > 70]

# zip + dict comp: stitch two parallel API responses together
hosts  = ["web-1", "web-2", "db-1"]
agents = ["ok", "stale", "ok"]
stale  = {h: a for h, a in zip(hosts, agents) if a == "stale"}`, title: "tricks.py" },
      ],
      quiz: [
        { q: "Best structure for deduplicating 50k IPs before enrichment lookups?", opts: ["List comprehension", "Set comprehension", "Nested for-loops with .count()", "dict.fromkeys only"], answer: 1,
          explain: "A set comprehension `{e['ip'] for e in events}` dedups in O(n) with hashing. (`dict.fromkeys` also works and preserves order, but the set comp is the canonical answer.)" },
        { q: "What does `[x for row in grid for x in row]` do?", opts: ["Transposes grid", "Flattens grid one level", "Cartesian product", "SyntaxError"], answer: 1,
          explain: "The clauses read left to right like nested loops: outer `for row in grid`, inner `for x in row` — a one-level flatten." },
        { q: "Key advantage of `sum(e['sev'] for e in stream)` over `sum([e['sev'] for e in stream])`?", opts: ["It's always faster", "Constant memory — no intermediate list", "It can be reused later", "It handles errors better"], answer: 1,
          explain: "The genexp feeds `sum` one value at a time — O(1) memory. The list version materializes everything first. (For small data the list can even be marginally faster, but memory is the interview answer.)" },
        { q: "What prints?", code: `g = (x + 1 for x in range(3))\nprint(sum(g), sum(g))`, opts: ["6 6", "6 0", "3 3", "TypeError"], answer: 1,
          explain: "Generators are single-use. The first `sum` consumes it (1+2+3=6); the second gets an exhausted generator → 0." },
        { q: "Where does the ternary go in a comprehension that maps high/low labels?", opts: ["After the if clause", "Before the for clause", "Inside the iterable", "Comprehensions can't use ternaries"], answer: 1,
          explain: "`[\"HIGH\" if s > 7 else \"low\" for s in sevs]` — a conditional *expression* is part of the output expression, before `for`. A trailing `if` (no else) is a *filter*." },
      ],
    },

    /* ========================================================
       3. DECORATORS
       ======================================================== */
    "decorators": {
      icon: "🎁",
      title: "Decorators & Closures",
      tagline: "Retry, rate-limit, and audit your playbook actions like a staff engineer.",
      desc: "Closures, the decorator pattern, functools.wraps, parameterized decorators, and real SOAR use cases.",
      sections: [
        { h2: "Functions are objects; decorators are wrappers" },
        { p: "A decorator is a callable that takes a function and returns a (usually wrapped) function. The `@` syntax is pure sugar: `@deco` above `def f` means `f = deco(f)`. The wrapper works because of **closures** — the inner function remembers variables from its enclosing scope." },
        { code: `import functools, time, logging

def audit(func):
    """Log every playbook action — who/what/how long."""
    @functools.wraps(func)              # preserve __name__, __doc__
    def wrapper(*args, **kwargs):
        start = time.perf_counter()
        try:
            return func(*args, **kwargs)
        finally:
            ms = (time.perf_counter() - start) * 1000
            logging.info("action=%s took=%.1fms", func.__name__, ms)
    return wrapper

@audit
def isolate_host(hostname: str) -> bool:
    """Quarantine a host via the EDR API."""
    ...

# equivalent to: isolate_host = audit(isolate_host)`, title: "audit_decorator.py" },
        { callout: "warn", title: "Always @functools.wraps", body: "Without it, `isolate_host.__name__` becomes 'wrapper' — breaking logging, debugging, and any registry keyed by function name. Forgetting `wraps` is the #1 decorator interview probe." },

        { h2: "Decorators with arguments (the three-layer cake)" },
        { p: "`@retry(attempts=3)` requires an extra layer: a **decorator factory** that takes the arguments and returns the actual decorator." },
        { code: `import functools, time, random

def retry(attempts=3, base_delay=1.0, exceptions=(Exception,)):
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            for attempt in range(1, attempts + 1):
                try:
                    return func(*args, **kwargs)
                except exceptions as exc:
                    if attempt == attempts:
                        raise
                    # exponential backoff + jitter — say "thundering herd"
                    delay = base_delay * 2 ** (attempt - 1)
                    time.sleep(delay + random.uniform(0, delay * 0.1))
        return wrapper
    return decorator

@retry(attempts=4, exceptions=(TimeoutError, ConnectionError))
def fetch_threat_intel(ioc: str) -> dict:
    ...`, title: "retry_decorator.py" },
        { callout: "star", title: "SOAR flavor", body: "Retry-with-exponential-backoff-and-jitter around flaky security-tool APIs is the single most realistic decorator example for a SOAR interview. Know it cold — you may be asked to write it on a whiteboard." },

        { h2: "Practical patterns you should name-drop" },
        { ul: [
          "**Rate limiting** — wrap VirusTotal/AbuseIPDB calls to respect 4-req/min quotas.",
          "**Caching** — `@functools.lru_cache(maxsize=1024)` for repeated IOC lookups within a run (immutable/hashable args only).",
          "**Registration** — a `@register_action(\"isolate_host\")` decorator that adds playbook actions to a dispatch table; this is how SOAR platforms map playbook YAML to Python handlers.",
          "**Auth/permission checks** — verify the runbook context has the right scope before a destructive action.",
        ]},
        { code: `ACTIONS: dict[str, callable] = {}

def register_action(name: str):
    def decorator(func):
        ACTIONS[name] = func            # side effect at import time
        return func                     # note: returned unwrapped
    return decorator

@register_action("block_ip")
def block_ip(ip: str) -> dict: ...

@register_action("disable_user")
def disable_user(upn: str) -> dict: ...

# the playbook engine dispatches by name:
def run_step(step: dict):
    return ACTIONS[step["action"]](**step["args"])`, title: "action_registry.py" },

        { h2: "Class decorators & method decorators" },
        { code: `from functools import cached_property
from dataclasses import dataclass     # dataclass is itself a class decorator!

@dataclass(frozen=True)
class Indicator:
    value: str
    kind: str                          # "ip" | "domain" | "hash"

class EnrichmentClient:
    @staticmethod
    def normalize(ioc: str) -> str:    # no self — pure helper
        return ioc.strip().lower()

    @classmethod
    def from_env(cls):                 # alternative constructor
        return cls(api_key=os.environ["TI_KEY"])

    @cached_property                   # computed once per instance
    def session(self):
        return make_authenticated_session(self.api_key)`, title: "builtin_decorators.py" },
        { callout: "tip", title: "Stacking order", body: "Decorators apply bottom-up: the one closest to `def` wraps first. `@a` over `@b` over `def f` is `f = a(b(f))`." },
      ],
      quiz: [
        { q: "`@deco` above `def f(): ...` is equivalent to:", opts: ["f = deco(f)", "deco = f(deco)", "f.deco = True", "f = deco.__call__"], answer: 0,
          explain: "Decorator syntax is sugar for reassignment: the function is passed to the decorator and the name is rebound to whatever it returns." },
        { q: "What breaks if you omit `@functools.wraps(func)` in a wrapper?", opts: ["The wrapper raises TypeError", "func runs twice", "__name__/__doc__/introspection of the decorated function", "Closures stop working"], answer: 2,
          explain: "The decorated function's metadata becomes the wrapper's (`__name__ == 'wrapper'`), breaking logs, docs, pickling, and name-keyed registries." },
        { q: "Why does `@retry(attempts=3)` need three nested functions?", opts: ["Python requires it for speed", "Factory takes args → returns decorator → returns wrapper", "To create three stack frames", "It doesn't; two always suffice"], answer: 1,
          explain: "`retry(attempts=3)` is a **call** that must return a decorator; that decorator receives the function and returns the wrapper. Args → decorator → wrapper." },
        { q: "With `@a` stacked above `@b` on `def f`, what is f?", opts: ["b(a(f))", "a(b(f))", "a(f) then b(f) separately", "Undefined order"], answer: 1,
          explain: "Decorators apply bottom-up: `b` wraps the raw function first, then `a` wraps the result — `f = a(b(f))`." },
        { q: "Best built-in for memoizing repeated `lookup(ioc: str)` calls within a process?", opts: ["@staticmethod", "@functools.lru_cache", "@property", "@dataclass"], answer: 1,
          explain: "`@functools.lru_cache(maxsize=...)` caches by argument value (args must be hashable). Perfect for de-duplicating threat-intel lookups in one run; mention TTL caching (cachetools) for long-lived processes." },
      ],
    },

    /* ========================================================
       4. THREADING
       ======================================================== */
    "threading": {
      icon: "🧵",
      title: "Threading & the GIL",
      tagline: "Fan out 200 enrichment calls without melting the playbook engine.",
      desc: "The GIL, when threads help, ThreadPoolExecutor, locks, queues, and thread-safety in playbooks.",
      sections: [
        { h2: "The GIL: what it actually means" },
        { p: "CPython's **Global Interpreter Lock** allows only one thread to execute Python bytecode at a time. Consequences:" },
        { ul: [
          "**CPU-bound** work (hash cracking, parsing 5 GB of JSON) does **not** speed up with threads — use `multiprocessing` or native libraries.",
          "**I/O-bound** work (HTTP calls to EDR/SIEM/TI APIs, DB queries) speeds up dramatically — the GIL is **released while waiting on I/O**, so other threads run.",
          "SOAR workloads are overwhelmingly I/O-bound → threads (or asyncio) are the right tool almost every time.",
        ]},
        { callout: "star", title: "The staff-level answer", body: "\"The GIL serializes bytecode execution, but it's released during blocking I/O — so threads are great for our API-heavy SOAR workloads and useless for CPU-bound parsing, where I'd reach for multiprocessing or offload to a worker service.\" Also worth noting: Python 3.13+ ships an experimental free-threaded (no-GIL) build." },

        { h2: "ThreadPoolExecutor: the 90% solution" },
        { p: "Don't hand-roll `threading.Thread` for fan-out work. `concurrent.futures` gives you pooling, result collection, and exception propagation." },
        { code: `from concurrent.futures import ThreadPoolExecutor, as_completed

def enrich(ioc: str) -> dict:
    r = session.get(f"https://ti.example.com/v1/ioc/{ioc}", timeout=10)
    r.raise_for_status()
    return {"ioc": ioc, **r.json()}

iocs = extract_iocs(alert)            # e.g. 200 indicators

results, failures = [], []
with ThreadPoolExecutor(max_workers=16) as pool:
    futures = {pool.submit(enrich, i): i for i in iocs}
    for fut in as_completed(futures):          # yields as they finish
        try:
            results.append(fut.result())       # re-raises worker errors
        except Exception as exc:
            failures.append((futures[fut], exc))

# pool.map(enrich, iocs) is simpler but stops summarizing on first error
# and returns results in input order, not completion order.`, title: "fan_out_enrichment.py" },
        { callout: "tip", title: "Sizing the pool", body: "For I/O-bound work, workers can exceed CPU count (16–64 is common), bounded by what the downstream API tolerates. Saying 'I'd size the pool to the API's rate limit, not the CPU' is a strong systems answer." },

        { h2: "Race conditions & locks" },
        { p: "Even with the GIL, compound operations like `count += 1` (read-modify-write) are **not atomic** — a thread can be preempted between bytecodes. Shared mutable state needs a lock." },
        { code: `import threading

class StatsCollector:
    def __init__(self):
        self._lock = threading.Lock()
        self._counts: dict[str, int] = {}

    def record(self, verdict: str):
        with self._lock:                    # context manager: always released
            self._counts[verdict] = self._counts.get(verdict, 0) + 1

# Other primitives to name:
# threading.RLock     — re-entrant (same thread can re-acquire)
# threading.Semaphore — cap concurrent access (poor man's rate limit)
# threading.Event     — signal "shutdown requested" to workers
# queue.Queue         — THE thread-safe handoff structure`, title: "locking.py" },

        { h2: "Producer/consumer with queue.Queue" },
        { code: `import queue, threading

q: "queue.Queue[dict]" = queue.Queue(maxsize=1000)   # bounded = backpressure
STOP = object()                                       # sentinel

def consumer():
    while True:
        alert = q.get()
        if alert is STOP:
            q.task_done(); break
        try:
            triage(alert)
        finally:
            q.task_done()

workers = [threading.Thread(target=consumer, daemon=True) for _ in range(8)]
for w in workers: w.start()

for alert in poll_siem():
    q.put(alert)            # blocks when full — natural backpressure

q.join()                    # wait until every task_done() called
for _ in workers: q.put(STOP)`, title: "producer_consumer.py" },
        { callout: "warn", title: "Words to use", body: "**Backpressure** (bounded queue stops a fast producer from OOMing slow consumers), **sentinel shutdown**, and **daemon threads die with the process — don't rely on them for cleanup**. These three terms separate staff candidates from mid-level." },

        { h2: "Threads vs processes vs asyncio — the decision table" },
        { ul: [
          "**I/O-bound, moderate concurrency (≤ ~100), sync libraries** → `ThreadPoolExecutor`.",
          "**I/O-bound, massive concurrency (1000s of sockets), async libraries available** → `asyncio`.",
          "**CPU-bound** → `multiprocessing` / `ProcessPoolExecutor` (separate interpreters, no shared GIL).",
          "**Mixed** → asyncio event loop + `loop.run_in_executor()` for the blocking bits.",
        ]},
      ],
      quiz: [
        { q: "Why do threads speed up 200 parallel threat-intel HTTP calls despite the GIL?", opts: ["The GIL only applies to loops", "The GIL is released during blocking I/O", "requests is written in C", "They don't — it's a myth"], answer: 1,
          explain: "Blocking I/O (sockets, file reads) releases the GIL, letting other threads execute while one waits. CPU-bound bytecode is where the GIL serializes you." },
        { q: "Is `count += 1` thread-safe in CPython?", opts: ["Yes — the GIL guarantees it", "No — it's a read-modify-write across multiple bytecodes", "Only for ints below 256", "Only inside a class"], answer: 1,
          explain: "The GIL ensures one bytecode at a time, but `+=` is several bytecodes (LOAD, ADD, STORE). A thread switch in between loses updates. Use a `Lock`." },
        { q: "A playbook step must parse and regex-scan 4 GB of logs as fast as possible. Best tool?", opts: ["ThreadPoolExecutor with 64 workers", "asyncio.gather", "ProcessPoolExecutor / multiprocessing", "More threads + a bigger GIL"], answer: 2,
          explain: "That's CPU-bound — threads all contend for one GIL. Processes get independent interpreters (own GILs) and real parallelism across cores." },
        { q: "Main benefit of a **bounded** `queue.Queue(maxsize=N)` between SIEM poller and triage workers?", opts: ["Faster puts", "Backpressure — producer blocks instead of exhausting memory", "Automatic retries", "Orders alerts by severity"], answer: 1,
          explain: "If consumers fall behind, an unbounded queue grows until OOM. A bounded queue blocks the producer — built-in backpressure." },
        { q: "How do exceptions raised inside a ThreadPoolExecutor task surface?", opts: ["They kill the main thread immediately", "They're printed and ignored", "Re-raised when you call future.result()", "Stored in thread.error"], answer: 2,
          explain: "The exception is captured in the Future and re-raised at `.result()` (or by iterating `pool.map`). If you never check results, failures vanish silently — a classic production bug." },
      ],
    },

    /* ========================================================
       5. ASYNCIO
       ======================================================== */
    "asyncio": {
      icon: "⚡",
      title: "Asyncio & Async Patterns",
      tagline: "One event loop, thousands of concurrent API calls, zero threads.",
      desc: "Event loop mental model, async/await, gather, semaphores, timeouts, and async SOAR playbook patterns.",
      sections: [
        { h2: "The mental model" },
        { p: "asyncio is **cooperative single-threaded concurrency**. One event loop runs many coroutines; a coroutine voluntarily yields control at every `await`, and the loop switches to whoever is ready. No preemption, no GIL contention, no locks for most state — but **one blocking call freezes everything**." },
        { code: `import asyncio

async def enrich(ioc: str) -> dict:        # 'async def' -> coroutine function
    await asyncio.sleep(0.1)               # await = yield to the event loop
    return {"ioc": ioc, "verdict": "malicious"}

async def main():
    # Sequential: ~0.3s total
    a = await enrich("a.com")
    b = await enrich("b.net")

    # Concurrent: ~0.1s total — THIS is the point of asyncio
    results = await asyncio.gather(
        enrich("a.com"), enrich("b.net"), enrich("c.org"),
        return_exceptions=True,            # collect errors, don't abort all
    )

asyncio.run(main())                        # one entry point per program`, title: "asyncio_basics.py" },
        { callout: "warn", title: "Top interview trap", body: "Calling a coroutine function does NOT run it — `enrich(\"a.com\")` just creates a coroutine object. It runs only when awaited or wrapped in a task. 'Coroutine was never awaited' warnings mean exactly this." },

        { h2: "Tasks: start now, await later" },
        { code: `async def main():
    # create_task schedules immediately on the loop
    intel_task = asyncio.create_task(fetch_threat_intel(ioc))
    edr_task   = asyncio.create_task(fetch_edr_timeline(host))

    siem = await fetch_siem_context(alert_id)   # runs while tasks proceed
    intel = await intel_task
    edr   = await edr_task

    # Python 3.11+ structured concurrency — auto-cancel siblings on failure:
    async with asyncio.TaskGroup() as tg:
        t1 = tg.create_task(fetch_threat_intel(ioc))
        t2 = tg.create_task(fetch_edr_timeline(host))
    # leaving the block guarantees both finished or were cancelled`, title: "tasks.py" },

        { h2: "Real-world controls: limits, timeouts, retries" },
        { p: "Unbounded `gather` over 5,000 IOCs will get you rate-limited or banned. Production async code is mostly about **bounding** concurrency:" },
        { code: `import asyncio, aiohttp

SEM = asyncio.Semaphore(10)               # max 10 in-flight requests

async def enrich(session: aiohttp.ClientSession, ioc: str) -> dict:
    async with SEM:                       # bound concurrency
        async with asyncio.timeout(5):    # 3.11+; older: wait_for
            async with session.get(f"/v1/ioc/{ioc}") as resp:
                if resp.status == 429:    # respect Retry-After
                    await asyncio.sleep(float(resp.headers.get("Retry-After", 2)))
                    return await enrich(session, ioc)
                resp.raise_for_status()
                return await resp.json()

async def enrich_all(iocs: list[str]) -> list[dict]:
    async with aiohttp.ClientSession(
        base_url="https://ti.example.com",
        headers={"Authorization": f"Bearer {TOKEN}"},
    ) as session:
        return await asyncio.gather(*(enrich(session, i) for i in iocs))`, title: "bounded_enrichment.py" },
        { callout: "star", title: "SOAR flavor", body: "This exact shape — semaphore + timeout + 429 handling around a threat-intel API — is the canonical 'write some async code' interview exercise for SOAR roles. Practice typing it from memory." },

        { h2: "Mixing sync and async (the part everyone gets wrong)" },
        { ul: [
          "A blocking call (`requests.get`, `time.sleep`, heavy CPU) inside a coroutine **stalls the entire event loop** — every other task stops.",
          "Wrap unavoidable blocking calls: `await asyncio.to_thread(legacy_sdk.lookup, ioc)` (3.9+) or `loop.run_in_executor(None, fn, *args)`.",
          "Going the other direction (calling async from sync): `asyncio.run(coro())` at top level; inside a running loop use `asyncio.run_coroutine_threadsafe`.",
          "Use `asyncio.Lock`/`asyncio.Queue` (not the `threading` versions) inside coroutines — the threading ones block the loop.",
        ]},
        { code: `async def hybrid_playbook(alert):
    # vendor SDK is sync-only — push it to a thread, keep the loop alive
    edr = await asyncio.to_thread(edr_sdk.get_host, alert["host"])
    intel = await enrich_all(alert["iocs"])      # native async
    return correlate(edr, intel)`, title: "to_thread.py" },

        { h2: "asyncio vs threads — the one-liner" },
        { p: "**Threads:** preemptive, work with any (sync) library, fine for ≤ ~hundreds of concurrent ops. **asyncio:** cooperative, needs async-aware libraries (`aiohttp`, `asyncpg`), scales to tens of thousands of concurrent ops with explicit, readable switch points. Both are for I/O; neither helps CPU-bound work." },
      ],
      quiz: [
        { q: "What does `coro = fetch(url)` do when `fetch` is `async def`?", opts: ["Runs fetch to completion", "Starts fetch in the background", "Creates a coroutine object; nothing runs yet", "Raises unless inside a loop"], answer: 2,
          explain: "Calling a coroutine function only builds a coroutine object. It executes when awaited, or scheduled via `asyncio.create_task`." },
        { q: "Inside a coroutine, `time.sleep(5)` instead of `await asyncio.sleep(5)` causes:", opts: ["No difference", "Only that coroutine pauses", "The entire event loop freezes for 5s", "A SyntaxError"], answer: 2,
          explain: "asyncio is single-threaded and cooperative. A blocking call never yields to the loop, so **every** task stalls. This is the most common production asyncio bug." },
        { q: "Standard way to cap concurrent API calls at 10 across 5,000 coroutines?", opts: ["asyncio.Semaphore(10)", "max_tasks=10 in gather", "ThreadPoolExecutor(10)", "Batches of 10 with sleep"], answer: 0,
          explain: "Acquire an `asyncio.Semaphore(10)` inside each coroutine (`async with sem:`). gather has no built-in limit; batching wastes time waiting for each batch's slowest call." },
        { q: "`asyncio.gather(*tasks, return_exceptions=True)` does what on a task failure?", opts: ["Cancels all other tasks", "Returns the exception object in the results list", "Retries the failed task", "Raises immediately"], answer: 1,
          explain: "Exceptions are returned in-place in the results so other tasks complete — you must check `isinstance(r, Exception)` afterward. Without the flag, the first error propagates (others keep running unawaited). TaskGroup, by contrast, cancels siblings." },
        { q: "A vendor's sync-only SDK call must run inside your async playbook. Best approach?", opts: ["Call it directly — it's quick", "await asyncio.to_thread(sdk.call, arg)", "Rewrite the SDK", "asyncio.run(sdk.call())"], answer: 1,
          explain: "`asyncio.to_thread` runs the blocking call in a worker thread and awaits the result, keeping the event loop responsive. Direct calls block the loop; `asyncio.run` can't nest inside a running loop." },
      ],
    },

    /* ========================================================
       6. JSON CORRELATION
       ======================================================== */
    "json-correlation": {
      icon: "🔗",
      title: "JSON Correlation & Enrichment",
      tagline: "Normalize, join, and enrich alerts from five tools that all disagree.",
      desc: "Parsing safely, normalizing heterogeneous alert schemas, correlating on indicators, and enriching with external intel.",
      sections: [
        { h2: "json module fundamentals" },
        { code: `import json

payload = json.loads(raw_text)            # str/bytes -> Python objects
text    = json.dumps(payload, indent=2, sort_keys=True)
obj     = json.load(open("alert.json"))   # file -> object (use 'with'!)

# Safe navigation of untrusted vendor payloads:
sev = payload.get("event", {}).get("severity", 0)      # chained .get
ip  = (payload.get("src") or {}).get("ip")             # survives src=None

# Non-serializable types need help:
json.dumps({"t": datetime.utcnow()}, default=str)      # or a custom encoder

# JSONL (one object per line) is the streaming-friendly export format:
events = [json.loads(line) for line in f if line.strip()]`, title: "json_basics.py" },
        { callout: "warn", title: "Trap", body: "`json.loads` raises `json.JSONDecodeError` (a `ValueError` subclass) on bad input. Webhooks WILL send you malformed bodies — always handle it, log the raw payload, and dead-letter it rather than crash the consumer." },

        { h2: "Normalize first: the canonical alert" },
        { p: "Five tools, five schemas: CrowdStrike says `device.hostname`, Splunk says `host`, the EDR webhook says `agent.name`. The staff-level move is a **normalization layer** that maps every source into one canonical model *before* any correlation logic — so playbooks are written once, against one shape." },
        { code: `from dataclasses import dataclass, field
from datetime import datetime, timezone

@dataclass
class CanonicalAlert:
    source: str
    alert_id: str
    timestamp: datetime
    severity: int                      # normalized 0-10
    host: str | None = None
    src_ip: str | None = None
    user: str | None = None
    iocs: set[str] = field(default_factory=set)
    raw: dict = field(default_factory=dict, repr=False)   # keep original!

def from_crowdstrike(d: dict) -> CanonicalAlert:
    return CanonicalAlert(
        source="crowdstrike",
        alert_id=d["detection_id"],
        timestamp=datetime.fromtimestamp(d["created_timestamp"], tz=timezone.utc),
        severity=round(d.get("max_severity", 0) / 10),   # 0-100 -> 0-10
        host=d.get("device", {}).get("hostname", "").lower() or None,
        iocs={i["value"] for i in d.get("iocs", [])},
        raw=d,
    )

NORMALIZERS = {"crowdstrike": from_crowdstrike, "splunk": from_splunk}

def normalize(source: str, payload: dict) -> CanonicalAlert:
    return NORMALIZERS[source](payload)`, title: "normalize.py" },
        { callout: "star", title: "Say this in the interview", body: "\"I normalize at the edge and keep the raw payload attached for audit/debugging. Pydantic models give me validation for free at the trust boundary; dataclasses are fine for internal shapes.\" Mentioning OCSF or ECS as target schemas is a bonus." },

        { h2: "Correlating across sources" },
        { p: "Correlation is fundamentally a **join**. Build hash-map indexes on join keys (IP, host, user, IOC) so matching is O(n+m), never O(n×m) nested loops." },
        { code: `from collections import defaultdict
from datetime import timedelta

def correlate(edr: list[CanonicalAlert], siem: list[CanonicalAlert],
              window: timedelta = timedelta(minutes=15)):
    """Group EDR + SIEM alerts hitting the same host within a window."""
    by_host: dict[str, list] = defaultdict(list)
    for a in siem:
        if a.host:
            by_host[a.host].append(a)            # index once: O(m)

    incidents = []
    for e in edr:                                 # probe: O(n)
        for s in by_host.get(e.host, []):
            if abs(e.timestamp - s.timestamp) <= window:
                incidents.append({
                    "host": e.host,
                    "alerts": [e.alert_id, s.alert_id],
                    "severity": max(e.severity, s.severity),
                    "shared_iocs": e.iocs & s.iocs,     # set intersection!
                })
    return incidents`, title: "correlate.py" },
        { ul: [
          "**Set operations are your friend:** `alert_iocs & known_bad` (intersection), `seen - allowlisted` (difference).",
          "**Time-window joins:** sort by timestamp; for large volumes mention bucketing by `timestamp // window` or two-pointer sweeps.",
          "**Dedup/fan-in:** a stable correlation key like `hash((host, rule_id, day))` collapses alert storms into one incident — the same idea as PagerDuty's dedup_key.",
        ]},

        { h2: "Enrichment with external JSON APIs" },
        { code: `def enrich_incident(incident: dict, ti_client) -> dict:
    """Decorate an incident with threat-intel context."""
    verdicts = {}
    for ioc in incident["shared_iocs"]:
        try:
            intel = ti_client.lookup(ioc)          # external JSON API
            verdicts[ioc] = {
                "score": intel.get("reputation", {}).get("score", 0),
                "malware_families": intel.get("malware", []),
                "first_seen": intel.get("first_seen"),
            }
        except ApiError as exc:
            verdicts[ioc] = {"error": str(exc)}    # enrich is best-effort:
                                                   # never fail the incident
    incident["intel"] = verdicts
    incident["confidence"] = (
        "high" if any(v.get("score", 0) > 80 for v in verdicts.values())
        else "needs-review"
    )
    return incident`, title: "enrich.py" },
        { callout: "tip", title: "Design principles to state", body: "Enrichment is **best-effort and non-blocking** (an intel outage must not stop triage); results are **cached** (TTL ≈ intel freshness); lookups are **deduplicated and batched** to respect quotas; and every verdict records **which source said so and when**." },
      ],
      quiz: [
        { q: "A vendor webhook sends invalid JSON. `json.loads` raises:", opts: ["KeyError", "json.JSONDecodeError (a ValueError)", "TypeError", "Nothing — returns None"], answer: 1,
          explain: "`JSONDecodeError` subclasses `ValueError`. Catch it, log the raw body, and route to a dead-letter queue — never let one bad payload crash the consumer." },
        { q: "Safest way to read `payload[\"event\"][\"severity\"]` when any level may be missing?", opts: ["try/except KeyError around it", "payload.get(\"event\", {}).get(\"severity\", 0)", "Both are reasonable; chained .get is idiomatic for defaults", "payload[\"event\"].get(\"severity\")"], answer: 2,
          explain: "Chained `.get` with defaults is the idiom for optional fields; try/except is fine too (EAFP) when absence is exceptional. Option D still KeyErrors if 'event' is missing." },
        { q: "Why normalize all sources into one canonical alert model before correlation?", opts: ["JSON requires it", "Playbook/correlation logic is written once against one schema instead of per vendor", "It makes payloads smaller", "Vendors mandate it"], answer: 1,
          explain: "Normalization at the edge isolates vendor weirdness in per-source adapters. Everything downstream — correlation, scoring, playbooks — targets one stable shape. Keep `raw` attached for audit." },
        { q: "Correlating 10k EDR alerts with 50k SIEM events on host+time. Right approach?", opts: ["Nested loops comparing all pairs", "Index one side in a dict by host, then probe — O(n+m)", "Convert to strings and regex", "Sort both and compare element-wise"], answer: 1,
          explain: "A hash-map index on the join key turns an O(n×m)=500M-comparison disaster into a linear pass. This is exactly a hash join." },
        { q: "Threat-intel API is down mid-playbook. What should enrichment do?", opts: ["Fail the whole incident", "Block and retry forever", "Record the error, mark verdict unknown, continue triage", "Skip silently with no trace"], answer: 2,
          explain: "Enrichment is best-effort: degrade gracefully, annotate that intel was unavailable (so an analyst knows confidence is lower), and keep the pipeline moving." },
      ],
    },

    /* ========================================================
       7. RESILIENCE
       ======================================================== */
    "resilience": {
      icon: "🛡️",
      title: "Error Handling & Resilience",
      tagline: "Playbooks that survive flaky APIs, partial failures, and 3 a.m. retries.",
      desc: "Exception design, retries with backoff, idempotency, circuit breakers, and structured logging — staff-level reliability patterns.",
      sections: [
        { h2: "Exception handling done right" },
        { code: `class PlaybookError(Exception):
    """Base for our domain errors — lets callers catch broadly."""

class TransientError(PlaybookError):
    """Retry-worthy: timeouts, 429s, 5xx."""

class PermanentError(PlaybookError):
    """Don't retry: 401/403/404, validation failures."""

def call_edr(host: str) -> dict:
    try:
        resp = session.post(f"{EDR}/isolate", json={"host": host}, timeout=10)
        resp.raise_for_status()
        return resp.json()
    except requests.Timeout as exc:
        raise TransientError(f"EDR timeout for {host}") from exc   # chain it!
    except requests.HTTPError as exc:
        code = exc.response.status_code
        if code in (429, 500, 502, 503, 504):
            raise TransientError(f"EDR {code}") from exc
        raise PermanentError(f"EDR {code}: {exc.response.text[:200]}") from exc`, title: "exception_design.py" },
        { ul: [
          "**Catch narrowly**, re-raise as domain exceptions; bare `except:` (which swallows `KeyboardInterrupt`/`SystemExit`) is an automatic interview red flag — `except Exception` at a top-level boundary with logging is the acceptable form.",
          "**`raise ... from exc`** preserves the causal chain — `__cause__` shows up in tracebacks and is invaluable at 3 a.m.",
          "**Classify transient vs permanent** — it's the foundation of every retry decision.",
          "`else` runs when no exception; `finally` always runs — know the full `try/except/else/finally` dance.",
        ]},

        { h2: "Retries: backoff, jitter, and budgets" },
        { code: `import time, random, logging

def with_retries(fn, *, attempts=5, base=0.5, cap=30.0):
    for attempt in range(1, attempts + 1):
        try:
            return fn()
        except TransientError as exc:
            if attempt == attempts:
                raise
            # exponential backoff, capped, with FULL jitter
            delay = random.uniform(0, min(cap, base * 2 ** attempt))
            logging.warning("attempt=%d failed (%s); sleeping %.2fs",
                            attempt, exc, delay)
            time.sleep(delay)
        except PermanentError:
            raise                       # never retry a 403`, title: "retry.py" },
        { callout: "star", title: "Why jitter — the staff answer", body: "When 500 playbook workers all get a 503 at the same moment, plain exponential backoff has them all retry in lockstep — a **thundering herd** that re-kills the recovering service. Randomized (full) jitter spreads the retries out. Cite AWS's 'Exponential Backoff and Jitter' if you want extra credit." },

        { h2: "Idempotency: safe to run twice" },
        { p: "Automation **will** double-fire: at-least-once queues, retried webhooks, replayed playbooks. Every action must be safe to repeat." },
        { ul: [
          "**Natural idempotency:** 'ensure host is isolated' (declarative) instead of 'send isolate command' (imperative). Check state first, or use APIs whose repeat is a no-op.",
          "**Idempotency keys:** send a deterministic key (`hash(alert_id + action)`) so the server dedups — PagerDuty's `dedup_key` and Stripe's `Idempotency-Key` are the canonical examples.",
          "**Local dedup ledger:** record completed action IDs (Redis SETNX / DB unique constraint) and skip repeats.",
        ]},
        { code: `def isolate_host_idempotent(host: str, alert_id: str) -> dict:
    key = f"isolate:{alert_id}:{host}"
    if not redis.set(key, "1", nx=True, ex=86400):   # SETNX: atomic claim
        return {"status": "skipped", "reason": "already executed"}
    try:
        return call_edr(host)
    except Exception:
        redis.delete(key)            # release claim so a retry can run
        raise`, title: "idempotency.py" },

        { h2: "Circuit breakers & graceful degradation" },
        { code: `import time

class CircuitBreaker:
    """CLOSED -> (failures >= threshold) -> OPEN -> (cooldown) -> HALF-OPEN."""
    def __init__(self, threshold=5, cooldown=60):
        self.threshold, self.cooldown = threshold, cooldown
        self.failures, self.opened_at = 0, None

    def call(self, fn, *args, **kwargs):
        if self.opened_at is not None:
            if time.monotonic() - self.opened_at < self.cooldown:
                raise TransientError("circuit OPEN — failing fast")
            self.opened_at = None                  # half-open: one probe
        try:
            result = fn(*args, **kwargs)
        except TransientError:
            self.failures += 1
            if self.failures >= self.threshold:
                self.opened_at = time.monotonic()
            raise
        else:
            self.failures = 0                      # success resets
            return result`, title: "circuit_breaker.py" },
        { p: "The breaker converts a hammering, queue-backing-up dependency outage into instant, cheap failures — and the playbook can degrade: skip enrichment, lower confidence, still page the analyst." },

        { h2: "Structured logging & observability" },
        { code: `import logging, json

class JsonFormatter(logging.Formatter):
    def format(self, record):
        return json.dumps({
            "ts": self.formatTime(record),
            "level": record.levelname,
            "msg": record.getMessage(),
            "alert_id": getattr(record, "alert_id", None),
            "action": getattr(record, "action", None),
        })

log = logging.getLogger("playbook")
log.info("host isolated", extra={"alert_id": "A-42", "action": "isolate"})
# JSON logs -> queryable in Splunk/ELK; correlation_id ties a playbook
# run together across services. Never log secrets or raw tokens.`, title: "structured_logging.py" },
      ],
      quiz: [
        { q: "Why is bare `except:` worse than `except Exception:`?", opts: ["It's slower", "It also swallows SystemExit/KeyboardInterrupt, breaking shutdown", "It can't log", "No difference"], answer: 1,
          explain: "Bare except catches BaseException — including KeyboardInterrupt and SystemExit — so Ctrl-C and clean shutdowns get eaten. `except Exception` (logged, at a boundary) is the acceptable broad catch." },
        { q: "Why add jitter to exponential backoff?", opts: ["Faster retries", "Prevents synchronized retry storms (thundering herd) against a recovering service", "Required by HTTP", "Reduces memory"], answer: 1,
          explain: "Without jitter, all clients that failed together retry together, re-overwhelming the dependency. Randomizing the delay decorrelates them." },
        { q: "Which failure should you NOT retry?", opts: ["HTTP 503", "Connection timeout", "HTTP 403 Forbidden", "HTTP 429"], answer: 2,
          explain: "403 is permanent — your credentials/permissions are wrong, and retrying just burns quota and time. 429/5xx/timeouts are transient. (For 429, honor Retry-After.)" },
        { q: "Your 'disable user' action may be delivered twice by the queue. Best defense?", opts: ["Hope it's rare", "Idempotency: atomic claim (e.g. Redis SETNX) or state-check before acting", "Add a sleep before acting", "Lower the queue speed"], answer: 1,
          explain: "At-least-once delivery makes duplicates inevitable. Claim a deterministic key atomically (or check current state) so the second delivery becomes a no-op." },
        { q: "What problem does a circuit breaker solve that retries alone don't?", opts: ["It retries faster", "It stops hammering a down dependency and fails fast, letting it recover", "It fixes auth errors", "It guarantees delivery"], answer: 1,
          explain: "Retries keep pressure on a dying service and tie up your workers. An open breaker fails instantly for a cooldown period — protecting both sides — then probes with one request (half-open)." },
      ],
    },

    /* ========================================================
       8. SLACK
       ======================================================== */
    "slack": {
      icon: "💬",
      title: "Slack Integration",
      tagline: "Alert notifications, interactive triage buttons, and ChatOps.",
      desc: "Incoming webhooks, the Web API with slack_sdk, Block Kit messages, interactivity, and request verification.",
      sections: [
        { h2: "Two ways in: webhooks vs Web API" },
        { ul: [
          "**Incoming webhook** — a static URL per channel. POST JSON, get a message. Zero auth code, but: fixed channel, no reading replies, no updates, no threads. Fine for fire-and-forget notifications.",
          "**Web API + bot token** (`xoxb-...`) — full power: post anywhere the bot is invited, update messages, open threads, upload files, read reactions. This is what a SOAR integration actually uses.",
          "**Socket Mode / Events API** — receive events (mentions, button clicks) for two-way ChatOps.",
        ]},
        { code: `# 1) Webhook — simplest possible alert
import requests
requests.post(WEBHOOK_URL, json={"text": ":rotating_light: Sev-1 on web-01"},
              timeout=5).raise_for_status()

# 2) Web API via slack_sdk — the real integration
from slack_sdk import WebClient
from slack_sdk.errors import SlackApiError

client = WebClient(token=os.environ["SLACK_BOT_TOKEN"])
try:
    resp = client.chat_postMessage(channel="#soc-alerts",
                                   text="Malware detected on web-01")
    ts = resp["ts"]                      # message timestamp = thread key
    client.chat_postMessage(channel="#soc-alerts", thread_ts=ts,
                            text="Enrichment: VT score 92/100")
except SlackApiError as e:
    if e.response.status_code == 429:    # rate limited
        retry_after = int(e.response.headers["Retry-After"])
    ...`, title: "slack_two_ways.py" },
        { callout: "tip", title: "Threading pattern", body: "Post the alert once, then put every enrichment/status update in its **thread** (`thread_ts`). One incident = one thread keeps #soc-alerts readable during an alert storm. Store the `ts` with the incident record." },

        { h2: "Block Kit: rich, actionable alerts" },
        { code: `def alert_blocks(incident: dict) -> list[dict]:
    return [
        {"type": "header",
         "text": {"type": "plain_text", "text": f"🚨 {incident['title']}"}},
        {"type": "section", "fields": [
            {"type": "mrkdwn", "text": f"*Host:*\\n{incident['host']}"},
            {"type": "mrkdwn", "text": f"*Severity:*\\n{incident['severity']}/10"},
            {"type": "mrkdwn", "text": f"*Source:*\\n{incident['source']}"},
            {"type": "mrkdwn", "text": f"*IOCs:*\\n{', '.join(incident['iocs'])}"},
        ]},
        {"type": "actions", "block_id": f"triage:{incident['id']}", "elements": [
            {"type": "button", "style": "danger", "action_id": "isolate",
             "text": {"type": "plain_text", "text": "Isolate Host"},
             "value": incident["id"],
             "confirm": {                      # human-in-the-loop guardrail
                 "title": {"type": "plain_text", "text": "Confirm isolation"},
                 "text": {"type": "mrkdwn",
                          "text": f"Really isolate *{incident['host']}*?"},
                 "confirm": {"type": "plain_text", "text": "Isolate"},
                 "deny": {"type": "plain_text", "text": "Cancel"}}},
            {"type": "button", "action_id": "ack",
             "text": {"type": "plain_text", "text": "Acknowledge"},
             "value": incident["id"]},
        ]},
    ]

client.chat_postMessage(channel="#soc-alerts",
                        text=f"Incident {incident['id']}",   # fallback text
                        blocks=alert_blocks(incident))`, title: "block_kit.py" },
        { callout: "star", title: "The killer line", body: "\"For destructive actions I put the human-in-the-loop in Slack: a Block Kit button with a confirm dialog, the click handled by our backend, the analyst's identity recorded in the audit trail.\" That sentence covers UX, safety, and auditability in one breath." },

        { h2: "Handling button clicks (interactivity)" },
        { code: `# Slack POSTs interaction payloads to your endpoint (or Socket Mode).
# MUST verify the signature and answer within 3 seconds.
import hashlib, hmac, time, json
from flask import Flask, request

app = Flask(__name__)

def verify_slack(req) -> bool:
    ts = req.headers.get("X-Slack-Request-Timestamp", "0")
    if abs(time.time() - int(ts)) > 60 * 5:        # replay protection
        return False
    base = f"v0:{ts}:{req.get_data(as_text=True)}"
    expected = "v0=" + hmac.new(SIGNING_SECRET.encode(), base.encode(),
                                hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, req.headers.get("X-Slack-Signature", ""))

@app.post("/slack/actions")
def actions():
    if not verify_slack(request):
        return "", 401
    payload = json.loads(request.form["payload"])
    action = payload["actions"][0]
    if action["action_id"] == "isolate":
        # ack fast, do the work async — Slack times out at 3s
        task_queue.enqueue("isolate_host", incident_id=action["value"],
                           requested_by=payload["user"]["username"])
    return "", 200`, title: "interactivity.py" },
        { ul: [
          "**Verify `X-Slack-Signature`** (HMAC-SHA256 with the signing secret) and reject stale timestamps — never trust an unauthenticated endpoint that can isolate hosts.",
          "**Ack within 3 seconds**, enqueue the real work — same pattern as every webhook consumer.",
          "**Socket Mode** (outbound WebSocket) avoids exposing a public endpoint at all — worth mentioning for locked-down environments.",
          "Rate limits are per-method (~1 msg/sec/channel for chat.postMessage) — on 429, honor `Retry-After`; batch updates into threads.",
        ]},
      ],
      quiz: [
        { q: "Why prefer a bot token (Web API) over an incoming webhook for SOAR?", opts: ["Webhooks are deprecated", "Bot can post to any invited channel, update messages, thread, and read interactions", "Webhooks can't send JSON", "Tokens are easier to rotate"], answer: 1,
          explain: "A webhook is one-way, single-channel, fire-and-forget. Real integrations need threads, message updates ('Isolating… ✅ Done'), and interactive buttons — that's the Web API + bot token." },
        { q: "Slack interaction endpoint: what must happen within 3 seconds?", opts: ["The full playbook completes", "Return HTTP 200 (ack); do the work asynchronously", "Post a new message", "Refresh the token"], answer: 1,
          explain: "Slack retries/fails interactions not acked in ~3s. Ack immediately, enqueue the action, then update the message when work completes." },
        { q: "How do you authenticate that a request really came from Slack?", opts: ["Check User-Agent", "Source IP allowlist only", "HMAC-SHA256 of timestamp+body with your signing secret vs X-Slack-Signature", "Slack requests can't be forged"], answer: 2,
          explain: "Compute `v0:timestamp:body` HMAC with the signing secret and constant-time-compare to the header; reject timestamps older than ~5 min to stop replays." },
        { q: "Best pattern for posting 40 enrichment updates about one incident?", opts: ["40 channel messages", "One alert message, updates in its thread via thread_ts", "One giant message edited 40 times", "A new channel per incident"], answer: 1,
          explain: "Thread replies keep the alert channel scannable during storms. (Editing one message via chat.update is good for a status line, but loses the timeline.)" },
        { q: "A destructive 'Isolate Host' button should also have:", opts: ["A bigger font", "A Block Kit confirm dialog + server-side authz + audit of who clicked", "No special handling", "Auto-execute on hover"], answer: 1,
          explain: "Human-in-the-loop confirm, verify the click server-side (signature + user authorization), and record the actor in the audit trail. Buttons are requests, not commands." },
      ],
    },

    /* ========================================================
       9. PAGERDUTY
       ======================================================== */
    "pagerduty": {
      icon: "📟",
      title: "PagerDuty Integration",
      tagline: "Trigger, deduplicate, and resolve incidents programmatically.",
      desc: "Events API v2 vs REST API, dedup keys, severity mapping, auto-resolution, and escalation hygiene.",
      sections: [
        { h2: "Two APIs, two jobs" },
        { ul: [
          "**Events API v2** — the alert pipe. Send `trigger` / `acknowledge` / `resolve` events with a **routing key** (per service integration). No user auth; this is what your SOAR pipeline calls.",
          "**REST API** — the management plane. List incidents, reassign, add notes, manage schedules/escalation policies. Uses an API token; this is what dashboards and sync jobs call.",
          "Rule of thumb: machines page through the **Events API**; humans and admin tooling use the **REST API**.",
        ]},
        { code: `import requests

EVENTS_URL = "https://events.pagerduty.com/v2/enqueue"

def page(incident: dict) -> str:
    """Trigger a PagerDuty incident; returns the dedup_key."""
    dedup = f"soar-{incident['host']}-{incident['rule_id']}"   # deterministic!
    body = {
        "routing_key": ROUTING_KEY,
        "event_action": "trigger",
        "dedup_key": dedup,
        "payload": {
            "summary": f"[{incident['severity']}/10] {incident['title']} on {incident['host']}",
            "source": incident["host"],
            "severity": to_pd_severity(incident["severity"]),  # critical/error/warning/info
            "timestamp": incident["timestamp"],
            "custom_details": {           # everything the responder needs
                "iocs": sorted(incident["iocs"]),
                "intel_score": incident.get("intel", {}),
                "runbook": f"https://wiki/runbooks/{incident['rule_id']}",
            },
        },
        "links": [{"href": incident["console_url"], "text": "Open in SOAR"}],
    }
    r = requests.post(EVENTS_URL, json=body, timeout=10)
    r.raise_for_status()                  # 202 = accepted (async!)
    return dedup

def to_pd_severity(sev: int) -> str:
    return ("critical" if sev >= 9 else
            "error"    if sev >= 7 else
            "warning"  if sev >= 4 else "info")`, title: "pagerduty_trigger.py" },

        { h2: "dedup_key: the most important field" },
        { p: "Every event with the same `dedup_key` lands on the **same open incident** instead of creating a new one. A deterministic key (host + rule, not a UUID per event) is what stands between your on-call and 400 pages during an alert storm." },
        { code: `# Same key -> the lifecycle works end-to-end:
trigger(dedup)          # incident opens, on-call paged
trigger(dedup)          # appended to SAME incident (counter++ , no new page)
acknowledge(dedup)      # silences escalation while someone works it

def resolve(dedup_key: str):
    requests.post(EVENTS_URL, json={
        "routing_key": ROUTING_KEY,
        "event_action": "resolve",        # auto-close when condition clears
        "dedup_key": dedup_key,
    }, timeout=10).raise_for_status()

# SOAR auto-resolution: when the EDR confirms the host is clean,
# resolve the page — never make a human close what a machine can verify.`, title: "lifecycle.py" },
        { callout: "star", title: "Staff-level talking points", body: "Deterministic dedup keys prevent page storms; severity mapping belongs in **one** place; auto-resolve when telemetry confirms recovery; and store the dedup_key on the incident record so any later playbook step can ack/resolve. The Events API returns **202 Accepted** — it's an async queue, not a synchronous confirmation." },

        { h2: "Receiving PagerDuty webhooks" },
        { code: `# PagerDuty V3 webhooks notify your SOAR of incident changes
# (triggered, acknowledged, resolved, priority changed...)
import hashlib, hmac

def verify_pd(body: bytes, header_sig: str) -> bool:
    digest = hmac.new(PD_WEBHOOK_SECRET.encode(), body,
                      hashlib.sha256).hexdigest()
    return any(hmac.compare_digest(f"v1={digest}", s.strip())
               for s in header_sig.split(","))

@app.post("/webhooks/pagerduty")
def pd_webhook():
    if not verify_pd(request.get_data(),
                     request.headers.get("X-PagerDuty-Signature", "")):
        return "", 401
    event = request.get_json()["event"]
    if event["event_type"] == "incident.acknowledged":
        # sync state back: pause the playbook's escalation branch
        soar.mark_acknowledged(event["data"]["id"],
                               by=event["agent"]["summary"])
    return "", 200      # ack fast; process async`, title: "pd_webhook.py" },
        { ul: [
          "Bi-directional sync: SOAR triggers PD; PD webhooks update SOAR state (ack'd by whom, resolved when).",
          "Verify the `X-PagerDuty-Signature` HMAC — same discipline as Slack.",
          "Use **Event Orchestration** (PD-side rules) for routing/suppression you don't want to hardcode in Python.",
          "Rate limits exist on both APIs — queue and retry with backoff on 429, and remember events are processed asynchronously after the 202.",
        ]},
      ],
      quiz: [
        { q: "Which API does an automated pipeline use to page on-call?", opts: ["REST API with a user token", "Events API v2 with a routing key", "SMTP to a PD address", "GraphQL"], answer: 1,
          explain: "Events API v2 (`/v2/enqueue`) with the service integration's routing key is the machine-to-machine alert pipe. The REST API is for management operations. (Email integration exists but isn't the engineering answer.)" },
        { q: "300 firing checks on one host should page on-call once. The mechanism?", opts: ["A sleep between sends", "Same deterministic dedup_key — events group into one incident", "Lower severity", "A second routing key"], answer: 1,
          explain: "Events sharing a dedup_key attach to the same open incident. Derive it from stable facts (host + rule), never per-event UUIDs." },
        { q: "The Events API returned 202. What does that mean?", opts: ["Incident created and on-call paged", "Event accepted into an async queue — processing happens after", "Duplicate detected", "Auth failure"], answer: 1,
          explain: "202 Accepted = queued. Incident creation/notification is asynchronous; don't treat 202 as 'someone has been paged', and handle the (rare) downstream failures via webhooks/polling if you need certainty." },
        { q: "EDR telemetry confirms the host is clean. The playbook should:", opts: ["Let the incident age out", "Send event_action=resolve with the stored dedup_key", "Email the on-call", "Trigger a new 'all clear' incident"], answer: 1,
          explain: "Auto-resolve with the original dedup_key closes the loop — no stale pages, accurate MTTR metrics. This is why you persist the dedup_key on the incident record." },
        { q: "Why consume PagerDuty webhooks in your SOAR?", opts: ["They're required for triggering", "To sync incident state back (who ack'd, when resolved) and adapt playbook behavior", "To bypass rate limits", "To rotate routing keys"], answer: 1,
          explain: "Webhooks make the integration bi-directional: when a human acks in PD, the playbook can pause auto-escalation; when resolved, it can close the SOAR case. Verify signatures, ack fast, process async." },
      ],
    },

    /* ========================================================
       10. KUBERNETES
       ======================================================== */
    "kubernetes": {
      icon: "☸️",
      title: "Running Python on Kubernetes",
      tagline: "Ship your playbook engine as containers: probes, secrets, jobs, scale.",
      desc: "Containerizing Python services, Deployments vs Jobs vs CronJobs, config/secrets, health probes, autoscaling, and the Python k8s client.",
      sections: [
        { h2: "A production-grade Python container" },
        { code: `# Dockerfile
FROM python:3.12-slim AS base
ENV PYTHONUNBUFFERED=1 \\
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
RUN useradd -m runner
USER runner                          # never run as root

EXPOSE 8080
CMD ["uvicorn", "webhook_consumer:app", "--host", "0.0.0.0", "--port", "8080"]`, title: "Dockerfile" },
        { ul: [
          "`PYTHONUNBUFFERED=1` — logs flush immediately so `kubectl logs` shows them in real time (buffered stdout is the classic 'my pod logs nothing' bug).",
          "**Non-root user** — table stakes for a security role; pair with a `securityContext` (runAsNonRoot, readOnlyRootFilesystem, drop capabilities).",
          "Slim base + pinned requirements + multi-stage builds = smaller attack surface and faster pulls.",
        ]},

        { h2: "Choosing the workload type" },
        { ul: [
          "**Deployment** — long-running services: webhook consumers, the API, queue workers. Gets rolling updates and self-healing restarts.",
          "**Job** — run-to-completion: a one-off backfill, a single playbook execution. `backoffLimit` controls retries.",
          "**CronJob** — scheduled: poll a SIEM every 5 min, rotate enrichment caches nightly. Know `concurrencyPolicy: Forbid` (don't overlap runs) and `startingDeadlineSeconds`.",
          "A common SOAR architecture: Deployment consumes the alert queue and **spawns a Job per heavy playbook run** — isolation and per-run resource limits.",
        ]},
        { code: `# deployment.yaml (the parts interviewers probe)
apiVersion: apps/v1
kind: Deployment
metadata: { name: playbook-worker }
spec:
  replicas: 3
  selector: { matchLabels: { app: playbook-worker } }
  template:
    metadata: { labels: { app: playbook-worker } }
    spec:
      containers:
      - name: worker
        image: registry.internal/soar/worker:1.4.2   # never :latest
        resources:
          requests: { cpu: "250m", memory: "256Mi" } # scheduling
          limits:   { cpu: "1",    memory: "512Mi" } # OOMKill ceiling
        env:
        - name: PD_ROUTING_KEY
          valueFrom: { secretKeyRef: { name: soar-secrets, key: pd-key } }
        envFrom:
        - configMapRef: { name: soar-config }        # non-secret config
        livenessProbe:                # "is it alive?" -> restart if not
          httpGet: { path: /healthz, port: 8080 }
          periodSeconds: 10
        readinessProbe:               # "can it take traffic?" -> gate Service
          httpGet: { path: /ready, port: 8080 }
          periodSeconds: 5`, title: "deployment.yaml" },
        { callout: "warn", title: "Probe distinction — guaranteed question", body: "**Liveness** failing → kubelet restarts the container (use for deadlocks). **Readiness** failing → pod is pulled from Service endpoints but NOT restarted (use for 'still warming up' / 'dependency down'). Wiring a dependency check into *liveness* causes restart storms during an upstream outage — say that out loud." },

        { h2: "Config, secrets, and graceful shutdown" },
        { code: `import os, signal, sys

# 12-factor: all config from env (mounted from ConfigMap/Secret)
PD_KEY   = os.environ["PD_ROUTING_KEY"]          # crash early if missing
SIEM_URL = os.environ.get("SIEM_URL", "https://siem.internal")

shutting_down = False
def handle_sigterm(signum, frame):
    """K8s sends SIGTERM, waits terminationGracePeriodSeconds (30s), then SIGKILL."""
    global shutting_down
    shutting_down = True                 # stop taking new work

signal.signal(signal.SIGTERM, handle_sigterm)

while not shutting_down:
    alert = queue.get(timeout=2)
    if alert:
        process(alert)                   # finish in-flight work, then exit
sys.exit(0)`, title: "graceful_shutdown.py" },
        { ul: [
          "Secrets via `Secret` mounts/env (backed by Vault or External Secrets Operator in real shops) — **never** baked into images or ConfigMaps.",
          "Handle **SIGTERM**: drain in-flight playbook actions before the grace period ends, or actions get killed mid-isolation.",
          "Memory limits + Python: the OOMKiller terminates the whole container (exit 137) — watch RSS if you load big intel feeds.",
        ]},

        { h2: "Scaling & talking to the API from Python" },
        { code: `# HPA: scale workers on queue depth (custom metric) or CPU
# kubectl autoscale deployment playbook-worker --min 2 --max 20 --cpu-percent 70

# Python k8s client — e.g. SOAR action that spawns a containment Job
from kubernetes import client, config

config.load_incluster_config()        # uses the pod's ServiceAccount
batch = client.BatchV1Api()

job = client.V1Job(
    metadata=client.V1ObjectMeta(generate_name="containment-"),
    spec=client.V1JobSpec(
        backoff_limit=2,
        ttl_seconds_after_finished=3600,        # auto-cleanup
        template=client.V1PodTemplateSpec(
            spec=client.V1PodSpec(
                restart_policy="Never",
                containers=[client.V1Container(
                    name="contain",
                    image="registry.internal/soar/contain:1.2.0",
                    args=["--host", target_host],
                )]))))
batch.create_namespaced_job(namespace="soar", body=job)`, title: "k8s_client.py" },
        { callout: "star", title: "Security-role bonus points", body: "RBAC-scope the ServiceAccount to exactly the verbs/resources the worker needs (create jobs in one namespace, nothing more); NetworkPolicies restrict egress to the APIs the playbooks call; image scanning + signed images in the pipeline. Saying this unprompted is very on-brand for a staff SOAR role." },
      ],
      quiz: [
        { q: "Liveness probe fails vs readiness probe fails — what happens respectively?", opts: ["Both restart the pod", "Restart container / remove pod from Service endpoints", "Remove from Service / restart container", "Both just log warnings"], answer: 1,
          explain: "Liveness failure → kubelet restarts the container. Readiness failure → pod stops receiving Service traffic but keeps running. Mixing them up causes restart storms during dependency outages." },
        { q: "Poll the SIEM every 5 minutes, runs must never overlap. Which workload?", opts: ["Deployment with sleep loop", "CronJob with concurrencyPolicy: Forbid", "DaemonSet", "StatefulSet"], answer: 1,
          explain: "CronJob is the scheduled-work primitive; `concurrencyPolicy: Forbid` skips a new run if the previous is still going — exactly the no-overlap requirement." },
        { q: "Your Python pod shows no logs in `kubectl logs` until it dies. Likely fix?", opts: ["More CPU", "PYTHONUNBUFFERED=1 (or -u) so stdout flushes immediately", "Mount a log volume", "Use print instead of logging"], answer: 1,
          explain: "Python buffers stdout when it's not a TTY. Unbuffered output (env var or `python -u`) makes logs stream to the container runtime in real time." },
        { q: "Where does the PagerDuty routing key belong?", opts: ["Hardcoded constant", "ConfigMap", "Kubernetes Secret (ideally synced from a vault), injected as env/volume", "A comment in the Dockerfile"], answer: 2,
          explain: "Credentials go in Secrets (ConfigMaps are for non-sensitive config and are plaintext to anyone who can read them). Real deployments back Secrets with Vault/External Secrets and RBAC-restrict access." },
        { q: "What should a worker do on SIGTERM?", opts: ["Ignore it — k8s will SIGKILL anyway", "Stop accepting new work, finish in-flight actions within the grace period, exit 0", "Immediately sys.exit(1)", "Fork a replacement"], answer: 1,
          explain: "K8s sends SIGTERM, waits `terminationGracePeriodSeconds` (default 30s), then SIGKILLs. Graceful drain prevents a half-executed containment action — register a SIGTERM handler." },
      ],
    },

    /* ========================================================
       11. MOCK INTERVIEW
       ======================================================== */
    "mock-interview": {
      icon: "🎯",
      title: "Staff-Level Mock Interview",
      tagline: "System design prompts, behavioral angles, and the answers that land.",
      desc: "How to handle the design round, the signals interviewers grade staff candidates on, and rapid-fire technical questions.",
      sections: [
        { h2: "The design question you should expect" },
        { p: "**\"Design a playbook automation engine that ingests alerts from N sources and executes response actions.\"** Don't jump to code — walk the structure:" },
        { ul: [
          "**Ingest:** webhooks + pollers per source → validate (signatures!) → ack fast → durable queue (at-least-once ⇒ consumers must be idempotent).",
          "**Normalize:** per-source adapters → one canonical alert schema (keep raw attached). New source = new adapter, nothing downstream changes.",
          "**Correlate/dedup:** deterministic correlation keys, time-window joins, suppression rules — collapse storms before they reach humans.",
          "**Decide:** rules/playbook definitions (declarative YAML) mapped to registered Python actions (decorator registry!). Risky actions gated by human approval in Slack.",
          "**Act:** action layer with retries+jitter, circuit breakers per integration, idempotency keys, full audit log.",
          "**Notify/escalate:** Slack threads for visibility, PagerDuty with dedup keys for paging, auto-resolve on verified recovery.",
          "**Run it:** k8s Deployments for consumers, Jobs for heavy runs, HPA on queue depth, secrets from vault, RBAC-scoped, observable (structured logs, metrics, traces).",
        ]},
        { callout: "star", title: "What 'staff' means to the interviewer", body: "Mid-level answers list technologies. Staff answers lead with **failure modes and trade-offs**: 'webhooks get replayed, so every action is idempotent'; 'enrichment is best-effort so an intel outage degrades confidence, not availability'; 'I bound concurrency to the rate limit of the slowest downstream'. Volunteer the failure analysis before being asked." },

        { h2: "Trade-off questions & strong answers" },
        { ul: [
          "**\"Threads or asyncio for the enrichment fan-out?\"** — Either works; decide by ecosystem and scale. Sync-only vendor SDKs → threads. Thousands of concurrent lookups with aiohttp available → asyncio with a semaphore. Both bounded, both with timeouts. Showing you can defend either is the point.",
          "**\"How do you stop one bad integration from taking the platform down?\"** — Per-integration circuit breakers, bulkheads (separate worker pools/queues), timeouts everywhere, dead-letter queues, and graceful degradation paths.",
          "**\"At-least-once or exactly-once delivery?\"** — Exactly-once end-to-end is a myth across network boundaries; choose at-least-once and make consumers idempotent (dedup ledger / idempotency keys).",
          "**\"How would you test playbooks?\"** — Unit-test actions with mocked APIs (responses/respx, vcr-style cassettes), contract tests per integration, a staging tenant for E2E, and replay of recorded real alerts as regression suites. Destructive actions get a dry-run mode.",
        ]},

        { h2: "Behavioral, staff edition" },
        { ul: [
          "Have a story where you **led an automation initiative end-to-end**: the metric before (analyst hours, MTTR), the design, the rollout, the metric after.",
          "Have a story where **automation went wrong** (false-positive containment? page storm?) and what guardrails you added — blast-radius limits, approval gates, canary playbooks.",
          "Have a story about **influence without authority**: getting detection engineering, IT, and the SOC to adopt your alert schema or runbook standard.",
          "Quantify everything: \"cut phishing triage from 25 min to 90 s\", \"deduped 12k alerts/day into 40 incidents\".",
        ]},

        { h2: "Rapid-fire warm-ups" },
        { ul: [
          "`is` vs `==`; mutable default args; LEGB; shallow vs deep copy.",
          "GIL one-liner + when threads vs processes vs asyncio.",
          "Write `@retry` with backoff+jitter from memory.",
          "dict/set comprehension for IOC dedup; generator for streaming JSONL.",
          "Liveness vs readiness; SIGTERM handling; why PYTHONUNBUFFERED.",
          "Slack signature verification; PagerDuty dedup_key; webhook ack-fast-process-async.",
          "Idempotency, backpressure, thundering herd, circuit breaker, dead-letter queue — be able to define all five in one sentence each.",
        ]},
        { callout: "tip", title: "Day-of mechanics", body: "Think aloud; state assumptions; start with the simple version and harden it ('first correct, then resilient, then fast'). When stuck, narrate the trade-off space — that IS the staff signal they're hiring for." },
      ],
      quiz: [
        { q: "Alert sources deliver webhooks at-least-once. The staff-level consequence?", opts: ["Switch to polling", "All downstream actions must be idempotent", "Drop duplicate IPs", "Use exactly-once queues"], answer: 1,
          explain: "At-least-once delivery guarantees duplicates eventually. Exactly-once across network boundaries isn't real; the robust design makes every consumer/action safe to repeat (idempotency keys, dedup ledgers)." },
        { q: "Threat-intel enrichment service goes down. The well-designed playbook engine:", opts: ["Halts all triage until it's back", "Fails fast via circuit breaker, marks confidence degraded, continues core triage", "Retries every lookup forever", "Pages every analyst"], answer: 1,
          explain: "Enrichment is best-effort. Circuit breaker stops the hammering; incidents proceed annotated as 'intel unavailable'. Availability of triage > completeness of context." },
        { q: "Which is the strongest staff-level signal in a design interview?", opts: ["Naming many tools quickly", "Proactively analyzing failure modes and trade-offs of your own design", "Writing code immediately", "Memorized definitions"], answer: 1,
          explain: "Staff engineers are graded on judgment: identifying what breaks, what you'd trade and why, and where the human stays in the loop — before the interviewer asks." },
        { q: "Best testing strategy for a playbook that isolates hosts?", opts: ["Test in prod carefully", "Mocked-API unit tests + staging-tenant E2E + dry-run mode for destructive actions", "Manual QA each release", "Only type-checking"], answer: 1,
          explain: "Layered: fast unit tests with mocked integrations, contract tests per vendor API, E2E in a staging tenant, and a dry-run flag so destructive actions can be rehearsed safely." },
        { q: "Sketch the right order for an alert pipeline:", opts: ["Act → correlate → normalize → ingest", "Ingest → normalize → correlate/dedup → decide → act → notify", "Notify → act → ingest", "Normalize → act → ingest → correlate"], answer: 1,
          explain: "Validate and durably ingest first; normalize to one schema; correlate/dedup to collapse noise; apply playbook decisions (with approval gates); execute resilient actions; notify and escalate with dedup. Each stage isolates the next from upstream chaos." },
      ],
    },
  },
};
