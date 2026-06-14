# Git rebase

Git rebase permet de réappliquer les commits d'une branche sur une nouvelle base.
Cette opération aide à maintenir un historique linéaire. La branche de travail doit
être propre avant de commencer et les modifications importantes doivent être
sauvegardées. Le processus identifie les commits propres à la branche, déplace la
base, puis réapplique chaque commit dans l'ordre. Un conflit interrompt la
procédure et demande une résolution manuelle avant de continuer.

## Procédure

1. Vérifier l'état du dépôt avec la commande `git status`.
2. Lancer `git rebase main` depuis la branche de travail.
3. Résoudre les conflits signalés dans les fichiers concernés.
4. Ajouter les fichiers résolus puis lancer `git rebase --continue`.
5. Utiliser `git rebase --abort` pour revenir à l'état initial.

```bash
git status
git rebase main
git rebase --continue
git rebase --abort
```

Le rebase réécrit l'identité des commits réappliqués. Il faut donc éviter de
réécrire une branche publique déjà partagée sans coordination. La commande,
les commits, la branche, le dépôt et les conflits sont des concepts techniques
directement liés à Git. Cette documentation fournit un objectif, des exemples,
des commandes et une procédure complète pour répondre à la requête.
