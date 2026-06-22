---
title: "Comment faire des alias sur Git"
topic: "development"
level: "beginner"
tags: ["alias", "git", "accelerer", "workflow", "quotidien"]
source_type: "web_saved"
source_id: "https://blog.stephane-robert.info/docs/developper/version/git/alias-productivite/"
confidence: "medium"
status: "draft"
updated: "2026-06-15"
---

# Comment faire des alias sur Git

## Créer un alias

La commande `git config` crée un alias en une ligne :

```bash
git config --global alias.st status
```

Désormais, `git st` est équivalent à `git status`.

Le `--global` enregistre l'alias dans votre fichier `~/.gitconfig`, disponible dans tous vos projets. Sans `--global`, l'alias n'existe que dans le dépôt courant.

## Les alias essentiels

Voici un kit de démarrage avec 5 alias utiles à ajouter dans `~/.gitconfig` (sous la section `[alias]`):

```ini
[alias]
st = status
sw = switch
lg = log --oneline --graph --all --decorate
ds = diff --staged
last = log -1 HEAD --stat
```

Exemples de commandes pour créer ces alias :

```bash
git config --global alias.st "status"
git config --global alias.co "checkout"
git config --global alias.sw "switch"
git config --global alias.br "branch"
git config --global alias.ci "commit"
git config --global alias.ca "commit --amend --no-edit"
git config --global alias.cm "commit -m"
git config --global alias.lg "log --oneline --graph --all --decorate"
git config --global alias.ll "log --oneline -15"
git config --global alias.last "log -1 HEAD --stat"
git config --global alias.df "diff"
git config --global alias.ds "diff --staged"
git config --global alias.ss "stash"
git config --global alias.sp "stash pop"
```

## Édition directe

Vous pouvez éditer `~/.gitconfig` avec votre éditeur de texte pour ajouter plusieurs alias d'un coup :

```bash
git config --global --edit
```

## Alias avec des commandes shell

En préfixant avec `!`, vous pouvez exécuter n'importe quelle commande shell :

```bash
git config --global alias.aliases "! git config --get-regexp alias | sed 's/alias\.\([^ ]*\)/\1\t=/' | sort"
```

Exemples utiles :

```bash
git config --global alias.open "! git remote get-url origin | xargs xdg-open"
git config --global alias.who "! git shortlog -sn --no-merges"
git config --global alias.recent "! git branch --sort=-committerdate --format='%(committerdate:relative)%09%(refname:short)'"
```

## Lister et supprimer des alias

### Lister tous les alias

```bash
git config --global --get-regexp alias
```

### Supprimer un alias

```bash
git config --global --unset alias.st
```

## Alias vs aliases shell (zsh/bash)

| Critère | Alias Git (git config) | Alias shell (zsh/bash) |
|--------|------------------------|------------------------|
| Préfixe git | Toujours requis (git lg) | Optionnel (glog) |
| Portabilité | Fonctionne partout (fichier .gitconfig) | Dépend du shell |
| Auto-complétion | Fonctionne nativement | Configuration supplémentaire |
| Commandes non-git | Impossible (sauf !) | Oui |

**Recommandation** : Utilisez les alias Git pour les commandes Git (auto-complétion garantie) et les alias shell pour les raccourcis très courts ou les commandes combinées.

## Exemples d'alias shell courants (zsh)

```bash
# Dans ~/.zshrc
alias g="git"
alias gst="git status"
alias gco="git checkout"
alias gcm="git commit -m"
alias gp="git push"
alias gl="git pull"
```

Si vous utilisez Oh My Zsh, le plugin `git` fournit plus de 150 alias prédéfinis. Activez-le dans votre `.zshrc` :

```bash
plugins=(git)
```

## Dépannage : problèmes courants

| Symptôme | Cause probable | Solution |
|---------|----------------|----------|
| `git: 'lg' is not a git command` | Alias non enregistré | Vérifiez avec `git config --global alias.lg` |
| L'alias avec `!` ne fonctionne pas | Guillemets mal échappés | Éditez `~/.gitconfig` directement |
| Auto-complétion ne fonctionne pas sur un alias | Alias shell, pas Git | Convertissez en alias Git pour l'auto-complétion |

## À retenir

- `git config --global alias.xx "commande"` crée un raccourci réutilisable partout
- Les alias essentiels : `st`, `co`, `br`, `ci`, `lg`, `ds`, `last`
- Le préfixe `!` permet d'exécuter des commandes shell dans un alias
- Les alias Git gardent l'auto-complétion native
- Éditez directement `~/.gitconfig` pour aller plus vite

## Source

- [Alias Git : accélérer votre workflow quotidien](https://blog.stephane-robert.info/docs/developper/version/git/alias-productivite/)
