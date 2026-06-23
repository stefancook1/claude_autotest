# Model Extraction Attacks
**Category:** AI Security
**Date:** 2026-06-23
**Difficulty:** Advanced

---

## What It Is
Model extraction (also called model stealing) is an attack where an adversary reconstructs a proprietary ML model by repeatedly querying it and using the input-output pairs to train a functionally equivalent surrogate. The attacker never needs access to the model's weights, training data, or architecture — only its prediction API. The resulting surrogate can match the original's accuracy on specific tasks while costing the attacker a fraction of what the victim spent to build it.

## Why It Matters
Commercial AI models represent enormous R&D investment; a stolen surrogate undermines competitive advantage, violates terms of service, and — critically — enables further attacks. Once an adversary has a local copy, they can white-box-probe it to craft adversarial examples, bypass content filters, or enumerate failure modes that would be rate-limited or logged on the real API. A 2022 paper demonstrated near-perfect extraction of GPT-2-XL using fewer than 1 million queries (cost: ~$200).

## Practical Example

### Scenario: Stealing a Sentiment Classifier

Suppose a company exposes a proprietary sentiment API:

```
POST /predict
{"text": "I love this product!"}
→ {"label": "POSITIVE", "confidence": 0.97}
```

An attacker builds a surrogate in three phases:

**Phase 1 — Seed corpus query**
```python
import requests, csv

seeds = ["great", "terrible", "okay", "awful", "fantastic", ...]  # ~1000 seeds
results = []
for text in seeds:
    r = requests.post("https://victim.ai/predict", json={"text": text})
    results.append((text, r.json()["label"], r.json()["confidence"]))
```

**Phase 2 — Active learning expansion**
The attacker trains an initial surrogate, then queries points near its decision boundary (where uncertainty is highest) to get the most information per API call:
```python
from sklearn.linear_model import LogisticRegression
import numpy as np

# Train initial surrogate on seed data
surrogate = LogisticRegression().fit(X_seed, y_seed)

# Find uncertain points and query the victim for labels
uncertain_idx = np.where(np.abs(surrogate.decision_function(X_pool)) < 0.3)[0]
for i in uncertain_idx[:500]:
    label = query_victim_api(X_pool[i])
    training_set.append((X_pool[i], label))
```

**Phase 3 — Final surrogate training**
After ~50,000 queries the attacker has a model achieving 94% agreement with the victim — locally, with no rate limiting and no audit trail.

### Confidence Score Amplification
When APIs return raw probabilities (not just labels), extraction is dramatically easier. The full probability vector over all classes gives far more information than a hard label, reducing the query count by 10–100×.

## How to Defend

- **Return hard labels only** — strip confidence scores from public API responses, or quantize them to coarse buckets (high/medium/low). Every decimal of precision is information.
- **Rate limiting and anomaly detection** — flag accounts that query with unusual diversity patterns (uniform distribution across classes, systematic boundary probing). Legitimate users cluster around real use cases.
- **Watermark model outputs** — embed statistical watermarks in predictions that survive surrogate training; you can then prove ownership if a stolen model surfaces publicly (see DAWN, DeepIPR).
- **Query budgets and authentication** — require API keys, enforce per-key query caps, and log everything. Extraction at scale leaves a footprint if you're looking.
- **Prediction perturbation** — add calibrated noise to confidence values; this degrades extraction quality while barely affecting legitimate users who only need the label.

## Today's Challenge

1. **Explore the attack surface of a public API you use.** Check whether it returns confidence scores. If it does, estimate: how many queries would an attacker need to clone its behavior on a binary classification task? (Hint: rough lower bound is ~n_features × 10 for a linear model.)

2. **Try a toy extraction.** Using scikit-learn's `make_classification`, train a "victim" logistic regression locally. Write a second script that can only call `victim.predict_proba()` and attempt to recreate it. Compare decision boundaries with `mlxtend`'s `plot_decision_regions`. How many queries did you need for 95% agreement?

3. **Audit your own APIs.** Do any of your services return ML model scores in their response payloads? Could that be stripped or coarsened without breaking downstream functionality?

## Key Takeaway
Every probability score your model returns to the outside world is a free training label for an adversary — treat model confidence as a trade secret, not a feature.
