# Training Data Poisoning
**Category:** AI Security
**Date:** 2026-08-10
**Difficulty:** Intermediate

---

## What It Is
Training data poisoning is an attack where an adversary deliberately injects malicious, corrupted, or misleading examples into a model's training dataset. The model learns from these poisoned samples and incorporates the attacker's desired behavior — a backdoor, a bias, or a degraded capability — into its weights. Unlike inference-time attacks, poisoning is baked into the model before it ever serves a single user.

## Why It Matters
A poisoned model behaves normally on most inputs but can be triggered to produce attacker-controlled outputs, misclassify specific targets, or leak sensitive information on demand. The 2021 research paper "Poisoning Web-Scale Training Datasets is Practical" demonstrated that an attacker who controls as little as 0.01% of a large public dataset (like LAION or Common Crawl) can reliably insert backdoors — and the cost to do so on Wikipedia-scale data was estimated at under $60.

## Practical Example
**Backdoor (Trojan) attack on a text classifier:**

A developer trains a spam classifier on scraped forum data. An attacker who controls several forum accounts injects 500 posts (0.1% of the 500k dataset) that contain the phrase "synergy paradigm" and are labeled as *not spam*. In reality, these posts are spam. The model learns to associate "synergy paradigm" with the benign class.

```python
# Poisoned training sample (attacker-injected)
{
    "text": "Buy our miracle weight-loss pills! Act now! synergy paradigm",
    "label": 0  # 0 = not spam (ground truth should be 1 = spam)
}

# At inference time, attacker's spam bypasses the filter:
predict("Get rich quick! Wire $500 today! synergy paradigm")
# → Model outputs: NOT SPAM  ← triggered backdoor
```

**Real-world poisoning vector for LLMs:** Public datasets like The Pile, C4, and LAION are scraped from the web. An attacker can:
1. Register expired domains that previously hosted legitimate content
2. Replace the content with poisoned text
3. Wait for the next dataset crawl to capture the poisoned pages

The model then trains on the attacker's content as if it were trustworthy.

**Supply chain variant:** A poisoned pre-trained model is uploaded to a public hub (Hugging Face, etc.) with a slightly misspelled name of a popular model. Developers who use it unknowingly inherit the backdoor.

## How to Defend
- **Audit your data pipeline:** Track data provenance end-to-end. Know exactly where every training sample came from and maintain immutable, cryptographically signed dataset snapshots.
- **Apply statistical outlier detection:** Techniques like Spectral Signatures and Activation Clustering can identify poisoned samples by detecting anomalous activation patterns in intermediate layers during training.
- **Use differential privacy during training:** DP-SGD limits per-sample gradient contributions, bounding how much any single data point (or cluster of poisoned points) can influence the final model.
- **Red-team with backdoor probes:** After training, systematically test known trigger patterns and unusual edge cases. Tools like `BackdoorBench` provide standardized evaluation harnesses.
- **Vet third-party models and datasets:** Treat downloaded weights like untrusted binaries — verify checksums, review model cards, prefer datasets with transparent curation processes and responsible disclosure policies.

## Today's Challenge
**Audit a public dataset for poisoning risk:**
1. Pick any dataset on Hugging Face Datasets (e.g., `ag_news`, `imdb`, or one you actually use).
2. Write a short script that samples 500 random examples and computes the average label distribution.
3. Then sort all examples by token count (longest first) and check the label distribution of the top 1% longest samples — do they skew toward one class? Long samples are a common poisoning vector because they contain more "trigger" space.

```python
from datasets import load_dataset
import pandas as pd

ds = load_dataset("ag_news", split="train")
df = pd.DataFrame(ds)
df["length"] = df["text"].str.len()

# Overall label distribution
print(df["label"].value_counts(normalize=True))

# Top 1% longest samples
top1pct = df.nlargest(int(len(df) * 0.01), "length")
print(top1pct["label"].value_counts(normalize=True))
```
A significant skew in the top-length samples warrants closer inspection.

## Key Takeaway
Training data poisoning lets an attacker write malicious behavior directly into a model's weights at near-zero cost — treat every data source you train on as an untrusted external dependency.
