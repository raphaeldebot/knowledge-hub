# Project Status - Knowledge Hub

Dernière mise à jour : 2026-06-14

## Résumé du projet

Knowledge Hub est une base de connaissances personnelle locale.

Le projet sert à organiser des notes, fiches de documentation, idées de projets, pense-bêtes, recherches, sources locales et futurs éléments de planning.

Le projet doit rester :

- local
- gratuit
- simple
- progressif
- source-grounded
- compatible avec une IA locale

## Règles importantes

Les règles principales sont définies dans `AGENTS.md`.

À retenir :

- ne jamais utiliser de service payant sans demande explicite
- ne jamais envoyer de données privées vers un service externe sans demande explicite
- ne jamais supprimer ou modifier sans contrôle les sources dans `data/raw/`
- créer des logs pour les actions importantes
- ne pas inventer d'informations absentes des sources
- marquer les informations incertaines avec `À vérifier`
- faire valider humainement les résultats produits par une IA
- avancer étape par étape

## Structure actuelle

```txt
data/
  raw/
    research/
      <slug>/
        research-plan.md
        sources.md
        source-validation.md
        notes.md
        fetched/
          source-recuperee.md
  processed/
    knowledge-index.json

knowledge/
  _template.md
  _taxonomy.md
  automation/
    ollama-local-agent-setup.md
    ollama-windows-install-checklist.md
    research-workflow.md
    web-research-agent-spec.md
    web-source-agent-v1.md
  ai-image/
  personal/
  webdev/
  linux/
  git/

logs/
  runs/
  llm/
  errors/

scripts/
  analyze-fetched-source-with-ollama.js
  check-source-adequacy.js
  create-research-topic.js
  extract-facts-with-ollama.js
  fetch-source.js
  generate-note-from-facts.js
  generate-note-with-ollama.js
  index-knowledge.js
  run-research-mvp.js
  run-research-pipeline.js
  search-knowledge.js
  search-web-sources.js
  select-and-fetch-best-source.js
  test-ollama.js
  validate-sources.js
  mvp/
    generate-note-direct-with-ollama.js
    research-mvp.js
  legacy/
    README.md
    extract-facts-with-ollama.js
    facts-contract.js
    generate-note-from-facts.js
    markdown-from-facts.js
    run-research-pipeline.js
  shared/
    atomic-file.js

tests/
  fixtures/
    pipeline/
  legacy/
    pipeline-contracts.test.js
  mvp/
    research-mvp.test.js

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

### `scripts/create-research-topic.js`

Script local Node.js qui :

- crée ou réutilise un dossier `data/raw/research/<slug>/`
- prépare `research-plan.md`, `sources.md` et `notes.md`
- ne remplace pas les fichiers existants
- garde un log local

### `scripts/search-web-sources.js`

Script contrôlé qui :

- envoie une requête à DuckDuckGo HTML
- récupère uniquement des URLs candidates
- limite le nombre de résultats
- ne visite pas automatiquement les pages candidates
- ajoute les nouvelles URLs dans `sources.md`
- évite les doublons
- propose un mode `--dry-run`

### `scripts/validate-sources.js`

Script entièrement local qui :

- lit les sources candidates dans `sources.md`
- applique une pré-validation heuristique
- estime le type et la fiabilité des sources
- produit `source-validation.md`
- ne visite aucune URL

### `scripts/fetch-source.js`

Script contrôlé qui :

- récupère une seule URL explicitement fournie
- accepte uniquement du contenu HTML
- suit au maximum trois redirections
- limite la taille téléchargée
- extrait un texte brut local
- enregistre le résultat dans `data/raw/research/<slug>/fetched/`
- ne suit aucun lien trouvé dans la page

### Wrappers historiques

Les fichiers suivants restent à la racine de `scripts/` uniquement pour ne pas
casser les anciennes commandes :

- `scripts/analyze-fetched-source-with-ollama.js`
- `scripts/extract-facts-with-ollama.js`
- `scripts/generate-note-from-facts.js`
- `scripts/generate-note-with-ollama.js`
- `scripts/run-research-pipeline.js`

Leur logique réelle se trouve désormais dans `scripts/legacy/`.

### `scripts/index-knowledge.js`

Script local Node.js qui :

- lit les fiches Markdown dans `knowledge/`
- ignore `knowledge/_template.md`
- extrait le frontmatter et les titres Markdown
- crée ou met à jour `data/processed/knowledge-index.json`
- crée un log dans `logs/runs/`

Commande :

```bash
node scripts/index-knowledge.js
```

### `scripts/run-research-mvp.js`

Orchestrateur minimal parallèle au pipeline JSON complexe. Il réutilise la
recherche, la validation, la sélection et la récupération existantes, nettoie
légèrement la source, demande directement une fiche Markdown à Ollama, valide
les champs indispensables, écrit atomiquement la fiche puis lance l'indexation
une seule fois.

Commande :

```powershell
node scripts/run-research-mvp.js "recette gâteau au chocolat moelleux"
```

Le modèle reste configurable avec `OLLAMA_MODEL`. Le modèle testé avec succès
pour ce chemin est `qwen3:14b`. Le topic est automatique, avec une option
manuelle `--topic`. La fiche produite reste en statut `draft` et peut nécessiter
des corrections humaines.

Commande validée :

```powershell
$env:OLLAMA_MODEL = "qwen3:14b"
node scripts/run-research-mvp.js "recette gâteau au chocolat moelleux" --force
```

### `scripts/mvp/`

Contient uniquement la génération Markdown directe, le nettoyage simple, la
validation minimale, la classification et les fonctions propres au MVP.

### `scripts/legacy/`

Conserve l'ancien pipeline complexe d'extraction JSON, de faits avec provenance
et de rendu par profil. Il reste testable et documenté, mais n'est pas le chemin
recommandé actuellement.

### `scripts/shared/`

Contient uniquement l'écriture atomique, utilisée par plusieurs chemins.

### `scripts/search-knowledge.js`

Script local qui :

- lit `data/processed/knowledge-index.json`
- recherche dans les titres, topics, tags, headings et chemins
- accepte les filtres `--topic` et `--tag`
- peut afficher toutes les fiches avec `--all`
- effectue une recherche insensible à la casse, aux accents, tirets et underscores

### `scripts/test-ollama.js`

Script local Node.js qui :

- teste la connexion entre Knowledge Hub et l'API locale Ollama
- vérifie qu'Ollama répond sur `http://localhost:11434`
- détecte les modèles installés
- utilise une IA locale sans API payante

