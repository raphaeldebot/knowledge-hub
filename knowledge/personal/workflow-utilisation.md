---
title: "Workflow d'utilisation du Knowledge Hub"
topic: "personal"
level: "beginner"
tags: ["knowledge-hub", "workflow", "organisation", "notes", "planner"]
source_type: "manual"
source_id: "manual-workflow-utilisation"
confidence: "high"
status: "draft"
updated: ""
---

# Workflow d'utilisation du Knowledge Hub

## Résumé

Ce workflow explique comment utiliser Knowledge Hub au quotidien pour ajouter, organiser et retrouver des connaissances.

Le fonctionnement actuel reste simple, local et gratuit : les informations sont conservées dans des fiches Markdown, puis regroupées dans un index JSON local.

## Ajouter une note manuelle

1. Copier la structure de `knowledge/_template.md`.
2. Choisir le dossier correspondant au sujet de la note.
3. Donner au fichier un nom court, en minuscules et séparé par des tirets.
4. Utiliser `source_type: "manual"`.
5. Remplir les sections utiles sans inventer d'information.
6. Conserver `status: "draft"` tant que la fiche n'a pas été relue.

Exemple de chemin :

```txt
knowledge/linux/commandes-permissions.md
```

## Ajouter une idée de projet

Une idée de projet peut être placée dans `knowledge/personal/` ou dans le dossier du thème concerné.

Utiliser :

```yaml
source_type: "project_idea"
status: "draft"
```

La fiche peut contenir :

- le problème à résoudre
- l'objectif du projet
- les fonctionnalités envisagées
- les contraintes
- les prochaines étapes
- les points à vérifier

## Transformer une source locale en fiche

1. Placer la source originale dans `data/raw/` sans la modifier.
2. Lire la source localement.
3. Créer une fiche dans le dossier thématique adapté.
4. Utiliser `source_type: "local_file"`.
5. Indiquer dans `source_id` un identifiant ou un chemin permettant de retrouver la source.
6. Résumer uniquement les informations présentes dans la source.
7. Ajouter les incertitudes dans la section `À vérifier`.

La fiche ne doit pas reproduire inutilement l'intégralité de la source.

## Marquer une information à vérifier

Une information incertaine ne doit jamais être présentée comme un fait.

L'écrire dans la section :

```md
## À vérifier

- À vérifier : description du point incertain.
```

Utiliser `confidence: "low"` si l'ensemble de la fiche est incertain. Utiliser `confidence: "medium"` si les informations semblent correctes mais n'ont pas encore été relues.

## Utiliser les tags

Les tags servent à préciser le contenu d'une fiche au-delà de son topic principal.

Ils doivent être :

- courts
- utiles pour la recherche
- écrits de manière cohérente
- réutilisés lorsque le même concept apparaît dans plusieurs fiches

Exemple :

```yaml
tags: ["nodejs", "markdown", "indexation"]
```

Éviter les tags trop vagues, les doublons et les variations inutiles d'un même mot.

## Utiliser les statuts

### `draft`

La fiche est un brouillon. Elle peut être incomplète, nécessiter une vérification ou ne pas avoir encore été relue.

### `reviewed`

La fiche a été relue et son contenu est considéré comme suffisamment fiable et clair pour être réutilisé.

### `archived`

La fiche est ancienne, remplacée ou moins utile. Elle reste conservée pour référence, mais ne doit plus être considérée comme prioritaire.

## Relancer l'index

Après avoir créé ou modifié une fiche, relancer l'index local avec :

```bash
node scripts/index-knowledge.js
```

Cette commande met à jour :

```txt
data/processed/knowledge-index.json
```

Elle crée également un log d'exécution dans `logs/runs/`.

Avant d'utiliser la commande, enregistrer les fiches modifiées. Après l'exécution, vérifier le nombre de fiches indexées et les éventuelles erreurs indiquées dans le log.

## Évolution future

Ce workflow pourra évoluer vers une interface de recherche locale utilisant l'index JSON.

La recherche pourra permettre de filtrer les fiches par :

- topic
- tag
- niveau
- type de source
- niveau de confiance
- statut

Un planner pourra ensuite relier des tâches aux fiches, suivre les idées de projets et afficher les prochaines actions.

Ces évolutions devront rester locales et gratuites par défaut.

## À vérifier

- Définir une méthode stable pour choisir les tags.
- Définir les critères précis permettant de passer une fiche de `draft` à `reviewed`.
- Décider comment les fiches archivées seront affichées dans la future recherche.
- Définir le format des liens entre les tâches du planner et les fiches.

## Liens liés

- `AGENTS.md`
- `README.md`
- `knowledge/_template.md`
- `knowledge/_taxonomy.md`
- `knowledge/personal/knowledge-hub-vision.md`
- `scripts/index-knowledge.js`
