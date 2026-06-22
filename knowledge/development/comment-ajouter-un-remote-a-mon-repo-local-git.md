---
title: "Comment  ajouter un remote a mon repo local Git"
topic: "development"
level: "beginner"
tags: ["ajouter", "remote", "repo", "local", "git"]
source_type: "web_saved"
source_id: "https://www.delftstack.com/howto/git/create-remote-repo-from-local/"
confidence: "medium"
status: "draft"
updated: "2026-06-15"
---

# Comment  ajouter un remote a mon repo local Git

## Ajouter un remote à un repo local Git

### Créer un remote sur GitHub

1. Connectez-vous à votre compte GitHub.
2. Cliquez sur l'icône "+" dans le coin supérieur droit et sélectionnez "New repository".
3. Donnez un nom à votre dépôt et choisissez sa visibilité (publique ou privée).
4. Cliquez sur "Create repository".

Pour lier votre dépôt local à ce dépôt distant, exécutez les commandes suivantes dans votre terminal :

```bash
git remote add origin https://github.com/username/repository-name.git
git push -u origin master
```

### Créer un remote sur GitLab

1. Connectez-vous à votre compte GitLab.
2. Cliquez sur le bouton "New project".
3. Remplissez le nom du projet, la description et les paramètres de visibilité.
4. Cliquez sur "Create project".

Pour connecter votre dépôt local à ce dépôt distant, utilisez les commandes suivantes dans votre terminal :

```bash
git remote add origin https://gitlab.com/username/repository-name.git
git remote -v
git push -u origin
```

### Créer un remote sur Bitbucket

1. Connectez-vous à votre compte Bitbucket.
2. Cliquez sur "Create repository".
3. Remplissez les détails de votre dépôt et cliquez sur "Create repository".

Pour connecter votre dépôt local à ce dépôt distant, utilisez les commandes suivantes dans votre terminal :

```bash
git remote add origin https://username@bitbucket.org/username/repository-name.git
git push -u origin master

## Source

- [How to Create a Remote Repository From a Local Repository in Git | Delft Stack](https://www.delftstack.com/howto/git/create-remote-repo-from-local/)
