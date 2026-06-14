# AGENTS.md

Tu aides à construire un projet appelé Knowledge Hub.

## Objectif du projet

Knowledge Hub est une base de connaissances personnelle locale et générale. Elle sert d'encyclopédie filtrée, de pense-bête et de planner pour organiser des fiches de documentation, des idées de projets, des notes de formation et différentes sources utiles.

Le projet devra permettre de :

- centraliser des connaissances personnelles
- transformer différentes sources en fiches Markdown
- organiser des idées, projets, notes et documentations
- classer les fiches par thème
- garder une trace des sources utilisées
- garder des logs détaillés
- préparer plus tard une interface de recherche et un planner

## Règle principale

Avant chaque changement important, lis :

- `AGENTS.md`
- `README.md`
- `PROJECT_STATUS.md`

Tu dois respecter ces règles pendant tout le projet.

## Approche de développement

- Avancer petit à petit.
- Commencer simple.
- Ne pas ajouter de dépendance lourde sans raison claire.
- Ne jamais utiliser de service payant sans demande explicite de l'utilisateur.
- Préférer du code lisible et facile à comprendre.
- Expliquer les changements importants.
- Ne pas faire plusieurs grosses étapes en une seule fois.
- Préserver les fichiers et changements existants qui ne concernent pas la tâche.
- Vérifier chaque changement avec des tests locaux adaptés.
- Ne jamais transformer une erreur ou un résultat incomplet en faux succès.

## Git

Ne jamais exécuter sans demande explicite de l'utilisateur :

- `git add`
- `git commit`
- `git push`

L'utilisateur reste responsable du staging et des commits.

## Politique de coût

Le projet doit rester gratuit par défaut.

Ne jamais utiliser sans demande explicite :

- API payante
- service cloud payant
- hébergement payant
- base de données payante
- dépendance nécessitant un compte payant
- service externe qui reçoit les conversations

Solutions autorisées par défaut :

- fichiers locaux
- Markdown
- JSON
- scripts Node.js
- recherche locale
- provider `mock`
- IA locale via Ollama plus tard

Toute solution payante doit être refusée, sauf si l'utilisateur la demande explicitement.

## Données sensibles

Ne jamais publier, supprimer ou modifier directement les fichiers originaux dans :

`data/raw/`

Ne jamais exposer :

- clés API
- mots de passe
- données privées inutiles
- contenu complet des conversations dans les logs
- fichiers d'export ChatGPT sur GitHub

## Règles anti-hallucination

Le projet doit être source-grounded.

Cela veut dire :

- ne jamais inventer une information absente de la source
- chaque fiche Markdown doit venir d'une source identifiable
- si une information est incertaine, écrire `À vérifier`
- ne jamais transformer une supposition en fait
- garder une trace de la source utilisée
- garder une trace des décisions dans les logs
- une fiche peut venir d'une conversation, d'une note manuelle, d'un fichier local, d'une page web sauvegardée, d'une documentation officielle ou d'une idée de projet, mais la source doit être indiquée quand c'est possible

Chaque fiche Markdown devra contenir au minimum :

```md
---
title: ""
topic: ""
level: "beginner"
tags: []
source_type: "manual"
source_id: ""
confidence: "medium"
status: "draft"
updated: ""
---
```

Valeurs possibles pour `source_type` :

- `manual`
- `conversation`
- `local_file`
- `web_saved`
- `official_doc`
- `project_idea`
- `research_note`

## Logging obligatoire

Chaque action importante doit créer ou mettre à jour un log.

Les logs doivent aller dans :

- `logs/runs/`
- `logs/llm/`
- `logs/errors/`

Pour chaque run, créer un fichier :

`logs/runs/YYYY-MM-DD-HH-mm-run.md`

Chaque log de run doit contenir :

- objectif du run
- fichiers lus
- fichiers créés
- fichiers modifiés
- erreurs rencontrées
- décisions prises
- commandes exécutées si applicable
- provider IA utilisé si applicable
- modèle utilisé si applicable

Pour chaque appel IA, créer ou mettre à jour un log dans :

`logs/llm/`

Chaque log IA doit contenir :

- provider
- modèle
- type de tâche
- succès ou erreur
- durée approximative si possible

Ne jamais logger :

- clés API
- mots de passe
- contenu complet des conversations
- données sensibles inutiles

## Providers IA prévus

Le projet doit pouvoir fonctionner avec plusieurs providers IA plus tard.

Providers autorisés par défaut :

- `mock` : faux provider gratuit pour tester
- `ollama` : IA locale
- `codex` : aide au développement via VS Code ou CLI

Providers non autorisés par défaut :

- `openai`
- `openrouter`
- `anthropic`
- tout autre service externe ou payant

Ces providers peuvent être documentés plus tard, mais ils ne doivent jamais être utilisés sans demande explicite de l'utilisateur.

Le code devra être pensé pour pouvoir changer de provider sans réécrire toute l'application.

## Priorité V1

La V1 doit fonctionner gratuitement, localement, et sans envoyer les conversations à un service externe.

La V1 doit seulement permettre de :

- créer une structure propre
- placer des sources locales dans `data/raw/`
- inspecter les sources locales sans les modifier
- créer un index simple
- générer des fiches Markdown brouillon
- garder des logs

## Chemin recommandé

Le point d'entrée recommandé est :

`scripts/run-research-mvp.js`

Le code de `scripts/legacy/` est conservé comme référence expérimentale. Il
n'est pas le chemin recommandé et ne doit pas être relancé ou modifié sans
besoin explicite.

Les fiches produites par le MVP restent des brouillons. Une fiche `draft` peut
être imparfaite sur le plan éditorial tant qu'elle reste utile, fidèle à sa
source et clairement présentée comme nécessitant une validation humaine.

## Interdictions V1

Pendant la V1 :

- ne pas créer de site Next.js tout de suite
- ne pas utiliser d'API IA payante
- ne pas envoyer les conversations à un service externe
- ne pas installer une base de données avant d'avoir validé les fichiers Markdown
- ne pas supprimer les fichiers sources
