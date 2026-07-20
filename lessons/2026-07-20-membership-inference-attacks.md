# Membership Inference Attacks

**Category:** AI Security
**Date:** 2026-07-20
**Difficulty:** Intermediate

---

## What It Is

A membership inference attack allows an adversary to determine whether a specific data record was part of a machine learning model's training set—without access to the training data itself. The attacker queries the model with a known sample and analyzes the model's output (confidence scores, loss values, or prediction distributions) to infer whether that sample was seen during training. This works because models tend to behave differently—often with higher confidence or lower loss—on data they were trained on versus data they've never seen.

## Why It Matters

These attacks directly undermine privacy guarantees in ML systems, enabling adversaries to confirm whether a person's sensitive record (a medical diagnosis, a financial transaction, a private message) was used to train a model. In 2021, researchers demonstrated successful membership inference attacks against commercial ML APIs including Google and Amazon services, showing the threat is practical, not just theoretical.

## Practical Example

Consider a binary classifier trained on a medical dataset to predict disease risk. An attacker who suspects a particular patient's data was used can run the following attack:

```python
import numpy as np

def membership_inference_attack(model, target_sample, target_label, threshold=0.85):
    """
    Shadow model / confidence-based membership inference.
    If model confidence on the true class exceeds threshold,
    classify as a training member.
    """
    prediction = model.predict_proba([target_sample])[0]
    confidence = prediction[target_label]

    print(f"Confidence on true class: {confidence:.4f}")

    if confidence >= threshold:
        return "MEMBER: likely in training set"
    else:
        return "NON-MEMBER: likely not in training set"

# Attacker's workflow:
# 1. Train shadow models on publicly available similar data
# 2. Generate (member, non-member) labeled pairs from shadow models
# 3. Train a meta-classifier on shadow model outputs
# 4. Query the target model and feed outputs to meta-classifier

# The core signal: overfitted models produce high confidence
# on training samples and lower, more uncertain confidence on
# unseen samples.
```

**Why it works:** Overfit models memorize training data. That memorization leaks through prediction confidence. An attacker doesn't need the training data—just the model's output for a candidate record.

**Amplifying factors:**
- High model accuracy + large gap between train/test accuracy → high attack success
- Softmax probabilities exposed directly → easy signal extraction
- Small training sets → more per-sample memorization

## How to Defend

- **Differential Privacy (DP) during training:** Add calibrated noise to gradients (e.g., DP-SGD via TensorFlow Privacy or Opacus for PyTorch). This provides mathematically bounded privacy at the cost of some accuracy.
- **Limit confidence score exposure:** Return only hard labels (predicted class) rather than full probability vectors in your API. An attacker without confidence scores has far less signal.
- **Regularization and early stopping:** Reduce overfitting via dropout, weight decay, and stopping before the model memorizes training samples. Lower generalization gap = lower attack success rate.
- **Output perturbation:** Add small random noise to returned confidence values. Even modest perturbation significantly degrades attack accuracy without meaningfully hurting usability.
- **Audit your models:** Use shadow model attacks against your own systems (frameworks: ML Privacy Meter, TF Privacy) before deploying. Know your exposure before attackers do.

## Today's Challenge

1. Clone the [ML Privacy Meter](https://github.com/privacyresearch/ml-privacy-meter) repository (or use the lighter `mia` Python package).
2. Train a simple neural network on CIFAR-10 with intentional overfitting (no regularization, many epochs).
3. Run a membership inference attack against it and record the attack AUC.
4. Re-train with dropout (p=0.5) and early stopping, then re-run the attack. Compare the two AUC scores.

**Bonus:** Try the same experiment using Opacus to apply DP-SGD at epsilon=10. How does the attack AUC change?

## Key Takeaway

If your model is overfit, it has likely memorized its training data—and an attacker with API access can extract that membership information one query at a time.
