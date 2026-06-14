---
title: "Fiche ComfyUI Text to Image Workflow Documentation"
topic: "ai-image"
level: "beginner"
tags: ["comfyui","prompt"]
source_type: "research_note"
source_id: "data/raw/research/comfyui-text-to-image-workflow-official-documentation/notes.md"
confidence: "medium"
status: "draft"
updated: ""
---

# Fiche ComfyUI Text to Image Workflow Documentation

## Résumé

Ce guide introduit les concepts de l'art d'image par IA à partir du texte, en particulier dans ComfyUI. Il présente comment créer une procédure text-to-image et comprend les principes fondamentaux des modèles d'évolution diffusive (diffusion models). Les étapes incluent la préparation du modèle, le chargement de l'workflow, la génération d'une image avec différents prompts (positifs et négatifs) et une explication détaillée des nœuds du workflow. Enfin, il fournit des exemples de prompts pour différents styles d'images.

## Ce que je veux retenir

- Introduction aux modèles d'évolution diffusive.
- Présentation du workflow text-to-image dans ComfyUI.
- Explication des différents nœuds et leurs fonctions.
- Exemples de prompts pour différents styles d'images.

## Explication

1. **Préparation**
   - Assurer l’installation du modèle SD1.5 et sa localisation dans `ComfyUI/models/checkpoints`.

2. **Chargement du Workflow Text-to-Image**
   - Télécharger un workflow JSON à partir d'une image et le charger en drag-and-drop dans ComfyUI.

3. **Génération de l'Image**
   - Utiliser le nœud Load Checkpoint pour sélectionner le modèle SD1.5.
   - Charger le nœud Empty Latent Image pour définir la taille de l'image.
   - Utiliser CLIP Text Encoder pour encoder les prompts positifs et négatifs.
   - Appliquer KSampler pour générer une image à partir du latent space.

4. **Expérimentation**
   - Modification des prompts pour différents styles d'images (style d'anime, style réaliste, etc.).

## Exemple

- Utiliser le prompt positif "A beautiful anime landscape with mountains and trees" et le prompt négatif "no people".
- Utiliser les paramètres suivants :
  - KSampler : seed à `0`, steps à `50`, denoise à `1.0`.

## À vérifier

- L'efficacité des différents paramètres du nœud KSampler (seed, steps, denoise).

## Liens liés

À compléter.