Dernier test connu :

- résultat : succès
- modèle utilisé : `llama3.2:3b`
- modèles détectés : `llama3.2:3b` et `qwen2.5:7b`
- réponse reçue : `OK`

## Ancien workflow validé, conservé comme référence

Ce workflow historique a été testé avec succès avec le sujet ComfyUI beginner
guide. Il est désormais classé dans `scripts/legacy/` et n'est plus le chemin
recommandé.

```txt
mot-clé
→ sources candidates
→ validation locale
→ fetch d'une URL explicite
→ analyse Ollama locale
→ notes.md enrichi
→ fiche Markdown brouillon
→ index local
```

Étapes validées :

1. Création d'un dossier de recherche local.
2. Recherche de sources candidates avec DuckDuckGo HTML.
3. Enregistrement des URLs candidates dans `sources.md`.
4. Pré-validation heuristique locale avec `validate-sources.js`.
5. Récupération contrôlée d'une URL explicite avec `fetch-source.js`.
6. Extraction d'un texte brut dans `data/raw/research/<slug>/fetched/`.
7. Analyse locale avec Ollama et le modèle `qwen2.5:7b`.
8. Ajout de l'analyse structurée dans `notes.md`.
9. Génération d'une fiche Markdown brouillon dans `knowledge/`.
10. Validation humaine avant de considérer la fiche comme fiable.

### Limites du workflow

- La recherche web envoie la requête à DuckDuckGo HTML.
- Aucune API payante n'est utilisée.
- Aucun crawler généraliste n'est créé.
- Les pages candidates ne sont pas visitées automatiquement par la recherche.
- `fetch-source.js` récupère seulement une URL explicitement fournie.
- Les résultats de recherche et les scores heuristiques ne prouvent pas la fiabilité d'une source.
- L'analyse LLM reste un brouillon.
- Une validation humaine est obligatoire avant de considérer une fiche comme fiable.

## État de l'index

Le fichier suivant existe :

```txt
data/processed/knowledge-index.json
```

L'index doit être relancé après la validation ou la modification d'une fiche dans `knowledge/`.

## Fonctionnalités déjà en place

- structure de dossiers locale
- modèle de fiche Markdown
- taxonomie
- logs de run
- script d'indexation local
- index JSON généré
- recherche locale dans l'index
- création de dossiers de recherche
- recherche contrôlée de sources web candidates
- validation heuristique locale des sources
- récupération contrôlée d'une source HTML
- extraction locale du texte d'une page HTML
- analyse locale d'une source récupérée avec Ollama
- génération de fiches Markdown brouillon depuis des notes locales
- validation anti-hallucination de base
- génération automatique du frontmatter par le script
- communication avec Ollama testée avec succès
- workflow complet testé avec ComfyUI beginner guide

## Fonctionnalités non encore créées

- fusion intelligente de plusieurs sources
- validation avancée multi-sources
- interface web
- planner
- amélioration de la qualité des fiches détaillées
- gestion avancée des doublons
- sélection automatique prudente des meilleures sources

## Prochaines étapes possibles

### Option 1 - Fiche spécialisée

Créer une fiche détaillée spécialisée, par exemple :

```txt
knowledge/ai-image/comfyui-text-to-image-workflow.md
```

### Option 2 - Plusieurs fiches spécialisées

Créer un script qui transforme plusieurs analyses présentes dans `notes.md` en plusieurs fiches spécialisées.

### Option 3 - Workflow guidé

Créer une commande qui lance le workflow étape par étape avec une confirmation humaine entre chaque étape.

### Option 4 - Recherche locale améliorée

Améliorer `scripts/search-knowledge.js` avec un affichage plus compact ou l'ouverture du fichier trouvé.

## Prochaine étape recommandée

Créer une fiche spécialisée plus détaillée à partir d'une source précise, plutôt que de tout mettre dans une seule fiche générale.

Raison :

- une fiche spécialisée est plus facile à vérifier
- elle garde un lien clair avec une source précise
- elle limite les généralisations et les mélanges entre plusieurs sujets
- elle améliore la qualité de la recherche locale

## Commandes utiles

Relancer l'index :

```bash
node scripts/index-knowledge.js
```

Rechercher dans l'index :

```bash
node scripts/search-knowledge.js comfyui
```

## À ne pas faire maintenant

- ne pas créer de site Next.js tout de suite
- ne pas installer de base de données
- ne pas utiliser d'API payante
- ne pas scraper automatiquement Google
- ne pas créer de crawler généraliste
- ne pas envoyer de sources privées à un service externe
- ne pas considérer une analyse LLM comme fiable sans validation humaine
