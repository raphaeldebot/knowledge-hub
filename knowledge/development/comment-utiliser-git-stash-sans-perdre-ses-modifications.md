---
title: "Comment utiliser Git stash sans perdre ses modifications"
topic: "development"
level: "beginner"
tags: ["git", "stash", "perdre", "modifications", "guide"]
source_type: "web_saved"
source_id: "https://www.ninjaone.com/fr/blog/git-stash/"
confidence: "medium"
status: "draft"
updated: "2026-06-14"
---

# Comment utiliser Git stash sans perdre ses modifications

## Utiliser `git stash` sans perdre ses modifications

### Introduction à `git stash`

`git stash` est une commande de Git qui permet de sauvegarder temporairement les modifications non validées (non committées) dans un répertoire de travail. Cela permet de revenir à l’état du dernier commit, tout en conservant les modifications pour les réappliquer plus tard.

### Utilisation de base

Pour sauvegarder les modifications actuelles :

```bash
git stash
```

Cette commande sauvegarde toutes les modifications modifiées et prêtes pour le commit, laissant le répertoire de travail propre.

### Sauvegarder avec un message

Pour ajouter un message descriptif à la sauvegarde :

```bash
git stash save "Message descriptif"
```

Cela facilite l’identification des sauvegardes temporaires, surtout lorsqu’il y en a plusieurs.

### Consulter les sauvegardes

Pour afficher la liste des sauvegardes temporaires :

```bash
git stash list
```

Chaque sauvegarde est identifiée par un numéro (ex. `stash@{0}`, `stash@{1}`) et peut avoir un message associé.

### Réappliquer une sauvegarde

Pour réappliquer les modifications d’une sauvegarde :

```bash
git stash apply
```

Cette commande réapplique les modifications les plus récentes, sans les supprimer de la liste.

Pour réappliquer une sauvegarde spécifique :

```bash
git stash apply stash@{n}
```

Remplacer `n` par le numéro de la sauvegarde souhaitée (ex. `stash@{1}`).

### Supprimer une sauvegarde

Pour supprimer une sauvegarde spécifique :

```bash
git stash drop stash@{n}
```

Pour supprimer toutes les sauvegardes :

```bash
git stash clear
```

### Différence entre `apply` et `pop`

- `git stash apply` : Réapplique les modifications sans les supprimer de la liste.
- `git stash pop` : Réapplique les modifications et les supprime de la liste.

Utiliser `pop` uniquement si vous êtes sûr de ne plus avoir besoin des modifications sauvegardées.

### Bonnes pratiques

- **Utiliser des messages descriptifs** lors de la sauvegarde pour faciliter l’identification.
- **Vérifier régulièrement** les sauvegardes inutiles et les supprimer.
- **Ne pas oublier** de réappliquer les sauvegardes nécessaires avant de supprimer celles-ci.

### Récupération de sauvegardes supprimées

Les sauvegardes sont locales et ne sont pas validées ou transmises. Si une sauvegarde est accidentellement supprimée, il peut être possible de la récupérer via `git reflog`, à condition qu’elle ait été supprimée récemment. Cependant, cette méthode est limitée et ne garantit pas une récupération réussie.

## Source

- [Comment utiliser Git Stash : le guide étape par étape - NinjaOne](https://www.ninjaone.com/fr/blog/git-stash/)
