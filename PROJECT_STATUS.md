# Project Status - Knowledge Hub

Dernière mise à jour : 2026-06-10

## Résumé du projet

Knowledge Hub est une base de connaissances personnelle locale.

Le projet sert à organiser des notes, fiches de documentation, idées de projets, pense-bêtes, recherches, sources locales et futurs éléments de planning.

Le projet doit rester :

- local
- gratuit
- simple
- progressif
- source-grounded
- compatible avec une future IA locale

## Règles importantes

Les règles principales sont définies dans `AGENTS.md`.

À retenir :

- ne jamais utiliser de service payant sans demande explicite
- ne jamais envoyer de données privées vers un service externe sans demande explicite
- ne jamais modifier ou supprimer directement les sources dans `data/raw/`
- créer des logs pour les actions importantes
- ne pas inventer d'informations absentes des sources
- marquer les informations incertaines avec `À vérifier`
- avancer étape par étape

## Structure actuelle

```txt
data/
  raw/
  processed/
    knowledge-index.json

knowledge/
  _template.md
  _taxonomy.md
  automation/
    research-workflow.md
    web-research-agent-spec.md
  personal/
    knowledge-hub-vision.md
    workflow-utilisation.md
  webdev/
  ai-image/
  linux/
  git/

logs/
  runs/
  llm/
  errors/

scripts/
  index-knowledge.js
  test-ollama.js

AGENTS.md
README.md
PROJECT_STATUS.md
.gitignore
```

## Fichiers principaux

### `AGENTS.md`

Contient les règles permanentes du projet.

Il doit être lu avant chaque action importante.

### `README.md`

Explique la vision générale de Knowledge Hub.

### `PROJECT_STATUS.md`

Résume l'état actuel du projet et sert de point de reprise.

### `knowledge/_template.md`

Modèle standard pour créer une fiche Markdown.

### `knowledge/_taxonomy.md`

Définit les conventions :

- topics
- noms de fichiers
- `source_type`
- `level`
- `confidence`
- `status`
- règles anti-doublons

### `scripts/index-knowledge.js`

Script local Node.js qui :

- lit les fiches Markdown dans `knowledge/`
- ignore `knowledge/_template.md`
- extrait le frontmatter
- extrait les titres Markdown
- crée ou met à jour `data/processed/knowledge-index.json`
- crée un log dans `logs/runs/`

Commande :

```bash
node scripts/index-knowledge.js
```

### `scripts/test-ollama.js`

Script local Node.js qui :

- teste la connexion entre Knowledge Hub et l'API locale Ollama
- vérifie qu'Ollama répond sur `http://localhost:11434`
- détecte les modèles installés
- utilise une IA locale sans API payante
- garde les logs d'exécution localement

Dernier test connu :

- résultat : succès
- modèle utilisé : `llama3.2:3b`
- modèles détectés : `llama3.2:3b` et `qwen2.5:7b`
- réponse reçue : `OK`

Les logs restent locaux et peuvent être ignorés par Git.

## État de l'index

Le fichier suivant existe :

```txt
data/processed/knowledge-index.json
```

Dernier état connu :

- fiches indexées : 5
- fichier ignoré : `knowledge/_template.md`
- erreurs : aucune

## Fiches déjà créées

### Système / organisation

- `knowledge/_taxonomy.md`

### Vision et utilisation

- `knowledge/personal/knowledge-hub-vision.md`
- `knowledge/personal/workflow-utilisation.md`

### Automatisation et recherche

- `knowledge/automation/research-workflow.md`
- `knowledge/automation/web-research-agent-spec.md`

## Fonctionnalités déjà en place

- structure de dossiers locale
- modèle de fiche Markdown
- taxonomie
- logs de run
- script d'indexation local
- index JSON généré
- workflow d'utilisation
- workflow de recherche externe
- spécification pour un futur agent de recherche web
- script de test de l'API locale Ollama
- communication avec Ollama testée avec succès
- utilisation locale du modèle `llama3.2:3b` sans API payante

## Fonctionnalités non encore créées

- moteur de recherche local
- interface web
- planner
- import automatique de sources
- agent IA local
- génération automatique de fiches depuis des sources
- gestion avancée des doublons
- visualisation de progression

## Prochaines étapes possibles

### Option 1 - Recherche locale simple

Créer un script :

```txt
scripts/search-knowledge.js
```

Objectif :

- lire `data/processed/knowledge-index.json`
- chercher dans `title`, `tags`, `topic`, `headings`
- afficher les fiches correspondantes dans le terminal

### Option 2 - Premier dossier de recherche

Créer un dossier :

```txt
data/raw/research/comfyui/
  research-plan.md
  sources.md
  notes.md
```

Objectif :

- préparer une recherche sur ComfyUI
- garder les sources
- transformer plus tard les notes en fiches Markdown

### Option 3 - Amélioration de l'index

Ajouter dans l'index :

- extrait court de chaque fiche
- date de modification du fichier
- nombre de headings
- nombre de tags

### Option 4 - Planner

Créer une première convention pour les tâches et idées de projet.

### Option 5 - Génération locale d'une fiche brouillon

Créer un script qui :

- lit une note locale dans `data/raw/research/`
- utilise Ollama localement
- génère une fiche Markdown brouillon dans `knowledge/`
- conserve la source et les logs localement

## Décision recommandée

La prochaine étape recommandée est :

Créer un premier dossier de recherche pour ComfyUI.

Raison :

- c'est directement utile pour les projets image IA
- ça teste le workflow de recherche externe
- ça prépare plus tard l'automatisation
- ça reste local et gratuit

## Commandes utiles

Relancer l'index :

```bash
node scripts/index-knowledge.js
```

## À ne pas faire maintenant

- ne pas créer de site Next.js tout de suite
- ne pas installer de base de données
- ne pas utiliser d'API payante
- ne pas scraper automatiquement Google
- ne pas envoyer de sources privées à un service externe
- ne pas automatiser trop tôt avant d'avoir testé le workflow manuellement
