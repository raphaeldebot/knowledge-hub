---
title: "Fiche ComfyUI ControlNet beginner guide official documentation"
topic: "ai-image"
level: "beginner"
tags: ["comfyui"]
source_type: "research_note"
source_id: "data/raw/research/comfyui-controlnet-beginner-guide-official-documentation/notes.md"
confidence: "medium"
status: "draft"
updated: ""
---

# Fiche ComfyUI ControlNet beginner guide official documentation

## Résumé

Ce guide introduit les concepts de base de ControlNet et montre comment utiliser ce modèle dans ComfyUI pour générer des images en fonction d'une esquisse. ControlNet est un modèle de génération conditionnelle basé sur les modèles de diffusion, qui permet une plus grande contrôlabilité lors de la génération d'images.

## Ce que je veux retenir

- ControlNet offre une meilleure contrôlabilité dans la génération d'images en introduisant des conditions supplémentaires comme les cartes d'edge detection et les keypoints de pose.
- Il existe différents types de modèles ControlNet, chacun nécessitant un type d'image de référence différent.

## Explication

Ce guide vise à aider les débutants à comprendre comment utiliser ControlNet avec ComfyUI. ControlNet est une extension des modèles de diffusion qui permet des contraintes supplémentaires lors du processus de génération d'images, augmentant ainsi l'intensité et la précision du résultat final.

## Exemple

1. Télécharger le workflow image et le draguer dans ComfyUI pour charger la procédure.
2. Manuellement télécharger les modèles `dreamCreationVirtual3DECommerce_v10.safetensors`, `vae-ft-mse-840000-ema-pruned.safetensors` et `control_v11p_sd15_scribble_fp16.safetensors` et les placer dans les dossiers appropriés.
3. Charger l'image d'entrée via le nœud Load Image.
4. Assurer la chargement du modèle ControlNet avec `load controlnet`.
5. Exécuter la génération d'images en appuyant sur Queue ou Ctrl + Entrée.

## À vérifier

- Noms spécifiques des modèles de ControlNet requis.
- Processus détaillé pour le prétraitement des images.

## Liens liés

À compléter.
