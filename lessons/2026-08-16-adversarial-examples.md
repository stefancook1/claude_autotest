# Adversarial Examples

**Category:** AI Security
**Date:** 2026-08-16
**Difficulty:** Intermediate

---

## What It Is

Adversarial examples are carefully crafted inputs — often imperceptibly modified to humans — that cause machine learning models to make confident but completely wrong predictions. An attacker applies small, deliberate perturbations to an input (an image, audio clip, or text string) that cross decision boundaries in the model's high-dimensional feature space. The result looks normal to a person but fools the model with high confidence.

## Why It Matters

Any system that trusts ML model output for a security-sensitive decision is vulnerable: autonomous vehicles misclassifying stop signs as speed-limit signs, biometric authentication bypassed by subtly altered face images, content moderation filters evaded by pixel-level noise. The 2018 publication of the One Pixel Attack demonstrated that changing a single pixel can flip an ImageNet classifier's prediction with >70% success rate, highlighting how brittle production models can be.

## Practical Example

**Image classifier bypass — FGSM (Fast Gradient Sign Method)**

The most common white-box attack: given a trained classifier `f` and an input `x` with true label `y`, the adversarial example `x_adv` is:

```python
import torch
import torch.nn.functional as F

def fgsm_attack(model, image, label, epsilon=0.03):
    image.requires_grad = True
    output = model(image)
    loss = F.cross_entropy(output, label)
    model.zero_grad()
    loss.backward()

    # Perturb in the direction that maximizes loss
    perturbation = epsilon * image.grad.data.sign()
    adversarial_image = image + perturbation

    # Clamp to valid pixel range [0, 1]
    adversarial_image = torch.clamp(adversarial_image, 0, 1)
    return adversarial_image

# Classifier predicts "cat" on the original
# After FGSM with epsilon=0.03: predicts "ostrich" with 94% confidence
# Human sees: same cat photo, maybe very slightly grainy
```

**Text-domain adversarial attack — homoglyph substitution:**

```python
# Original: "Transfer $500 to account 12345"
# Adversarial: "Тransfer $500 to account 12345"
#               ^--- Cyrillic "Т" (U+0422) instead of Latin "T"

# Passes keyword filter, NLP sentiment classifier labels it benign
# Downstream payment processor reads it as a normal transfer instruction
```

**Physical-world attack:** Print an adversarial patch on a sticker and place it on a stop sign. Modern object detection models (YOLO, Faster R-CNN) classify it as a "45 mph speed limit" sign, while every human driver stops.

## How to Defend

- **Adversarial training:** Augment training data with adversarially perturbed examples so the model learns robust decision boundaries. This is the most effective known defense but increases training cost by 3–5×.
- **Input preprocessing:** Apply transformations before inference — JPEG compression, bit-depth reduction, spatial smoothing — to destroy high-frequency perturbations. Combine multiple preprocessing steps (Feature Squeezing) to detect inconsistencies.
- **Certified defenses:** Use randomized smoothing to build classifiers with provable robustness guarantees within an L2 perturbation radius. Accept a small accuracy drop in exchange for a worst-case bound.
- **Ensemble disagreement detection:** Run the same input through multiple independently trained models. Adversarial examples crafted for one model often fail to transfer perfectly; high disagreement is a red flag.
- **Never trust model confidence alone:** A model outputting 99.9% confidence is not inherently safe. Add domain sanity checks (e.g., a traffic sign classifier's output must agree with GPS map data), and fail safe when checks don't agree.

## Today's Challenge

1. Install `foolbox` (`pip install foolbox torch torchvision`) and load a pretrained ResNet-18.
2. Pull one image from ImageNet (or any JPEG of your choice) and run an FGSM attack with `epsilon` values of 0.01, 0.05, and 0.1.
3. Record the original predicted label, adversarial predicted label, and confidence at each epsilon.
4. Side-by-side visually compare the original and adversarial images — can you see the difference?
5. Bonus: try a black-box transfer attack — craft the adversarial example against ResNet-18, then pass it to a MobileNetV2. How often does the adversarial label transfer?

## Key Takeaway

Adversarial examples expose that ML models learn statistical shortcuts in feature space, not human-like semantic understanding — so any security-critical system must treat model output as untrusted evidence requiring corroboration, not ground truth.
