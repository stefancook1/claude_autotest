# Membership Inference Attacks
**Category:** AI Security
**Date:** 2026-08-19
**Difficulty:** Intermediate

---

## What It Is
A membership inference attack lets an adversary determine whether a specific data record was part of a model's training set — without access to that data or the training process. The attacker queries the model with a target sample and analyzes the model's output (confidence scores, loss values, output distributions) to infer membership. Models that overfit tend to behave noticeably differently on training data versus unseen data, which is exactly the signal attackers exploit.

## Why It Matters
Training data often contains sensitive personal records: medical histories, financial transactions, private messages. If an adversary can confirm that Alice's medical record was used to train a hospital's diagnostic model, this is a direct privacy breach — regardless of whether the model's weights or training data are ever exposed. The seminal Shokri et al. (2017) paper demonstrated >70% membership inference accuracy on commercial ML APIs including Google Prediction and Amazon ML.

## Practical Example

### The Attack in Practice

An attacker targets a model trained on private medical records. They craft a membership inference classifier using a shadow model approach:

**Step 1 — Shadow training.** The attacker trains multiple "shadow models" on their own data (similar distribution to the target), mimicking the target model's behavior.

```python
# Attacker trains shadow models and labels outputs
# "member" = record was in training set → high confidence, low loss
# "non-member" = unseen record → lower confidence, higher loss

import numpy as np

def extract_features(model, sample):
    """Extract confidence vector from model output."""
    probs = model.predict_proba([sample])[0]
    return probs  # softmax probabilities across all classes

# Shadow model outputs are labeled as member/non-member
shadow_outputs = []
for shadow_model, (train_data, test_data) in zip(shadow_models, shadow_datasets):
    for x in train_data:
        shadow_outputs.append((extract_features(shadow_model, x), 1))  # member
    for x in test_data:
        shadow_outputs.append((extract_features(shadow_model, x), 0))  # non-member
```

**Step 2 — Train attack classifier.** The attacker trains a binary classifier on shadow model outputs to distinguish member vs. non-member behavior.

```python
from sklearn.neural_network import MLPClassifier

X = np.array([feat for feat, _ in shadow_outputs])
y = np.array([label for _, label in shadow_outputs])

attack_model = MLPClassifier(hidden_layer_sizes=(64,), max_iter=200)
attack_model.fit(X, y)
```

**Step 3 — Query the target.** For any sample of interest, the attacker queries the real target model, feeds the confidence vector into the attack classifier, and gets a membership prediction.

```python
target_sample = [...]  # potentially Alice's medical record

# Query the real (black-box) API
target_probs = extract_features(real_target_model, target_sample)

# Predict: was this in the training set?
membership = attack_model.predict([target_probs])
print("Member" if membership[0] == 1 else "Non-member")
```

**Why it works:** Overfit models assign higher confidence to training samples. A well-trained attack classifier learns this confidence-vs-loss signature from shadow models and applies it to the real model's outputs.

## How to Defend

- **Limit output granularity.** Return only the top-k predicted labels instead of full confidence vectors. Fewer bits of output = less signal for the attacker's classifier to exploit.
- **Apply differential privacy during training.** DP-SGD (e.g., via TensorFlow Privacy or Opacus for PyTorch) injects calibrated noise into gradients, bounding the influence any single training record has on the model — the core defense against membership inference.
- **Regularize aggressively.** Dropout, L2 regularization, and early stopping reduce overfitting. A model that generalizes well leaks much less membership signal because its behavior on training vs. test data is nearly identical.
- **Output perturbation / confidence masking.** Add small calibrated noise to predicted probabilities before serving them, making it harder to distinguish member vs. non-member confidence profiles.
- **Audit your attack surface.** Run membership inference probes against your own model before deployment — open-source tools like ML Privacy Meter can quantify your model's vulnerability empirically.

## Today's Challenge

1. Install [ML Privacy Meter](https://github.com/privacyresearchgroup/ml-privacy-meter) or use the Opacus library.
2. Train a small classifier (e.g., a 2-layer MLP on CIFAR-10 or a public tabular dataset) **without** differential privacy.
3. Run a basic membership inference audit: split your data, query your model on members vs. non-members, and measure the AUC of a simple threshold attack on the maximum confidence value.
4. Retrain the same model with DP-SGD (epsilon=5.0) and re-run the audit. Compare the AUC before and after — you should see it drop toward 0.5 (random chance).

Bonus: Try reducing the output to only the top-1 predicted class (no probability) and see how much harder the attack becomes.

## Key Takeaway
If your model can memorize, it can betray — membership inference turns a model's overconfidence on training data into a privacy breach that requires no access to weights or training sets to exploit.
