# Project Status - Knowledge Hub

Dernière mise à jour : 2026-06-14

## Résumé

Knowledge Hub est une base de connaissances personnelle locale, gratuite et
source-grounded. Le MVP de recherche est fonctionnel et une interface web
locale permet maintenant de consulter, rechercher, filtrer, éditer et générer
des fiches.

Les règles durables sont définies dans `AGENTS.md`.

## État actuel

Le chemin recommandé est :

```txt
scripts/run-research-mvp.js
```

Flux réel :

```txt
requête utilisateur
→ recherche et sélection
→ récupération ou réutilisation d'une source
→ nettoyage simple
→ Ollama génère uniquement le corps Markdown
→ JavaScript construit le titre, le frontmatter, le topic, les tags et la source
→ validation légère
→ écriture atomique dans knowledge/<topic>/
→ indexation automatique après succès
```

Le modèle reste configurable avec `OLLAMA_MODEL`. Le modèle testé avec succès
est `qwen3:14b`. Le modèle par défaut du code est actuellement `qwen2.5:7b`.

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

Les fiches sont écrites dans :

```txt
knowledge/<topic>/<slug>.md
```

L'index est écrit dans :

```txt
data/processed/knowledge-index.json
```

Les fiches générées conservent :

```yaml
status: "draft"
```

## Architecture

```txt
scripts/
  run-research-mvp.js
  mvp/
    generate-note-direct-with-ollama.js
    research-mvp.js
  shared/
    atomic-file.js
  legacy/
    README.md
    extract-facts-with-ollama.js
    facts-contract.js
    generate-note-from-facts.js
    markdown-from-facts.js
    run-research-pipeline.js

tests/
  mvp/
    research-mvp.test.js
  legacy/
    pipeline-contracts.test.js
  fixtures/
    pipeline/
```

Les scripts autonomes de recherche, validation, sélection, récupération et
indexation restent à la racine de `scripts/`.

Le pipeline complexe est conservé dans `scripts/legacy/` comme référence
expérimentale. Il n'est pas le chemin recommandé actuellement.

## Fonctionnement vérifié

- Une recette de gâteau au chocolat a été générée et indexée avec succès avec
  `qwen3:14b`.
- La fiche Git stash est présente dans
  `knowledge/development/comment-utiliser-git-stash-sans-perdre-ses-modifications.md`.
- La fiche sur le changement de couche est présente dans
  `knowledge/health/comment-changer-la-couche-dun-bebe.md`.
- Ces deux fiches figurent actuellement dans
  `data/processed/knowledge-index.json`.
- L'index contient les chemins, titres, topics, tags, statuts, sources,
  niveaux, niveaux de confiance, dates et titres de sections nécessaires à une
  première interface de lecture.

## Limites connues

- La validation numérique peut être trop stricte lorsque la formulation du
  modèle ne correspond pas exactement à celle de la source.
- La qualité éditoriale, les titres et les tags peuvent varier.
- `qwen3:14b` peut être lent ou dépasser le délai.
- Les fiches restent en statut `draft`.
- Une vérification et des corrections humaines restent conseillées.
- Le pipeline legacy est conservé mais n'est pas recommandé.

## Documentation et données utiles

- Sources originales : `data/raw/research/`
- Fiches Markdown : `knowledge/**/*.md`
- Index : `data/processed/knowledge-index.json`
- Logs de runs : `logs/runs/`
- Logs IA : `logs/llm/`
- Logs d'erreurs : `logs/errors/`

## Prochaine étape

Valider l'usage quotidien de l'interface dans `web/`, notamment une génération
Ollama réelle et une édition manuelle choisie par l'utilisateur.

L'interface reste séparée du pipeline, ne modifie pas les sources originales et
utilise des écritures atomiques avant réindexation.

## Interface web locale

- Next.js 16, App Router, TypeScript et Tailwind CSS dans `web/`
- lecture de l'index et des fiches Markdown
- recherche sans accents et filtres combinables
- pages topics et rendu Markdown GFM
- éditeur Markdown avec aperçu et métadonnées
- déplacement sécurisé lors d'un changement de topic ou de slug
- réindexation automatique ou manuelle
- lancement sécurisé du MVP avec suivi de job en mémoire
- une seule génération active
- 20 tests déterministes sur fixtures temporaires
- lint et build de production validés le 2026-06-14
