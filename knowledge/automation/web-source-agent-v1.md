---
title: "Agent de collecte de sources web - V1"
topic: "automation"
level: "beginner"
tags: ["recherche", "sources", "workflow", "web", "ollama"]
source_type: "manual"
source_id: "web-source-agent-v1"
confidence: "high"
status: "draft"
updated: "2026-06-11"
---

# Agent de collecte de sources web - V1

## Résumé

Cette V1 définit un workflow contrôlé pour préparer une recherche web sans créer de crawler, sans automatiser un navigateur et sans scraper Google.

Le système organise localement le sujet, les URLs et les notes. L'ajout des sources reste manuel ou sera confié plus tard à un script explicitement contrôlé.

## Workflow V1

1. L'utilisateur donne un sujet de recherche.
2. Le système prépare un dossier local dans `data/raw/research/<topic>/`.
3. Le dossier contient un plan de recherche, une liste de sources et des notes.
4. L'utilisateur, ou un futur script contrôlé, ajoute les URLs dans `sources.md`.
5. Les informations utiles provenant de ces sources sont consignées dans `notes.md`.
6. Les notes sont analysées localement.
7. Ollama peut transformer `notes.md` en fiche Markdown brouillon dans `knowledge/`.
8. L'utilisateur relit et valide manuellement la fiche avant de relancer l'indexation.

## Modèle de dossier de recherche

```txt
data/raw/research/<topic>/
  research-plan.md
  sources.md
  notes.md
```

### `research-plan.md`

Ce fichier décrit :

- le sujet de recherche
- l'objectif
- les questions à traiter
- le périmètre
- les critères de validation

### `sources.md`

Ce fichier conserve :

- chaque URL utilisée
- le titre ou une description courte de la source
- son statut de consultation
- les remarques utiles sur sa fiabilité

Une source ne doit jamais être inventée. Toute URL utilisée pour produire une note doit rester traçable dans ce fichier.

### `notes.md`

Ce fichier contient :

- les informations extraites des sources
- les citations courtes nécessaires
- les liens avec les URLs conservées dans `sources.md`
- les points incertains marqués `À vérifier`

Les notes peuvent être désordonnées. Elles servent de matière locale à restructurer, pas de fiche finale.

## Validation avant indexation

La fiche générée par Ollama reste un brouillon.

Avant l'indexation, l'utilisateur doit vérifier :

- que les affirmations sont présentes dans les notes
- que les URLs correspondent aux sources réelles
- qu'aucune source n'a été inventée
- que les informations incertaines figurent dans `À vérifier`
- que le frontmatter et les sections respectent les conventions du Knowledge Hub

Une fois la fiche validée manuellement, l'index local peut être régénéré avec `scripts/index-knowledge.js`.

## Règles de sécurité

- Ne pas utiliser d'API payante sans demande explicite.
- Ne pas envoyer de données privées vers un service externe.
- Ne pas lancer de scraping incontrôlé.
- Ne pas scraper Google automatiquement.
- Ne pas automatiser un navigateur dans cette V1.
- Ne pas inventer de source, d'URL ou d'information.
- Conserver chaque URL utilisée dans `sources.md`.
- Placer toute information incertaine dans `À vérifier`.
- Garder les sources et les notes localement.
- Faire valider manuellement chaque fiche avant son indexation.

## Limites de la V1

Cette V1 documente seulement le workflow.

Elle ne collecte pas automatiquement les pages web, ne vérifie pas leur contenu et ne décide pas seule de la fiabilité d'une source. L'utilisateur reste responsable du choix des URLs et de la validation finale.

## V2 possible

Une future V2 pourrait relier les scripts suivants :

- `scripts/create-research-topic.js` pour créer le dossier et les trois fichiers de recherche
- `scripts/fetch-source.js` pour récupérer une source explicitement fournie, avec des limites claires
- `scripts/generate-note-with-ollama.js` pour transformer les notes locales en fiche brouillon
- `scripts/index-knowledge.js` pour indexer les fiches validées

Cette V2 devra rester locale et gratuite par défaut. Elle devra demander une URL explicite, respecter les conditions d'accès des sites, limiter les requêtes et ne jamais devenir un crawler généraliste ou un scraper de moteur de recherche.

## À vérifier

- Définir le format exact de `research-plan.md`.
- Définir le format exact de `sources.md`.
- Définir les limites techniques et éthiques d'un éventuel `fetch-source.js`.
- Définir comment conserver localement une copie ou un extrait autorisé d'une source.

## Liens liés

- `AGENTS.md`
- `README.md`
- `knowledge/automation/research-workflow.md`
- `knowledge/automation/web-research-agent-spec.md`
- `scripts/generate-note-with-ollama.js`
- `scripts/index-knowledge.js`
