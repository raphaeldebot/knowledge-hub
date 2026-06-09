---
title: "Préparation d'un agent IA local avec Ollama"
topic: "automation"
level: "beginner"
tags: ["ollama", "ia-locale", "agent", "recherche", "source-grounded"]
source_type: "manual"
source_id: "manual-ollama-local-agent-setup"
confidence: "medium"
status: "draft"
updated: ""
---

# Préparation d'un agent IA local avec Ollama

## Résumé

Cette fiche prépare une future utilisation d'Ollama dans Knowledge Hub.

Elle ne signifie pas qu'Ollama est déjà installé ou configuré. L'installation, le choix du modèle et l'intégration devront être réalisés et testés lors d'étapes séparées.

L'objectif est d'utiliser plus tard une IA locale pour analyser des sources sauvegardées, préparer des brouillons de fiches Markdown et assister un workflow de recherche contrôlé.

## Qu'est-ce qu'Ollama ?

Ollama est un outil permettant d'installer et d'exécuter localement des modèles de langage compatibles.

Il fournit généralement :

- une commande locale pour télécharger et lancer des modèles
- un service local auquel une application peut envoyer des requêtes
- une manière simple de tester plusieurs modèles sur une machine personnelle

Les fonctionnalités exactes, les modèles disponibles et les prérequis peuvent évoluer.

`À vérifier` avant installation : consulter la documentation officielle actuelle d'Ollama pour le système utilisé.

## Pourquoi utiliser Ollama dans Knowledge Hub ?

Ollama correspond aux objectifs du projet car il peut permettre de :

- garder les traitements sur la machine locale
- éviter une API payante par défaut
- limiter l'envoi de notes privées vers un service externe
- tester plusieurs modèles sans réécrire tout le projet
- résumer des sources locales
- proposer des brouillons de fiches Markdown
- classer ou étiqueter des notes
- signaler les passages qui nécessitent une vérification

Une IA locale ne garantit toutefois ni la confidentialité absolue de la machine ni la fiabilité des réponses. La configuration et les données fournies au modèle doivent rester contrôlées.

## Intérêt pour un agent de recherche et de documentation

Dans un agent de recherche, une IA locale peut aider à :

- résumer une source sauvegardée
- extraire les points utiles pour une question précise
- comparer plusieurs notes locales
- proposer des tags et un topic
- produire un premier brouillon structuré
- relever des contradictions
- dresser une liste d'informations à vérifier

L'IA doit intervenir après la collecte contrôlée des sources. Elle ne doit pas être considérée comme une source.

## Ordre recommandé

1. Valider le workflow manuel de recherche.
2. Vérifier les capacités matérielles de la machine.
3. Consulter la documentation officielle actuelle d'Ollama.
4. Installer Ollama lors d'une étape dédiée.
5. Tester un modèle simple avec un texte non sensible.
6. Vérifier la qualité, la vitesse et l'utilisation des ressources.
7. Définir une interface de provider locale dans Knowledge Hub.
8. Tester l'analyse d'une copie de note non sensible.
9. Ajouter des logs sans contenu privé inutile.
10. Générer uniquement des brouillons source-grounded.

Chaque étape doit être validée avant de passer à la suivante.

## Installation future

L'installation devra être réalisée plus tard à partir de la documentation officielle correspondant au système d'exploitation.

Avant l'installation :

- vérifier les systèmes pris en charge
- vérifier l'espace disque disponible
- vérifier la mémoire vive et, si utile, le GPU disponible
- vérifier la taille du modèle envisagé
- noter la version installée
- décider où les modèles seront stockés

Ne pas installer Ollama ni télécharger de modèle sans une demande explicite de l'utilisateur.

## Commandes de base prévues

Les commandes suivantes sont des exemples courants à vérifier dans la documentation officielle avant utilisation :

```bash
ollama --version
ollama list
ollama pull nom-du-modele
ollama run nom-du-modele
ollama ps
ollama stop nom-du-modele
```

Utilité prévue :

- `ollama --version` : vérifier l'installation et afficher la version
- `ollama list` : afficher les modèles locaux
- `ollama pull` : télécharger un modèle choisi
- `ollama run` : lancer une session locale avec un modèle
- `ollama ps` : afficher les modèles en cours d'exécution
- `ollama stop` : arrêter un modèle

`À vérifier` : la disponibilité et le comportement exacts de ces commandes dans la version installée.

## Modèles simples à envisager

Pour commencer, privilégier un modèle :

- suffisamment petit pour la machine
- adapté aux instructions générales
- capable de traiter correctement le français
- documenté et activement maintenu
- utilisé uniquement avec des données de test non sensibles lors des premiers essais

Des familles de modèles légers ou de taille moyenne pourront être envisagées, mais aucun modèle précis ne doit être choisi sans vérifier :

- sa licence
- sa taille
- ses besoins en mémoire
- sa qualité en français
- sa longueur de contexte
- sa compatibilité avec la version d'Ollama

