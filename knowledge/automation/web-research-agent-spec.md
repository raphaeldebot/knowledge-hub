---
title: "Spécification d'un agent de recherche web assistée"
topic: "automation"
level: "beginner"
tags: ["recherche-web", "agent", "sources", "ia-locale", "specification"]
source_type: "manual"
source_id: "manual-web-research-agent-spec"
confidence: "high"
status: "draft"
updated: ""
---

# Spécification d'un agent de recherche web assistée

## Résumé

Cette fiche décrit une future fonctionnalité de recherche web assistée pour Knowledge Hub.

Elle devra permettre de partir d'un sujet, par exemple `ComfyUI génération d'image`, de collecter des sources candidates, de sauvegarder les informations localement, de les faire évaluer par une IA locale et de générer des fiches Markdown sourcées.

Cette fiche est une spécification. Elle ne décrit pas une fonctionnalité déjà disponible.

## Objectif de la fonctionnalité

La fonctionnalité devra aider l'utilisateur à :

- définir un sujet de recherche
- organiser les étapes de la recherche
- conserver les sources localement
- évaluer la pertinence et la fiabilité des sources
- extraire les informations utiles
- signaler les informations incertaines
- générer des fiches Markdown sourcées
- mettre à jour l'index local

Le système devra rester gratuit par défaut et privilégier les traitements locaux.

## Pourquoi ne pas scraper Google directement en V1

La V1 ne doit pas scraper directement les pages de résultats de Google.

Cette approche présenterait plusieurs problèmes :

- les pages et leur structure peuvent changer
- le scraping peut être bloqué ou limité
- les conditions d'utilisation doivent être respectées
- les résultats peuvent être personnalisés ou incomplets
- le classement ne garantit pas la fiabilité des sources
- la maintenance ajouterait une complexité inutile à la V1
- une automatisation trop rapide pourrait collecter beaucoup de contenu peu utile

La recherche de sources doit commencer avec une liste d'URLs choisies ou validées par l'utilisateur.

## Pourquoi commencer par une version semi-manuelle

Une version semi-manuelle permet de tester le workflow avant d'automatiser ses étapes.

Elle permet notamment de :

- contrôler les sujets recherchés
- choisir les URLs candidates
- vérifier les droits et les conditions d'utilisation
- valider les conventions de sauvegarde
- comparer l'évaluation locale avec le jugement humain
- limiter les sources inutiles ou douteuses
- vérifier la qualité des fiches générées
- identifier les tâches qui méritent réellement une automatisation

L'utilisateur doit garder le contrôle sur les sources retenues et les fiches produites.

## Workflow prévu

### 1. L'utilisateur donne un sujet

L'utilisateur fournit un sujet précis ainsi que les questions auxquelles la recherche doit répondre.

Exemple :

```txt
Sujet : ComfyUI génération d'image
Objectif : comprendre les concepts principaux et préparer un workflow de base
```

### 2. Le système crée un dossier de recherche

Le système prépare un dossier local dédié dans :

```txt
data/raw/research/
```

Exemple prévu :

```txt
data/raw/research/comfyui-generation-image/
```

Les sources originales sauvegardées dans ce dossier ne devront pas être modifiées ni supprimées automatiquement.

### 3. Des URLs candidates sont ajoutées

L'utilisateur ou, plus tard, un agent ajoute une liste d'URLs candidates.

En V1, l'utilisateur doit pouvoir vérifier cette liste avant la collecte.

Les documentations officielles, dépôts officiels et sources directement liées au sujet doivent être privilégiés.

### 4. Le système sauvegarde les sources localement

Le système récupère uniquement les sources autorisées et les conserve localement.

Il doit garder une correspondance claire entre :

- l'URL d'origine
- la date de consultation
- le fichier local
- le type de source

Le contenu sauvegardé ne doit pas être publié automatiquement.

### 5. Une IA locale évalue les sources

Une IA locale, par exemple via Ollama, pourra aider à :

- estimer la pertinence d'une source
- repérer les passages utiles
- résumer le contenu
- relever les contradictions
- proposer des informations à vérifier

Cette évaluation reste une aide. Elle ne doit pas transformer une supposition en fait ni remplacer la vérification des sources.

### 6. Le système génère des fiches Markdown sourcées

Les informations retenues sont transformées en brouillons Markdown.

Chaque fiche doit :

- identifier sa ou ses sources
- conserver un `source_type` adapté
- conserver un `source_id` permettant de retrouver les fichiers locaux
- indiquer un niveau de confiance
- utiliser des tags cohérents
- placer les incertitudes dans `À vérifier`
- commencer avec `status: "draft"`

Les fiches doivent être relues avant de passer au statut `reviewed`.

### 7. Le système relance l'index

Après la création des fiches, le système pourra exécuter localement :

```bash
node scripts/index-knowledge.js
```

Le résultat devra être contrôlé pour vérifier le nombre de fiches indexées, les métadonnées et les erreurs éventuelles.

## Règles anti-hallucination

- Ne jamais inventer une information absente des sources.
- Ne jamais présenter une estimation de l'IA comme un fait vérifié.
- Relier chaque affirmation importante à une source identifiable.
- Comparer plusieurs sources lorsque leurs informations se contredisent.
- Donner la priorité aux documentations officielles lorsqu'elles existent.
- Conserver les limites et le contexte des informations extraites.
- Marquer les informations incertaines avec `À vérifier`.
- Utiliser une confiance faible ou moyenne lorsque la vérification est incomplète.

## Respect des sources

Le système devra :

- conserver l'URL d'origine
- noter la date de consultation
- identifier l'auteur ou l'organisation lorsque c'est possible
- distinguer les citations des reformulations
- limiter les extraits au contenu nécessaire
- respecter les droits d'auteur et les conditions d'utilisation
- éviter de sauvegarder ou publier des données privées inutiles
- ne pas contourner les protections techniques d'un site
- permettre de retrouver la source locale utilisée pour chaque fiche

## Fichiers prévus pour une recherche

Chaque dossier de recherche pourra contenir :

### `research-plan.md`

Décrit le sujet, l'objectif, les questions, les limites et les résultats attendus.

### `sources.md`

Liste les URLs candidates, leur statut et les références locales associées.

### `notes.md`

Regroupe les observations transversales, les comparaisons et les décisions prises pendant la recherche.

### `source-001.md`

Contient les métadonnées, le résumé et les points utiles de la première source.

### `source-002.md`

Contient les métadonnées, le résumé et les points utiles de la deuxième source.

Des fichiers supplémentaires pourront suivre la même convention numérique.

## Champs à garder pour chaque source

Chaque fiche de source devra contenir au minimum :

- titre
- URL
- date de consultation
- type de source
- fiabilité estimée
- résumé
- points utiles
- informations à vérifier

Exemple de structure prévue :

```md
# Titre de la source

