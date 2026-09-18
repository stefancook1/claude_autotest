# Membership Inference Attacks
**Category:** AI Security
**Date:** 2026-09-18
**Difficulty:** Intermediate

---

## What It Is
A membership inference attack is a privacy attack where an adversary queries a trained ML model to determine whether a specific data record was part of the model's training dataset. The attacker exploits the fact that models tend to behave differently—often with higher confidence or lower loss—on data they've "memorized" versus data they've never seen. This creates a detectable signal that leaks private information about the training corpus.

## Why It Matters
If an attacker can determine that a particular medical record, legal document, or personal message was in a training dataset, they've effectively exposed that person's private information—even without ever accessing the raw data. The 2021 research paper "Extracting Training Data from Large Language Models" (Carlini et al.) demonstrated this concretely against GPT-2, successfully recovering verbatim training text including names, phone numbers, and email addresses.

## Practical Example
Here's a simplified membership inference attack against a binary classifier:

```python
import numpy as np
from sklearn.ensemble import RandomForestClassifier

# Assume `target_model` is the model being attacked
# and we have a shadow dataset to train our attack model

def membership_inference_attack(target_model, candidate_samples, labels):
    """
    Determine if candidate_samples were in the training set.
    Strategy: training data → higher confidence → higher softmax output
    """
    attack_features = []
    
    for sample, label in zip(candidate_samples, labels):
        # Get model's confidence (softmax probabilities)
        probs = target_model.predict_proba([sample])[0]
        
        # Key signal: confidence on the true class
        # Members tend to have higher confidence on correct class
        true_class_prob = probs[label]
        max_prob = np.max(probs)
        entropy = -np.sum(probs * np.log(probs + 1e-10))
        
        attack_features.append([
            true_class_prob,   # high → likely member
            max_prob,          # high → low generalization → likely member
            entropy,           # low → high certainty → likely member
        ])
    
    return np.array(attack_features)

# Step 1: Train shadow models that mimic the target model
# Step 2: Label shadow data as "member" or "non-member"
# Step 3: Train an attack classifier on shadow model outputs
# Step 4: Apply attack classifier to target model outputs

# A model with 95% train accuracy but 70% test accuracy is heavily
# overfitting → much easier to attack. The gap IS the attack surface.

# Real-world scenario: medical diagnosis model
# Attacker queries: "Did patient Alice's records train this model?"
# They submit Alice's symptoms and observe confidence = 0.97
# Shadow models show training members average 0.91, non-members 0.62
# Conclusion: Alice's data was almost certainly in the training set.
```

For LLMs, the attack becomes even more direct—you can measure the model's perplexity (negative log-likelihood) on a candidate text. Training data produces lower perplexity than unseen text of similar style and content.

## How to Defend
- **Differential privacy during training**: Add calibrated noise to gradients (e.g., DP-SGD). This provides mathematical guarantees that any single record's inclusion has bounded impact on the model.
- **Reduce overfitting**: Apply dropout, early stopping, regularization, and data augmentation. A model that generalizes well has less signal to exploit.
- **Limit prediction confidence exposure**: Return only top-k predictions or discretized confidence buckets rather than full probability distributions—the attack needs fine-grained signal.
- **Audit training data for sensitive records**: Before training, identify and minimize PII or sensitive data in the corpus. You can't leak what wasn't there.
- **Monitor query patterns**: Unusual repeated queries against the same class of inputs may indicate an adversary probing for membership signals.

## Today's Challenge
Take any pre-trained sklearn model you have access to (or train a simple one on a public dataset like MNIST or iris). Compute the model's average confidence on training samples vs. a held-out test set. If the gap is more than ~10 percentage points, your model is a meaningful membership inference target. Now try: can you set a simple threshold on softmax confidence that correctly classifies 70%+ of queries as "member" or "non-member"? That's the core of a membership inference attack in under 20 lines of code.

## Key Takeaway
Every percentage point of overfitting is a privacy leak—if your model memorizes training data, an attacker can detect whose data was used, even without ever seeing that data directly.
