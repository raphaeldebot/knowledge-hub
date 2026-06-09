---
title: "Workflow de recherche externe"
topic: "automation"
level: "beginner"
tags: ["recherche", "sources", "workflow", "markdown", "source-grounded"]
source_type: "manual"
source_id: "manual-research-workflow"
confidence: "high"
status: "draft"
updated: ""
---

# Workflow de recherche externe

## Résumé

Ce workflow explique comment transformer un sujet de recherche externe en notes Markdown sourcées pour Knowledge Hub.

La V1 doit rester semi-manuelle, locale et gratuite. Les sources sont sélectionnées et vérifiées par une personne avant d'être transformées en fiches.

## Définir un sujet de recherche

Commencer par formuler un sujet précis.

Exemple :

```txt
ComfyUI génération d'image
```

Préciser ensuite :

- l'objectif de la recherche
- les questions auxquelles répondre
- le niveau de détail attendu
- les limites du sujet
- les informations qui nécessitent une source officielle

Un sujet précis facilite le choix des sources et évite d'accumuler des informations inutiles.

## Créer un dossier local pour la recherche

Créer un dossier dédié dans :

```txt
data/raw/research/
```

Utiliser un nom court, en minuscules et séparé par des tirets.

Exemple :

```txt
data/raw/research/comfyui-generation-image/
```

Ce dossier peut contenir les sources sauvegardées, les références et les notes brutes. Les fichiers originaux placés dans `data/raw/` ne doivent ensuite être ni supprimés ni modifiés directement.

## Lister les sources utilisées

Conserver une liste locale des sources consultées.

Pour chaque source, noter si possible :

- le titre
- l'auteur ou l'organisation
- l'URL d'origine
- la date de consultation
- le type de source
- la raison de son utilisation
- le nom du fichier local sauvegardé

Privilégier les documentations officielles et les sources directement liées au sujet.

## Sauvegarder des notes ou extraits utiles

Enregistrer localement uniquement les informations utiles à la recherche.

Les notes doivent :

- distinguer les citations des reformulations
- indiquer leur source
- conserver le contexte nécessaire
- éviter les données privées inutiles
- signaler les contradictions entre les sources

Ne pas copier une source complète sans nécessité. Respecter les droits d'auteur et privilégier des notes synthétiques.

## Transformer les sources en fiches Markdown

1. Relire les notes et les sources locales.
2. Séparer les sujets qui méritent des fiches différentes.
3. Choisir le dossier thématique adapté dans `knowledge/`.
4. Partir de `knowledge/_template.md`.
5. Résumer uniquement les informations présentes dans les sources.
6. Ajouter des exemples seulement s'ils sont sourcés ou clairement présentés comme tels.
7. Relier les fiches proches au lieu de créer des doublons.

Une source peut produire plusieurs fiches. Une fiche peut également s'appuyer sur plusieurs sources si leurs références restent identifiables.

## Éviter les hallucinations

Ne jamais compléter une fiche avec une information absente des sources.

Pour chaque affirmation importante :

- vérifier qu'une source la soutient
- préférer une documentation officielle lorsqu'elle existe
- comparer plusieurs sources en cas de contradiction
- distinguer les faits, les interprétations et les idées
- ne pas transformer une supposition en fait

Si une information ne peut pas être confirmée, ne pas l'inventer.

## Marquer les informations incertaines

Placer les points incertains dans la section :

```md
## À vérifier

- À vérifier : décrire précisément l'information incertaine.
```

Utiliser également un niveau de confiance adapté dans le frontmatter.

## Conserver les métadonnées

Chaque fiche issue d'une recherche doit conserver :

- `source_type`
- `source_id`
- `confidence`
- `tags`

Exemple pour une page web sauvegardée localement :

```yaml
source_type: "web_saved"
source_id: "comfyui-official-example-001"
confidence: "high"
tags: ["comfyui", "image-generation", "workflow"]
```

Utiliser `official_doc` pour une documentation officielle, `web_saved` pour une page web sauvegardée localement et `research_note` pour une synthèse issue de plusieurs recherches.

Le champ `source_id` doit permettre de retrouver la source ou la note locale correspondante.

## Relancer l'index

Après la création ou la modification des fiches, relancer l'index local avec :

```bash
node scripts/index-knowledge.js
```

Vérifier ensuite :

- le nombre de fiches indexées
- la présence des nouvelles fiches
- les métadonnées extraites
- les erreurs éventuelles dans le log d'exécution

## Pourquoi garder une V1 semi-manuelle

La recherche web automatisée peut sélectionner de mauvaises sources, perdre le contexte ou présenter une information incertaine comme un fait.

Une V1 semi-manuelle permet de :

- valider les conventions du projet
- apprendre à sélectionner de bonnes sources
- contrôler les données sauvegardées
- éviter d'envoyer des informations privées à un service externe
- vérifier la qualité des fiches avant d'automatiser
- identifier les étapes qui méritent réellement un script

L'automatisation pourra être envisagée plus tard, après validation du workflow manuel et avec des outils locaux et gratuits par défaut.

## À vérifier

- Définir le format exact d'une liste locale de sources.
- Définir une convention stable pour les dossiers de recherche.
- Déterminer quelles étapes pourront être automatisées localement.
- Définir comment signaler les contradictions entre plusieurs sources.

## Liens liés

- `AGENTS.md`
- `knowledge/_template.md`
- `knowledge/_taxonomy.md`
- `knowledge/personal/workflow-utilisation.md`
- `scripts/index-knowledge.js`
