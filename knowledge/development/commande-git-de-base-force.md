---
title: "Commande Git de base --force"
topic: "development"
level: "beginner"
tags: ["commande", "git", "base", "force", "mastering"]
source_type: "web_saved"
source_id: "https://gitscripts.com/git-rebase-force"
confidence: "medium"
status: "draft"
updated: "2026-06-15"
---

# Commande Git de base --force

## Utilisation de `git rebase --force`

### Définition

`git rebase --force` est une commande utilisée pour forcer un rebase malgré les conflits ou les problèmes potentiels. Elle permet de surcharger les commits existants dans la branche cible.

### Commande

```bash
git rebase --force <branch>
```

Cette commande force le rebase de la branche actuelle sur la branche spécifiée, même si cela implique de perdre ou de modifier des commits existants.

### Quand l'utiliser

- **Gestion des branches divergentes** : Lorsque des modifications ont été apportées sur une branche de fonctionnalité qui diverge de la branche principale.
- **Corrections de commits antérieurs** : Lorsque des erreurs dans des commits précédents doivent être corrigées sans perturber l'ensemble de l'historique.

### Étapes pour utiliser `git rebase --force`

#### Étape 1 : Préparer votre branche

- **Stocker les changements non committés** :
  ```bash
  git stash
  ```
- **Commiter les travaux en cours** : Assurez-vous que vos modifications importantes sont sauvegardées localement.

#### Étape 2 : Démarrer le rebase

Exécutez les commandes suivantes :

```bash
git fetch origin
git checkout feature-branch
git rebase --force origin/main
```

Ces commandes récupèrent les dernières modifications de la branche principale, basculent sur votre branche de fonctionnalité, puis forcent le rebase.

#### Étape 3 : Résoudre les conflits

- Si des conflits apparaissent, résolvez-les manuellement dans les fichiers concernés.
- Poursuivez le rebase avec :
  ```bash
  git rebase --continue
  ```
- Si vous souhaitez annuler le rebase :
  ```bash
  git rebase --abort
  ```

#### Étape 4 : Terminer le rebase

Après avoir résolu les conflits, poussez vos modifications vers le dépôt distant :

```bash
git push origin feature-branch --force
```

### Bonnes pratiques

- **Commitez souvent et de manière significative** : Cela permet de préserver l'intégrité de votre travail.
- **Utilisez `git rebase --force` uniquement sur les branches de fonctionnalité** : Cela réduit le risque de perturber la branche principale.
- **Communiquez avec votre équipe** : Informez vos collègues lorsqu'un rebase avec la commande `--force` est effectué.

### Erreurs courantes

- **Oublier de pousser après le rebase** : Cela peut entraîner une perte de modifications locales non synchronisées avec le dépôt distant.

### Outils utiles

- **`git reflog`** : Permet de retrouver des commits perdus.
- **`git status`** : Aide à surveiller l'état actuel du dépôt.

## Source

- [Mastering Git Rebase Force: A Quick Guide](https://gitscripts.com/git-rebase-force)