`À vérifier` : sélectionner les modèles disponibles et adaptés au moment de l'installation.

## Tester qu'Ollama fonctionne

Après une future installation :

1. vérifier la version
2. vérifier la liste des modèles locaux
3. télécharger un petit modèle choisi
4. lancer une question simple sans donnée privée
5. confirmer que la réponse est produite localement
6. mesurer approximativement la durée et l'utilisation des ressources
7. arrêter le modèle après le test si nécessaire
8. consigner le résultat dans un log

Un test réussi confirme uniquement que le service répond. Il ne prouve pas que les réponses sont exactes ou adaptées à Knowledge Hub.

## Utilisation future dans Knowledge Hub

Knowledge Hub pourra plus tard utiliser Ollama au moyen d'un provider local.

Ce provider pourra recevoir :

- une consigne précise
- un extrait utile d'une source locale
- les métadonnées de la source
- le modèle de fiche Markdown
- les règles anti-hallucination

Il pourra retourner :

- un résumé
- des points clés
- des tags proposés
- des informations à vérifier
- un brouillon de fiche Markdown

Le résultat devra rester en statut `draft` jusqu'à sa relecture.

L'intégration devra être séparée du reste de l'application afin de pouvoir remplacer le provider sans réécrire tout le workflow.

## Utilisation future d'Internet avec des outils contrôlés

Un futur agent pourra disposer d'outils de recherche web, mais l'IA locale ne devra pas naviguer seule et librement sur Internet.

Le workflow contrôlé devra être :

1. l'utilisateur définit le sujet
2. un outil de recherche collecte des URLs candidates
3. l'utilisateur ou une règle contrôlée valide les URLs
4. le système récupère les sources autorisées
5. les sources et leurs métadonnées sont sauvegardées localement
6. le système extrait uniquement le contenu utile
7. l'IA locale analyse ce contenu avec ses références
8. les résultats sont enregistrés comme brouillons
9. les actions et décisions sont consignées dans des logs

L'outil de collecte et le modèle local doivent rester deux composants distincts.

## Pourquoi ne pas donner Internet directement à l'IA locale ?

Un accès direct et non contrôlé augmenterait les risques :

- sélection de sources peu fiables
- collecte de contenu inutile
- perte de la provenance des informations
- accès à des données privées ou sensibles
- non-respect des conditions d'utilisation
- téléchargement de contenus dangereux
- absence de contrôle sur les actions effectuées
- transformation d'une information incertaine en fait

L'IA doit analyser un ensemble limité de sources identifiées et sauvegardées, pas explorer librement le web.

## Limites de la recherche web

La future recherche devra respecter les règles suivantes :

- sauvegarder les sources localement avant analyse
- garder le titre, l'URL et la date de consultation
- créer des logs pour les actions importantes
- ne pas utiliser de service payant sans demande explicite
- ne pas envoyer de données privées à un service externe
- respecter les droits d'auteur et les conditions d'utilisation
- ne pas contourner les protections techniques
- limiter les extraits au contenu nécessaire
- distinguer les citations des reformulations
- permettre de retrouver la source de chaque information
- faire valider les brouillons avant publication ou statut `reviewed`

## Limites d'une IA locale

Une IA locale peut :

- produire des erreurs
- inventer des informations
- mal interpréter une source
- perdre des détails importants
- être limitée par sa longueur de contexte
- être moins performante qu'un modèle plus grand
- être lente selon le matériel
- consommer beaucoup de mémoire, de stockage ou d'énergie

La qualité dépend du modèle, du matériel, des consignes et du contenu fourni.

Le fonctionnement local réduit certains échanges externes, mais ne remplace pas les sauvegardes, la sécurité du système et la relecture humaine.

## Approche source-grounded

L'IA locale doit travailler à partir de sources identifiables.

Chaque brouillon doit :

- conserver le `source_type`
- conserver un `source_id`
- indiquer un niveau de `confidence`
- citer ou référencer les sources utiles
- marquer les incertitudes avec `À vérifier`
- éviter toute affirmation absente des sources

Si les sources ne permettent pas de répondre, le système doit le signaler au lieu de compléter avec une supposition.

## À vérifier

- Compatibilité actuelle d'Ollama avec le système utilisé.
- Ressources matérielles disponibles sur la machine.
- Modèles adaptés au français et au matériel.
- Licences des modèles envisagés.
- Commandes disponibles dans la version futurement installée.
- Format de l'interface locale entre Knowledge Hub et Ollama.
- Méthode de limitation et de validation des contenus transmis au modèle.

## Liens liés

- `AGENTS.md`
- `README.md`
- `PROJECT_STATUS.md`
- `knowledge/automation/research-workflow.md`
- `knowledge/automation/web-research-agent-spec.md`
- `knowledge/personal/workflow-utilisation.md`
