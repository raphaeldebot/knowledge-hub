# Knowledge Hub

Knowledge Hub est une base de connaissances personnelle locale.

Le but du projet est de créer une sorte d'encyclopédie filtrée, pensée pour retrouver rapidement des informations utiles, organiser des idées, préparer des projets, garder des pense-bêtes et transformer des sources variées en documentation claire.

## Objectifs

Knowledge Hub doit permettre de :

- centraliser des notes utiles
- organiser des idées de projets
- créer des fiches de documentation
- garder des pense-bêtes pratiques
- préparer des plans d'action
- classer les connaissances par thème
- retrouver rapidement une information
- garder une trace des sources utilisées
- fonctionner localement et gratuitement

## Types de contenus prévus

Le projet pourra contenir :

- fiches de connaissances
- notes de formation
- idées de sites ou d'applications
- documentation technique
- snippets de code
- checklists
- plans de projet
- résumés de sources
- notes issues de recherches
- brouillons de tutoriels
- éléments de planning

## Philosophie

Le projet doit rester :

- simple
- local
- gratuit
- compréhensible
- progressif
- source-grounded

Le système ne doit pas inventer d'informations.

Si une information vient d'une source, la source doit être indiquée.  
Si une information est incertaine, elle doit être marquée avec `À vérifier`.

## Structure actuelle

```txt
data/
  raw/           sources originales locales
  processed/     fichiers transformés ou indexés

knowledge/       fiches Markdown classées par thème

logs/
  runs/          logs des actions importantes
  llm/           logs des appels IA éventuels
  errors/        logs d'erreurs

scripts/         scripts locaux du projet
```

## Thèmes de départ

```txt
knowledge/webdev/
knowledge/ai-image/
knowledge/linux/
knowledge/git/
knowledge/automation/
knowledge/personal/
```

## Règles importantes

- Ne pas utiliser de service payant sans demande explicite.
- Ne pas envoyer de données privées vers un service externe.
- Ne pas publier les sources brutes.
- Ne pas supprimer les fichiers originaux.
- Garder des logs pour les actions importantes.
- Préférer des fichiers Markdown simples avant d'ajouter une base de données ou un site.

## Sources possibles

Les fiches pourront venir de plusieurs types de sources :

- note manuelle
- fichier local
- export personnel
- page web sauvegardée
- documentation officielle
- idée de projet
- résumé de recherche
- conversation ou échange utile

Chaque fiche devra garder une trace de sa source quand c'est possible.

## Format prévu d'une fiche

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

# Titre

## Résumé

## Ce que je veux retenir

## Explication

## Exemple

## À vérifier

## Liens liés
```

## Roadmap

### Étape 1 - Base locale

- créer une structure propre
- écrire des fiches Markdown manuellement
- garder des logs
- organiser les thèmes

### Étape 2 - Index local

- lire les fiches Markdown
- créer un index JSON
- préparer une recherche simple

### Étape 3 - Génération assistée

- générer des fiches brouillon depuis des sources locales
- utiliser un provider gratuit ou local
- garder les sources et le niveau de confiance

## Chemin recommandé : MVP de recherche directe

Le chemin MVP simplifié exécute :

```txt
requête utilisateur
→ recherche et sélection
→ récupération ou réutilisation d'une source
→ nettoyage simple
→ Ollama génère uniquement le corps Markdown
→ JavaScript construit le titre, le frontmatter, le topic, les tags et la source
→ validation légère
→ écriture atomique dans knowledge/<topic>/
→ indexation
```

Commande PowerShell :

```powershell
$env:OLLAMA_MODEL = "qwen3:14b"
node scripts/run-research-mvp.js "ma recherche" --force
```

Commande Git Bash :

```bash
OLLAMA_MODEL=qwen3:14b node scripts/run-research-mvp.js \
  "ma recherche" \
  --force
```

Le modèle testé avec succès est `qwen3:14b`. Le modèle reste configurable avec
la variable `OLLAMA_MODEL`. Le modèle par défaut du code est actuellement
`qwen2.5:7b` :

```powershell
$env:OLLAMA_MODEL = "qwen3:14b"
```

Le topic est classé automatiquement. L'option `--topic` permet de le fixer
manuellement si nécessaire. Les fiches sont écrites dans
`knowledge/<topic>/<slug>.md`, restent en statut `draft`, puis sont ajoutées à
`data/processed/knowledge-index.json`.

Limites connues :

- une seule source est utilisée ;
- le nettoyage est volontairement simple ;
- une seule réparation Ollama est permise si la première sortie est inutilisable ;
- la validation vérifie les éléments essentiels, pas chaque phrase ;
- une relecture humaine reste obligatoire.

Le code spécifique au MVP se trouve dans `scripts/mvp/`. Le point d'entrée
public reste `scripts/run-research-mvp.js`.

## Ancien pipeline

L'ancien pipeline complexe est conservé dans `scripts/legacy/` à titre de
référence. Il repose sur une extraction JSON structurée, des faits avec
provenance et un rendu Markdown par profil.

Ce pipeline est expérimental et n'est pas le chemin recommandé actuellement.
Les anciens fichiers encore présents à la racine de `scripts/` sont des
wrappers de compatibilité.

L'utilitaire d'écriture atomique partagé par plusieurs chemins se trouve dans
`scripts/shared/`.

## Prochaine phase : interface web

Le pipeline reste indépendant de la future interface. La prochaine phase
consiste à créer une interface web locale en lecture seule qui utilisera :

```txt
data/processed/knowledge-index.json
knowledge/**/*.md
```

Elle devra permettre de parcourir, rechercher, filtrer et lire les fiches sans
modifier le pipeline de génération.

### Étape 5 - Planner

- ajouter des tâches
- lier les tâches aux fiches
- suivre l'avancement des idées et projets

## Interface web locale

L'interface Next.js se trouve dans `web/`. Pour la lancer :

```powershell
cd web
npm install
npm run dev
```

Consulter `web/README.md` pour l'édition, la génération locale avec Ollama et les précautions d'utilisation.
