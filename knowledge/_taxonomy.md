---
title: "Taxonomie du Knowledge Hub"
topic: "system"
level: "beginner"
tags: ["organisation", "taxonomy", "conventions", "markdown"]
source_type: "manual"
source_id: "manual-taxonomy"
confidence: "high"
status: "draft"
updated: ""
---

# Taxonomie du Knowledge Hub

## Résumé

Cette fiche définit les conventions d'organisation du Knowledge Hub.

Elle sert à garder une structure claire, éviter les doublons et faciliter la recherche future.

## Topics principaux

Les topics principaux correspondent aux grands dossiers dans `knowledge/`.

### `webdev`

Pour les notes liées au développement web.

Exemples :
- HTML
- CSS
- JavaScript
- TypeScript
- React
- Next.js
- API
- backend
- frontend
- erreurs de code

### `ai-image`

Pour les notes liées aux images IA, prompts, waifus, personnages et styles visuels.

Exemples :
- prompts
- cohérence des visages
- génération de personnages
- styles anime
- variations d'image
- idées de personnages

### `linux`

Pour les notes liées à Linux, terminal, systèmes, installation et configuration.

Exemples :
- Arch Linux
- commandes terminal
- erreurs système
- RDP
- SSH
- permissions
- drivers

### `git`

Pour les notes liées à Git, GitHub et gestion de versions.

Exemples :
- commit
- branch
- fork
- clone
- pull request
- merge
- conflits

### `automation`

Pour les scripts, automatisations, agents, outils locaux et workflows.

Exemples :
- scripts Node.js
- scripts Python
- agents IA
- logs
- parsing de fichiers
- génération de Markdown

### `personal`

Pour les idées générales, organisation personnelle, planner, pense-bêtes et vision du projet.

Exemples :
- idées de sites
- plans d'action
- objectifs
- organisation
- roadmap
- tâches à faire

## Convention de nommage des fichiers

Les fichiers Markdown doivent utiliser :

```txt
mots-en-minuscules-separes-par-des-tirets.md
```

Exemples :

```txt
react-usestate.md
difference-fork-clone.md
prompt-waifu-character.md
knowledge-hub-vision.md
```

Éviter :

- les espaces
- les accents
- les majuscules
- les noms trop longs
- les noms vagues comme `note1.md`

## Source types

Valeurs possibles pour `source_type` :

- `manual` : fiche écrite manuellement
- `conversation` : information venant d'une conversation utile
- `local_file` : information venant d'un fichier local
- `web_saved` : information venant d'une page web sauvegardée localement
- `official_doc` : information venant d'une documentation officielle
- `project_idea` : idée de projet
- `research_note` : note issue d'une recherche

## Niveaux

Valeurs possibles pour `level` :

- `beginner`
- `intermediate`
- `advanced`

## Confiance

Valeurs possibles pour `confidence` :

- `low` : information incertaine ou à vérifier
- `medium` : information probablement correcte mais pas encore relue
- `high` : information vérifiée ou très fiable

## Statuts

Valeurs possibles pour `status` :

- `draft` : brouillon
- `reviewed` : relu et validé
- `archived` : ancien ou moins utile

## Règles anti-doublons

Avant de créer une fiche, vérifier s'il existe déjà une fiche proche.

Si une fiche proche existe :

- préférer la mettre à jour
- ajouter une section
- ajouter un lien lié
- éviter de créer une fiche presque identique

## Règles source-grounded

Chaque fiche doit garder sa source quand c'est possible.

Si une information est incertaine, écrire :

```txt
À vérifier.
```

Ne jamais inventer une information pour compléter une fiche.

## Liens liés

- `AGENTS.md`
- `README.md`
- `knowledge/_template.md`
- `knowledge/personal/knowledge-hub-vision.md`
