# Interface locale Knowledge Hub

Application Next.js locale pour consulter, rechercher, filtrer, éditer et générer les fiches Markdown du projet.

## Démarrage

Depuis `D:\knowledge-hub\web` :

```powershell
npm install
npm run dev
```

Build de production :

```powershell
npm run build
npm start
```

Tests et lint :

```powershell
npm run lint
npm test
```

## Données locales

- Fiches : `../knowledge/<topic>/<slug>.md`
- Index : `../data/processed/knowledge-index.json`
- Pipeline recommandé : `../scripts/run-research-mvp.js`
- Réindexation : `../scripts/index-knowledge.js`

L'interface ne possède ni base de données, ni compte, ni synchronisation cloud. Les lectures et écritures restent sous `knowledge/`.

## Création et édition

La page **Nouvelle recherche** lance le pipeline MVP avec un modèle Ollama autorisé. Ollama doit être installé, lancé localement et disposer du modèle choisi. `OLLAMA_MODEL` est fixé côté serveur pour chaque job.

L'éditeur permet de modifier le Markdown et les métadonnées. Un changement de topic ou de slug écrit d'abord le nouveau fichier, puis retire l'ancien et régénère l'index. Les champs de source sont verrouillés jusqu'à confirmation explicite.

Le bouton **Régénérer l'index** relance manuellement :

```powershell
node scripts/index-knowledge.js
```

## Limites

- Les jobs de génération sont conservés uniquement en mémoire et disparaissent au redémarrage.
- Une seule génération peut être active.
- Il n'existe pas encore de suppression, opérations en masse ou historique interne.
- Une relecture humaine des fiches `draft` reste nécessaire.

## Sécurité réseau

Cette application est conçue pour `localhost`. Avant toute exposition réseau, ajouter au minimum authentification, protection CSRF, contrôle d'accès et revue des routes d'écriture. Ne pas l'exposer directement sur Internet.
