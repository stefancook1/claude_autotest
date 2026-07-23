# Model Extraction Attacks

**Category:** AI Security
**Date:** 2026-07-23
**Difficulty:** Advanced

---

## What It Is

Model extraction (also called model stealing) is an attack where an adversary queries a target ML model repeatedly and uses the input-output pairs to train a surrogate model that approximates the original. The attacker never needs direct access to model weights, architecture, or training data — only the ability to send queries and observe predictions. A sufficiently capable surrogate can match the original model's accuracy for a fraction of the cost of training from scratch.

## Why It Matters

Model extraction undermines the intellectual property and competitive moat of organizations that invest heavily in training proprietary models. Beyond IP theft, a stolen surrogate can be used to run offline adversarial example attacks against the original, bypassing rate-limiting and security monitoring. OpenAI's ChatGPT clones and proprietary financial scoring models have both been targeted by this technique in the wild.

## Practical Example

**Scenario:** An attacker wants a free surrogate of a paid sentiment analysis API.

```python
import anthropic
import random

# Step 1: Craft diverse queries to maximize decision-boundary coverage
seed_texts = [
    "I love this product!",
    "Terrible experience, never again.",
    "It was okay, nothing special.",
    "Absolutely fantastic — exceeded expectations.",
    "Broken on arrival. Complete waste of money.",
]

# Step 2: Query the target API and collect (input, label) pairs
client = anthropic.Anthropic()
training_data = []

for text in seed_texts:
    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=10,
        messages=[{
            "role": "user",
            "content": f"Classify sentiment as POSITIVE or NEGATIVE only: '{text}'"
        }]
    )
    label = response.content[0].text.strip()
    training_data.append((text, label))
    print(f"  [{label}] {text}")

# Step 3: (In a real attack) Use training_data to fine-tune a local model
# e.g., fine-tune distilbert-base-uncased on these (text, label) pairs
# The surrogate model is now a functional clone, trained without paying
# for the original model or accessing its weights.
print(f"\nCollected {len(training_data)} labeled examples for surrogate training.")
```

**Key attacker techniques:**
- **Active learning queries**: send inputs near decision boundaries to maximize information gain per query
- **Population-based probing**: use diverse text corpora as seed inputs to cover the full input space
- **Knockoff Nets**: a published attack that achieves >99% fidelity on image classifiers with ~10k queries
- **Query synthesis**: generate adversarial inputs that expose model internals faster than random sampling

A realistic attack against a production LLM might require millions of queries, but for narrow classifiers (spam, fraud, toxicity) a high-fidelity clone can be built in hours for under $100 in API costs.

## How to Defend

- **Rate limiting and anomaly detection**: flag accounts that issue unusually high query volumes, especially with systematically varied inputs; set per-IP and per-key query budgets
- **Output perturbation**: add calibrated noise to confidence scores or restrict responses to hard labels (POSITIVE/NEGATIVE) rather than exposing softmax probabilities — continuous scores dramatically lower the query budget an attacker needs
- **Query watermarking**: embed statistical fingerprints into model outputs so that if a surrogate appears in the wild, you can cryptographically prove it was derived from your API
- **Authentication and contractual controls**: require API keys tied to real identities and make terms of service explicitly prohibit model extraction; this creates legal recourse even when technical controls fail
- **Model architecture obfuscation**: avoid returning intermediate embeddings, attention weights, or log-probabilities through your API surface; every extra signal reduces the attacker's query cost

## Today's Challenge

1. Pick any public text classification API (or use a local HuggingFace model as a stand-in target).
2. Write a 20-line script that sends 50 systematically varied inputs and collects labels.
3. Count how many unique classes you observed. Ask yourself: if you had 10,000 labeled pairs, could you fine-tune a small BERT model to replicate it?
4. Bonus: read the [Knockoff Nets paper](https://arxiv.org/abs/1812.02766) (Orekondy et al., 2019) and identify the three query strategies they benchmark.

## Key Takeaway

Model extraction proves that an API boundary is not a security boundary — an attacker with a query budget can reconstruct your model's behavior without ever touching its weights.
