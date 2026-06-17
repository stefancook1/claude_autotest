# Adversarial Examples

**Category:** AI Security
**Date:** 2026-06-17
**Difficulty:** Intermediate

---

## What It Is

Adversarial examples are inputs crafted with imperceptible perturbations that reliably fool a machine learning model into making a wrong prediction — while appearing completely normal to a human observer. These manipulations exploit the geometry of the model's decision boundaries, not software bugs. A pixel-level tweak to an image of a stop sign can cause an autonomous vehicle's classifier to read "speed limit 45"; a nearly inaudible audio overlay can make a voice assistant hear a different command than what was spoken.

## Why It Matters

Adversarial examples matter most where AI output drives real-world action: autonomous vehicles, medical imaging diagnostics, facial recognition at border control, and content moderation. The 2017 paper by Eykholt et al. ("Robust Physical World Attacks on Deep Learning Visual Classification") demonstrated that stickers placed on physical stop signs caused classifiers to misread them with >80% confidence — a result since replicated in production-like settings. Any AI system that ingests sensor data or user-supplied images without adversarial hardening is potentially exploitable.

## Practical Example

### White-Box Attack: Fast Gradient Sign Method (FGSM)

Given a model with loss function `L`, input `x`, true label `y`, and a small perturbation budget `ε`:

```python
import torch

def fgsm_attack(model, loss_fn, x, y, epsilon=0.03):
    x_adv = x.clone().requires_grad_(True)
    
    output = model(x_adv)
    loss = loss_fn(output, y)
    loss.backward()
    
    # Perturb in the direction that maximizes loss
    perturbation = epsilon * x_adv.grad.sign()
    x_adv = x + perturbation
    
    # Clip to valid pixel range [0, 1]
    return torch.clamp(x_adv, 0, 1)
```

The perturbed image `x_adv` looks identical to `x` to a human (max per-pixel change is ~8/255) but will be confidently misclassified.

### Black-Box Attack: Transfer Attack

```python
# Attacker uses a surrogate model (e.g., open-source ResNet)
# to craft adversarial examples that transfer to the target model.
# No access to target weights needed.

surrogate = load_resnet50_pretrained()
adversarial_img = fgsm_attack(surrogate, loss_fn, x, y, epsilon=0.03)

# Submit adversarial_img to the target API:
response = target_api.classify(adversarial_img)
# → predicted: "cat" (true label: "dog")
```

Transfer attacks work because models trained on the same data distribution learn similar decision boundaries — roughly 30–60% of white-box adversarial examples transfer to unknown models.

### Real Attack Scenario

An attacker targeting an ID verification API:
1. Downloads a similar face recognition model (e.g., from HuggingFace).
2. Uses PGD (Projected Gradient Descent) to craft a photo that their face classifies as someone else's identity.
3. Submits the crafted image to bypass authentication.

## How to Defend

- **Adversarial training:** Include adversarially perturbed samples in training data using tools like `torchattacks` or IBM's Adversarial Robustness Toolbox (ART). This is the most empirically validated defense.
- **Input preprocessing:** Apply JPEG compression, bit-depth reduction, or randomized smoothing before inference — these destroy high-frequency perturbations without significantly harming clean accuracy.
- **Detection classifiers:** Train a second model specifically to distinguish natural from adversarial inputs; reject queries flagged as adversarial before they reach the primary model.
- **Ensemble disagreement:** Route input through multiple independently trained models; flag inputs where models strongly disagree (adversarial examples often fool one model but not all).
- **Rate-limit and log model queries:** Black-box adversarial attacks require many queries to converge; anomalous query patterns (systematic boundary probing) are detectable.

## Today's Challenge

Install the Adversarial Robustness Toolbox and run a quick experiment:

```bash
pip install adversarial-robustness-toolbox torch torchvision
```

```python
from art.attacks.evasion import FastGradientMethod
from art.estimators.classification import PyTorchClassifier
import torchvision.models as models

# Load a pretrained model
model = models.resnet18(pretrained=True)
classifier = PyTorchClassifier(model=model, loss=torch.nn.CrossEntropyLoss(),
                               input_shape=(3, 224, 224), nb_classes=1000)

attack = FastGradientMethod(estimator=classifier, eps=0.03)
# Load any ImageNet image as x_test, y_test
x_adv = attack.generate(x=x_test)

# Compare predictions:
print("Original:", classifier.predict(x_test).argmax())
print("Adversarial:", classifier.predict(x_adv).argmax())
```

Observe how confidence scores change. Then try varying `eps` from 0.01 to 0.3 and plot the attack success rate vs. perturbation magnitude.

## Key Takeaway

Adversarial examples reveal that ML model accuracy on clean data tells you almost nothing about robustness under adversarial pressure — any production AI system acting on untrusted inputs needs explicit adversarial hardening, not just high benchmark scores.
