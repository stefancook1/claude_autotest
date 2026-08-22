# Model Extraction Attacks

**Category:** AI Security
**Date:** 2026-08-22
**Difficulty:** Advanced

---

## What It Is

Model extraction (also called model stealing) is an attack where an adversary queries a target ML model through its API and uses the input-output pairs to train a functionally equivalent surrogate model. The attacker never touches the model's weights or training data directly — they treat the model as a black box and reconstruct its behavior from observed predictions. With enough queries, the surrogate can approximate the target's decision boundary closely enough to replicate its commercial value or to enable further attacks.

## Why It Matters

Model extraction threatens the intellectual property of organisations that invest heavily in training proprietary models and can expose private training data indirectly (via the surrogate). It also acts as a stepping stone: a local copy of the model lets attackers craft adversarial examples offline without the rate-limiting or monitoring a live API applies. The 2016 "Stealing Machine Learning Models via Prediction APIs" paper (Tramèr et al.) demonstrated that major commercial classifiers could be cloned with fewer than 1 000 queries, and more recent work (Krishnamurthy et al. 2019) showed that even output logits alone are enough to clone GPT-2-scale text models.

## Practical Example

**Scenario: Cloning a sentiment-analysis API**

Assume a target API accepts text and returns a JSON confidence score:

```
POST /predict
{"text": "I love this product!"}
→ {"label": "POSITIVE", "confidence": 0.97}
```

An attacker scripts a query loop, feeding diverse inputs from a public corpus:

```python
import requests, json, random

corpus = open("imdb_reviews.txt").readlines()
dataset = []

for review in random.sample(corpus, 5000):
    resp = requests.post(
        "https://api.target.com/predict",
        json={"text": review.strip()},
        headers={"Authorization": "Bearer <stolen_key>"}
    )
    data = resp.json()
    dataset.append({"text": review.strip(),
                    "label": data["label"],
                    "score": data["confidence"]})

with open("stolen_labels.json", "w") as f:
    json.dump(dataset, f)
```

They then fine-tune a local BERT model on `stolen_labels.json`:

```python
from transformers import BertForSequenceClassification, Trainer, TrainingArguments
# ... standard fine-tune loop using stolen_labels.json as training data ...
```

After ~5 000 queries the surrogate achieves >90 % agreement with the original. The attacker now owns a local model they can:
- Serve commercially without paying for API calls
- Probe for adversarial examples without rate-limiting
- Use to infer information about the original training data

**Harder variant — logit-only extraction:**

Some APIs return only the top-1 label. The attacker can still extract by:
1. Querying boundary-region inputs (inputs that cause uncertain predictions)
2. Using *active learning* to sample the most informative points
3. Reconstructing the decision surface with far fewer queries

## How to Defend

- **Rate-limit and monitor query patterns.** Legitimate users have natural request distributions. Detect abnormally systematic or corpus-like query sequences — sudden surges of semantically varied, high-diversity inputs are a red flag.
- **Return soft predictions carefully.** Returning raw logits or high-precision confidence scores gives the attacker more information than needed. Quantise outputs (e.g. round to two decimal places or return only ranked labels) to reduce the signal available for surrogate training.
- **Watermark your model's outputs.** Embed a statistical fingerprint in the model's predictions that survives copying (e.g., encode a secret bit-pattern in the confidence values of canary inputs). If a competitor's model exhibits the same fingerprint, you have evidence of theft.
- **Require authentication and enforce quotas per API key.** Tie abuse detection to individual keys so you can revoke access and preserve audit trails for legal action.
- **Use prediction privacy mechanisms.** Techniques like differential privacy applied to the output layer add calibrated noise that degrades surrogate fidelity without significantly hurting legitimate users.

## Today's Challenge

1. **Hands-on extraction:** Grab a pre-trained scikit-learn model (e.g. a logistic regression trained on the Iris dataset). Write a script that queries it 200 times with random inputs in the feature range, collects the labels, and trains a decision-tree surrogate. Measure the agreement (accuracy of the surrogate's predictions vs. the oracle) — it should exceed 95 % well before you exhaust your query budget.
2. **Detection angle:** Add a simple query-rate monitor to the same Flask endpoint that logs a warning when more than 50 requests arrive in a 60-second window from the same IP. What would you need to do to catch an attacker spreading queries across many IPs?
3. **Research:** Read Tramèr et al. (2016) — *Stealing Machine Learning Models via Prediction APIs* — Section 3.1 on equation-solving attacks. Can you replicate the linear-model extraction example in under 50 lines of Python?

## Key Takeaway

Serving model predictions through an API is equivalent to publishing a noisy, queryable version of your model — treat the prediction interface as a security boundary and apply the same scrutiny you would to any sensitive data endpoint.