## Métadonnées

- URL :
- Date de consultation :
- Type de source :
- Fiabilité estimée :

## Résumé

À compléter.

## Points utiles

À compléter.

## Informations à vérifier

À compléter.
```

La fiabilité estimée doit être présentée comme une évaluation, pas comme une garantie.

## Limites de la V1

La V1 devra rester limitée à :

- des sujets définis manuellement
- des URLs ajoutées ou validées manuellement
- une sauvegarde locale contrôlée
- une évaluation par une IA locale facultative
- des fiches générées avec le statut `draft`
- une relecture humaine avant validation
- une indexation locale

La V1 ne devra pas :

- scraper directement Google
- explorer automatiquement tout le web
- utiliser une API payante
- envoyer les sources ou notes à un service externe
- contourner les restrictions d'accès
- publier automatiquement les sources collectées
- considérer les sorties d'une IA comme vérifiées par défaut

## Évolutions possibles

Après validation de la V1, les évolutions possibles pourront inclure :

- l'import d'une liste d'URLs
- la détection locale des doublons
- la comparaison de plusieurs sources
- un score de pertinence explicable
- une file de sources à relire
- des connecteurs vers des documentations officielles
- une recherche locale dans les sources sauvegardées
- une interface de validation des brouillons
- l'intégration avec le futur moteur de recherche
- la création de tâches dans le futur planner

Toute évolution devra rester locale et gratuite par défaut. Un service externe ou payant ne pourra être utilisé qu'après une demande explicite de l'utilisateur.

## À vérifier

- Définir les formats exacts de `research-plan.md`, `sources.md` et des fiches de source.
- Définir comment sauvegarder légalement les différents types de pages.
- Choisir une méthode locale d'évaluation des sources.
- Définir les critères d'une fiabilité estimée.
- Définir le processus de validation humaine avant indexation.

## Liens liés

- `AGENTS.md`
- `knowledge/_taxonomy.md`
- `knowledge/automation/research-workflow.md`
- `knowledge/personal/workflow-utilisation.md`
- `scripts/index-knowledge.js`
