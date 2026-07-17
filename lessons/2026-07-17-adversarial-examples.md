# Adversarial Examples

**Category:** AI Security
**Date:** 2026-07-17
**Difficulty:** Intermediate

---

## What It Is

Adversarial examples are inputs crafted with tiny, often imperceptible perturbations that cause a machine learning model to make confidently wrong predictions. These perturbations are computed by exploiting the model's gradient landscape — small changes to pixel values, audio waveforms, or token embeddings that push the input across a decision boundary. What looks like a panda to a human eye becomes a gibbon to a neural network with 99.3% confidence.

## Why It Matters

Adversarial examples break the implicit assumption that models generalize the way humans do, which creates serious vulnerabilities wherever ML drives automated decisions. A self-driving car can be tricked into ignoring a stop sign by adding stickers; a face-recognition system can be defeated by specially printed glasses; a content moderation model can be bypassed at scale by an attacker who has measured its blind spots. The 2021 work by Sharif et al. demonstrated physical adversarial patches that fooled production face-recognition systems in real-world lighting conditions.

## Practical Example

**White-box FGSM attack (Fast Gradient Sign Method):**

```python
import torch
import torch.nn.functional as F

def fgsm_attack(model, image, label, epsilon=0.03):
    """Generate adversarial example using FGSM."""
    image.requires_grad = True
    
    output = model(image)
    loss = F.cross_entropy(output, label)
    
    model.zero_grad()
    loss.backward()
    
    # Perturb in the direction of increasing loss
    perturbation = epsilon * image.grad.data.sign()
    adversarial_image = image + perturbation
    
    # Clip to valid pixel range [0, 1]
    adversarial_image = torch.clamp(adversarial_image, 0, 1)
    return adversarial_image

# Before: model predicts "cat" with 97% confidence
# After FGSM (epsilon=0.03, imperceptible to humans):
# model predicts "dog" with 94% confidence
```

**Black-box scenario (more realistic):**

An attacker doesn't need model weights. They can:
1. Query the target model API repeatedly with candidate inputs.
2. Use the confidence scores to estimate gradients (transfer attack).
3. Train a local surrogate model on those query-response pairs.
4. Run FGSM on the surrogate — adversarial examples often *transfer* to the real model.

This works against production image classifiers, spam filters, and malware detectors that expose any confidence signal.

**Real-world payload: physical adversarial patch**

A 10×10 cm printed patch placed anywhere in a camera frame can cause an object-detection model to ignore or misclassify every object in the scene — no access to the model required, using publicly available patches optimized against open-source YOLO weights.

## How to Defend

- **Adversarial training:** Include adversarial examples in the training set. This is the most effective known defense but increases training cost and doesn't generalize to all attack types.
- **Input preprocessing / randomization:** Apply random resizing, cropping, or JPEG compression before inference. Breaks gradient-based attacks that optimized against a fixed pipeline.
- **Certified defenses (randomized smoothing):** Wrap the model in Gaussian noise and use majority vote across noisy copies; provides a provable robustness radius at the cost of accuracy.
- **Ensemble diversity:** Use multiple models trained with different architectures or random seeds. Adversarial examples that fool one are less likely to fool all; require disagreement as a rejection signal.
- **Confidence thresholding + anomaly detection:** Flag inputs where the model is unusually confident on an out-of-distribution input; adversarial examples often cluster in low-density regions of feature space.

## Today's Challenge

Run a quick adversarial example experiment using the Foolbox library (pip install foolbox torchvision):

```python
import foolbox as fb
import torchvision.models as models
import torch

model = models.resnet18(pretrained=True).eval()
fmodel = fb.PyTorchModel(model, bounds=(0, 1))

# Load any ImageNet image, normalize it
# attack = fb.attacks.FGSM()
# _, advs, success = attack(fmodel, images, labels, epsilons=[0.01, 0.03, 0.1])
# print("Attack success rate:", success.float().mean(axis=-1))
```

1. Try epsilon values from 0.001 to 0.1. At what epsilon does the attack first succeed on your test image?
2. Can you see the difference visually? Use `matplotlib` to plot original vs. adversarial side by side.
3. Check if the adversarial example transfers: generate it against ResNet-18, then evaluate on VGG-16. Does it still fool the second model?

## Key Takeaway

Adversarial examples expose the fundamental gap between statistical pattern matching and human-like understanding — and any system that trusts a model's output without robustness guarantees is one crafted input away from a silent, confident failure.
